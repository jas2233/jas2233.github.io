import express from 'express'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const ENCRYPTED_PREFIX = 'enc:v1:'
const FACT_PROMPT = `请从用户原话中提取值得长期记住的个人事实，例如经历、喜好、习惯、关系和明确计划。
只能使用用户明确陈述的内容，不能把疑问、假设、否定内容或你的推测当成事实。
忽略寒暄、临时指令和没有长期价值的话。最多返回 5 条，每条是独立完整的中文句子。
只返回 JSON 字符串数组；没有事实时返回 []。`

function vectorText(vector) {
    if (!Array.isArray(vector) || vector.some(value => !Number.isFinite(value))) {
        throw new Error('记忆向量无效')
    }
    return `[${vector.join(',')}]`
}

function parseFacts(content) {
    const start = content.indexOf('[')
    const end = content.lastIndexOf(']')
    if (start < 0 || end <= start) return []
    const facts = JSON.parse(content.slice(start, end + 1))
    if (!Array.isArray(facts)) return []
    return [...new Set(facts
        .filter(fact => typeof fact === 'string')
        .map(fact => fact.trim())
        .filter(fact => fact.length > 1 && fact.length <= 500))]
        .slice(0, 5)
}

export function createMemoryService({
    database,
    embedder,
    deepSeekApiKey,
    deepSeekModel = 'deepseek-v4-flash',
    openRouterApiKey,
    openRouterModel = 'google/gemini-3.5-flash-lite',
    fetchImpl = fetch
}) {
    return {
        async recall(query, scopeTag) {
            if (typeof scopeTag !== 'string' || scopeTag.length < 20 || scopeTag.length > 100) {
                throw new Error('记忆空间无效')
            }
            const [embedding] = await embedder.embed(query)
            return await database.rpc('lucia_search_memories', {
                p_embedding: vectorText(embedding),
                p_scope_tag: scopeTag,
                p_limit: 5,
                p_min_similarity: 0.45
            }) || []
        },

        async prepare(userContent, mode = 'daily') {
            if (!['daily', 'intimate'].includes(mode)) throw new Error('记忆模式无效')
            if (mode === 'intimate' && !openRouterApiKey) throw new Error('亲密模式尚未配置 OpenRouter API Key')
            const response = await fetchImpl(mode === 'intimate'
                ? OPENROUTER_API_URL
                : DEEPSEEK_API_URL, {
                method: 'POST',
                headers: mode === 'intimate'
                    ? { Authorization: `Bearer ${openRouterApiKey}`, 'Content-Type': 'application/json' }
                    : { Authorization: `Bearer ${deepSeekApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(mode === 'intimate' ? {
                    model: openRouterModel,
                    stream: false,
                    messages: [
                        { role: 'system', content: FACT_PROMPT },
                        { role: 'user', content: userContent }
                    ],
                    max_tokens: 400,
                    provider: { zdr: true, data_collection: 'deny' }
                } : {
                    model: deepSeekModel,
                    stream: false,
                    messages: [
                        { role: 'system', content: FACT_PROMPT },
                        { role: 'user', content: userContent }
                    ],
                    temperature: 0,
                    max_tokens: 400
                }),
                signal: AbortSignal.timeout(30_000)
            })
            const body = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(body.error?.message || '长期记忆提取失败')
            }

            const generated = body.choices?.[0]?.message?.content
            const facts = parseFacts(generated || '')
            if (!facts.length) return []
            const embeddings = await embedder.embed(facts)
            return facts.map((content, index) => ({
                content,
                embedding: vectorText(embeddings[index])
            }))
        },

        async save(sourceMessageId, scopeTag, memories) {
            if (!/^\d+$/.test(String(sourceMessageId || '')) ||
                typeof scopeTag !== 'string' || scopeTag.length < 20 || scopeTag.length > 100 ||
                !Array.isArray(memories)) {
                throw new Error('长期记忆内容无效')
            }
            const encrypted = memories.slice(0, 5).map(item => ({
                content: typeof item?.content === 'string' ? item.content.trim() : '',
                fingerprint: typeof item?.fingerprint === 'string' ? item.fingerprint.trim() : '',
                embedding: typeof item?.embedding === 'string' ? item.embedding : ''
            }))
            if (encrypted.some(item =>
                !item.content.startsWith(ENCRYPTED_PREFIX) ||
                item.content.length > 2_000 ||
                !item.fingerprint || item.fingerprint.length > 100 ||
                !/^\[[\d.,eE+\-]+\]$/.test(item.embedding)
            )) throw new Error('长期记忆密文无效')

            return database.rpc('lucia_save_memories', {
                p_source_message_id: String(sourceMessageId),
                p_scope_tag: scopeTag,
                p_memories: encrypted
            })
        }
    }
}

export function createMemoryRouter(memory) {
    const router = express.Router()

    router.post('/recall', async (request, response) => {
        const query = typeof request.body?.query === 'string' ? request.body.query.trim() : ''
        if (!query || query.length > 20_000) {
            response.status(400).json({ error: '检索内容无效' })
            return
        }
        response.json({ memories: await memory.recall(query, request.body?.scopeTag) })
    })

    router.post('/prepare', async (request, response) => {
        const content = typeof request.body?.content === 'string' ? request.body.content.trim() : ''
        if (!content || content.length > 20_000) {
            response.status(400).json({ error: '记忆内容无效' })
            return
        }
        response.json({ memories: await memory.prepare(content, request.body?.mode) })
    })

    router.post('/', async (request, response) => {
        response.status(201).json(await memory.save(
            request.body?.sourceMessageId,
            request.body?.scopeTag,
            request.body?.memories
        ))
    })

    return router
}

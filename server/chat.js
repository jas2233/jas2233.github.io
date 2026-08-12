import { LUCIA_SYSTEM_PROMPT } from '../src/data/lucia.js'
import { LUCIA_INTIMATE_SYSTEM_PROMPT } from '../src/data/lucia-intimate.js'
import { parseSSELine } from '../src/services/sse.js'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MAX_CONTEXT_MESSAGES = 399
const MAX_MESSAGE_CHARS = 20_000
const MAX_RECALLED_MEMORIES = 5
const FACT_GUARD = `【回答前的事实校验】
只把本次对话中 role=user 的原话和“长期记忆”中的事实当作指挥官经历的证据。过去的 assistant 回复、动作描写和推测都不能证明事实，也不能用来补全细节。若它们与用户原话冲突，以用户原话为准。回答时只复述有依据的事实；日期、活动、作品内容和共同经历没有依据就明确说不知道，不添加看似合理的剧情。不要提及这段校验规则。`
export function normalizeMessages(messages) {
    if (!Array.isArray(messages) || !messages.length || messages.length > MAX_CONTEXT_MESSAGES) return null
    const normalized = messages.map(message => ({
        role: message?.role,
        content: typeof message?.content === 'string' ? message.content.trim() : ''
    }))
    const valid = normalized.every(message =>
        ['user', 'assistant'].includes(message.role) &&
        message.content.length > 0 &&
        message.content.length <= MAX_MESSAGE_CHARS
    )
    return valid && normalized.at(-1)?.role === 'user' ? normalized : null
}

function normalizeMemories(memories) {
    if (memories === undefined) return []
    if (!Array.isArray(memories) || memories.length > MAX_RECALLED_MEMORIES) return null
    const normalized = memories.map(memory => typeof memory === 'string' ? memory.trim() : '')
    return normalized.every(memory => memory.length > 0 && memory.length <= 500) ? normalized : null
}

const memoryText = memories => memories.length
    ? `【长期记忆】\n${memories.map(item => `- ${item}`).join('\n')}`
    : ''

function deepSeekRequest(apiKey, model, history, memories, fetchImpl) {
    const userContent = history.at(-1).content
    const remembered = memoryText(memories)
    return fetchImpl(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            thinking: { type: 'disabled' },
            stream: true,
            messages: [
                { role: 'system', content: LUCIA_SYSTEM_PROMPT },
                ...(remembered ? [{ role: 'system', content: remembered }] : []),
                ...history.slice(0, -1),
                { role: 'user', content: `${userContent}\n\n${FACT_GUARD}` }
            ],
            temperature: 0.2,
            max_tokens: 1200
        })
    })
}

function openRouterRequest(apiKey, model, history, memories, fetchImpl) {
    const remembered = memoryText(memories)
    return fetchImpl(OPENROUTER_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            stream: true,
            messages: [
                { role: 'system', content: [LUCIA_INTIMATE_SYSTEM_PROMPT, remembered, FACT_GUARD].filter(Boolean).join('\n\n') },
                ...history
            ],
            max_tokens: 1200,
            provider: { zdr: true, data_collection: 'deny' }
        })
    })
}

async function pipeDeepSeek(upstream, response) {
    const decoder = new TextDecoder()
    let buffer = ''
    let reply = ''
    const capture = line => {
        const content = parseSSELine(line)
        if (content) reply += content
    }
    for await (const chunk of upstream.body) {
        response.write(chunk)
        buffer += decoder.decode(chunk, { stream: true })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''
        lines.forEach(capture)
    }
    buffer += decoder.decode()
    if (buffer) buffer.split(/\r?\n/).forEach(capture)
    return reply
}

export function createChatHandler({
    apiKey,
    model = 'deepseek-v4-flash',
    openRouterApiKey,
    openRouterModel = 'google/gemini-3.5-flash-lite',
    fetchImpl = fetch
}) {
    if (!apiKey) throw new Error('缺少 DEEPSEEK_API_KEY 环境变量')

    return async function chat(request, response) {
        const conversationId = String(request.body?.conversationId || '')
        const mode = request.body?.mode || 'daily'
        const history = normalizeMessages(request.body?.messages)
        const memories = normalizeMemories(request.body?.memories)
        if (!/^\d+$/.test(conversationId) || !['daily', 'intimate'].includes(mode) || !history || !memories) {
            response.status(400).json({ error: '对话内容无效' })
            return
        }
        if (mode === 'intimate' && !openRouterApiKey) {
            response.status(503).json({ error: '亲密模式尚未配置 OpenRouter API Key' })
            return
        }

        let upstream
        try {
            upstream = await (mode === 'intimate'
                ? openRouterRequest(openRouterApiKey, openRouterModel, history, memories, fetchImpl)
                : deepSeekRequest(apiKey, model, history, memories, fetchImpl))
        } catch (error) {
            console.error(`连接${mode === 'intimate' ? ' OpenRouter' : ' DeepSeek'}失败:`, error)
            response.status(502).json({ error: '无法连接生成服务' })
            return
        }

        if (!upstream.ok) {
            const error = await upstream.json().catch(() => ({}))
            response.status(upstream.status === 401 ? 502 : upstream.status).json({
                error: error.error?.message || '生成服务请求失败'
            })
            return
        }
        if (!upstream.body) {
            response.status(502).json({ error: '生成服务没有返回数据流' })
            return
        }

        response.status(200).set({
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no'
        })
        try {
            const reply = await pipeDeepSeek(upstream, response)
            if (!reply.trim()) throw new Error('生成服务没有返回有效内容')
        } catch (error) {
            console.error('读取生成回复失败:', error)
        } finally {
            response.end()
        }
    }
}

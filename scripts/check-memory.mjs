import assert from 'node:assert/strict'
import { createEmbeddingClient } from '../server/embedding.js'
import { createMemoryService } from '../server/memories.js'

let embeddingRequest
const embedder = createEmbeddingClient({
    apiKey: 'embedding-key',
    endpoint: 'https://example.com/embeddings',
    fetchImpl: async (_url, options) => {
        embeddingRequest = JSON.parse(options.body)
        return Response.json({
            data: [
                { index: 1, embedding: [0, 1] },
                { index: 0, embedding: [1, 0] }
            ]
        })
    }
})
assert.deepEqual(await embedder.embed(['事实一', '事实二']), [[1, 0], [0, 1]])
assert.equal(embeddingRequest.model, 'text-embedding-v4')
assert.equal(embeddingRequest.dimensions, 1024)

const calls = []
const database = {
    async rpc(name, parameters) {
        calls.push({ name, parameters })
        if (name === 'lucia_search_memories') return [{ content: 'enc:v1:iv.ciphertext' }]
        return { saved: 1, total: 1 }
    }
}
const memory = createMemoryService({
    database,
    embedder: {
        async embed(input) {
            return (Array.isArray(input) ? input : [input]).map(() => [1, 0])
        }
    },
    deepSeekApiKey: 'deepseek-key',
    openRouterApiKey: 'openrouter-key',
    fetchImpl: async url => Response.json(url.includes('openrouter.ai')
        ? { choices: [{ message: { content: '["指挥官喜欢拥抱。"]' } }] }
        : { choices: [{ message: { content: '["指挥官上周参加过考试。"]' } }] })
})

const scopeTag = 'private-scope-tag-1234567890'
assert.deepEqual(await memory.recall('考试', scopeTag), [{ content: 'enc:v1:iv.ciphertext' }])
const prepared = await memory.prepare('我上周参加过考试')
assert.equal((await memory.prepare('我喜欢拥抱', 'intimate'))[0].content, '指挥官喜欢拥抱。')
await memory.save('12', scopeTag, [{
    content: 'enc:v1:iv.ciphertext',
    fingerprint: 'private-fingerprint',
    embedding: prepared[0].embedding
}])
assert.equal(calls[0].name, 'lucia_search_memories')
assert.equal(calls[1].name, 'lucia_save_memories')
assert.equal(calls[0].parameters.p_scope_tag, scopeTag)
assert.equal(calls[1].parameters.p_scope_tag, scopeTag)
assert.equal(calls[1].parameters.p_memories[0].embedding, '[1,0]')

console.log('Memory checks passed')

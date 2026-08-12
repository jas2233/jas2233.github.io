import assert from 'node:assert/strict'
import { db } from '../server/db.js'
import { createEmbeddingClient } from '../server/embedding.js'

const embedder = createEmbeddingClient({
    apiKey: process.env.DASHSCOPE_API_KEY,
    endpoint: process.env.DASHSCOPE_EMBEDDING_URL,
    model: process.env.DASHSCOPE_EMBEDDING_MODEL
})
const [embedding] = await embedder.embed('长期记忆检索测试')
const memories = await db.rpc('lucia_search_memories', {
    p_embedding: `[${embedding.join(',')}]`,
    p_scope_tag: 'live-check-scope-tag-0000000000000000',
    p_limit: 5,
    p_min_similarity: 0.45
})
assert.ok(Array.isArray(memories))
console.log('CloudBase vector retrieval check passed')

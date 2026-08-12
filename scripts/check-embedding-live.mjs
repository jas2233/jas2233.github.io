import assert from 'node:assert/strict'
import { createEmbeddingClient } from '../server/embedding.js'

const client = createEmbeddingClient({
    apiKey: process.env.DASHSCOPE_API_KEY,
    endpoint: process.env.DASHSCOPE_EMBEDDING_URL,
    model: process.env.DASHSCOPE_EMBEDDING_MODEL
})
const [embedding] = await client.embed('露西亚长期记忆连接测试')
assert.equal(embedding.length, 1024)
console.log('Alibaba embedding check passed: 1024 dimensions')

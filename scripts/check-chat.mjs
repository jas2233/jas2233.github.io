import assert from 'node:assert/strict'
import { createChatHandler, normalizeMessages } from '../server/chat.js'

assert.equal(normalizeMessages([{ role: 'user', content: '你好' }]).length, 1)
assert.equal(normalizeMessages([{ role: 'system', content: '无效' }]), null)
assert.equal(normalizeMessages(Array.from({ length: 400 }, () => ({ role: 'user', content: '过长' }))), null)

let upstreamRequest
const handler = createChatHandler({
    apiKey: 'server-only-key',
    openRouterApiKey: 'openrouter-server-key',
    fetchImpl: async (url, options) => {
        upstreamRequest = options
        if (url.includes('openrouter.ai')) {
            return new Response('data: {"choices":[{"delta":{"content":"亲密回复"}}]}\n\ndata: [DONE]\n\n', {
                headers: { 'Content-Type': 'text/event-stream' }
            })
        }
        return new Response('data: {"choices":[{"delta":{"content":"好"}}]}\n\ndata: [DONE]\n\n', {
            headers: { 'Content-Type': 'text/event-stream' }
        })
    }
})

const chunks = []
const request = {
    body: {
        conversationId: '12',
        messages: [{ role: 'user', content: '你好' }],
        memories: ['指挥官上周参加过考试。']
    }
}
const response = {
    statusCode: 200,
    status(code) {
        this.statusCode = code
        return this
    },
    set(headers) {
        this.headers = headers
        return this
    },
    json(body) {
        this.body = body
    },
    write(chunk) {
        chunks.push(Buffer.from(chunk))
    },
    end() {
        this.ended = true
    }
}

await handler(request, response)
const upstreamBody = JSON.parse(upstreamRequest.body)
assert.equal(upstreamRequest.headers.Authorization, 'Bearer server-only-key')
assert.equal(upstreamBody.messages[0].role, 'system')
assert.match(upstreamBody.messages[0].content, /禁止为了显得亲密、温柔或有记忆而编造共同经历/)
assert.match(upstreamBody.messages[1].content, /指挥官上周参加过考试/)
assert.match(upstreamBody.messages.at(-1).content, /^你好\n\n【回答前的事实校验】/)
assert.match(upstreamBody.messages.at(-1).content, /过去的 assistant 回复、动作描写和推测都不能证明事实/)
assert.equal(upstreamBody.temperature, 0.2)
assert.match(Buffer.concat(chunks).toString(), /好/)
assert.equal(response.ended, true)

const geminiChunks = []
const geminiResponse = {
    ...response,
    write(chunk) { geminiChunks.push(Buffer.from(chunk)) },
    end() { this.ended = true }
}
await handler({ body: {
    conversationId: '13',
    mode: 'intimate',
    messages: [{ role: 'user', content: '抱抱我' }],
    memories: []
} }, geminiResponse)
const geminiBody = JSON.parse(upstreamRequest.body)
assert.equal(upstreamRequest.headers.Authorization, 'Bearer openrouter-server-key')
assert.equal(geminiBody.model, 'google/gemini-3.5-flash-lite')
assert.equal(geminiBody.messages[1].role, 'user')
assert.match(geminiBody.messages[0].content, /成年人之间、自愿且私密/)
assert.deepEqual(geminiBody.provider, { zdr: true, data_collection: 'deny' })
assert.match(Buffer.concat(geminiChunks).toString(), /亲密回复/)

console.log('Chat privacy checks passed')

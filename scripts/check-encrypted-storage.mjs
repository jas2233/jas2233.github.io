import assert from 'node:assert/strict'
import { createConversationStore } from '../server/conversations.js'

let saved
const store = createConversationStore({
    async rpc(name, parameters) {
        assert.equal(name, 'lucia_append_message')
        saved = parameters
        return { status: 'ok', message: { id: '1' } }
    }
})

await assert.rejects(store.appendUserMessage('1', '这是明文'), /消息内容无效/)
await store.appendUserMessage('1', 'enc:v1:iv.ciphertext')
assert.equal(saved.p_content, 'enc:v1:iv.ciphertext')
assert.equal(saved.p_title, null)

console.log('Encrypted persistence checks passed')

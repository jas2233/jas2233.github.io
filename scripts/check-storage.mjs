import assert from 'node:assert/strict'
import {
    loadConversationHistory,
    loadSettings,
    MAX_CONVERSATION_MESSAGES,
    saveBackgroundPath,
    saveConversationHistory
} from '../src/services/storage.js'

const data = new Map()
const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
}

const history = Array.from({ length: MAX_CONVERSATION_MESSAGES + 5 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    content: String(index)
}))
saveConversationHistory(history, storage)
assert.equal(loadConversationHistory(storage).length, MAX_CONVERSATION_MESSAGES)
assert.equal(loadConversationHistory(storage)[0].content, '5')

data.set('deepseek_api_key', 'legacy-key')
saveBackgroundPath('picture/test.jpg', storage)
assert.deepEqual(loadSettings(storage), {
    backgroundPath: 'picture/test.jpg'
})
assert.equal(data.has('deepseek_api_key'), false)

console.log('Storage checks passed')

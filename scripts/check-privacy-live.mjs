import assert from 'node:assert/strict'
import { db } from '../server/db.js'

const envId = process.env.CLOUDBASE_ENV_ID
const apiKey = process.env.CLOUDBASE_API_KEY
const baseUrl = `https://${envId}.api.tcloudbasegateway.com/v1/rdb/rest`

async function rows(table, columns) {
    const response = await fetch(`${baseUrl}/${table}?select=${columns}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000)
    })
    if (!response.ok) throw new Error(`读取 ${table} 失败（${response.status}）`)
    return response.json()
}

const [messages, memories, conversations, config] = await Promise.all([
    rows('messages', 'id,content'),
    rows('memories', 'id,content,fingerprint'),
    rows('conversations', 'id,title'),
    db.rpc('lucia_get_encryption_config')
])

const encryptedMessages = messages.filter(item => item.content.startsWith('enc:v1:')).length
const encryptedMemories = memories.filter(item =>
    item.content.startsWith('enc:v1:') && item.fingerprint
).length

assert.ok(config?.salt && config?.verifier?.startsWith('enc:v1:'), '尚未创建浏览器加密配置')
assert.equal(encryptedMessages, messages.length, '数据库中仍有明文消息')
assert.equal(encryptedMemories, memories.length, '数据库中仍有明文长期记忆')
assert.ok(conversations.every(item => item.title === '私密对话'), '对话标题仍泄露正文')

console.log(JSON.stringify({
    messages: { total: messages.length, encrypted: encryptedMessages, plaintext: 0 },
    memories: { total: memories.length, encrypted: encryptedMemories, plaintext: 0 },
    titlesPrivate: true,
    encryptionConfig: true
}, null, 2))

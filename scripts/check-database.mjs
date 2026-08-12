import assert from 'node:assert/strict'
import { db } from '../server/db.js'

assert.equal(await db.rpc('lucia_health'), true)
const conversations = await db.rpc('lucia_list_conversations')
assert.ok(Array.isArray(conversations))
assert.ok(conversations.every(item => item.title === '私密对话'))
assert.ok(conversations.every(item => Object.hasOwn(item, 'mode_tag')))
const encryptionConfig = await db.rpc('lucia_get_encryption_config')
assert.ok(encryptionConfig === null || (encryptionConfig.salt && encryptionConfig.verifier))
assert.ok(Array.isArray(await db.rpc('lucia_list_legacy_memories')))
console.log('CloudBase database checks passed')

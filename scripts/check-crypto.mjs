import assert from 'node:assert/strict'
import { createVault, createVerifier, isEncrypted, verifyVault } from '../src/services/crypto.js'

const vault = await createVault('correct horse battery staple')
const ciphertext = await vault.encrypt('昨天跑了三公里')
assert.equal(isEncrypted(ciphertext), true)
assert.equal(await vault.decrypt(ciphertext), '昨天跑了三公里')
assert.equal(
    await vault.fingerprint('昨天跑了三公里'),
    await vault.fingerprint('昨天跑了三公里')
)

const verifier = await createVerifier(vault)
const restored = await createVault('correct horse battery staple', vault.salt)
await verifyVault(restored, verifier)
await assert.rejects(
    verifyVault(await createVault('wrong password', vault.salt), verifier),
    /记忆密码错误/
)

console.log('Browser encryption checks passed')

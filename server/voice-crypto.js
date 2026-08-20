import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function readKey(value) {
    const key = Buffer.from(String(value || ''), 'base64')
    if (key.length !== 32) throw new Error('VOICE_TASK_KEY 必须是 32 字节的 Base64 密钥')
    return key
}

export function createVoiceCipher(keyValue) {
    const key = readKey(keyValue)
    return {
        encrypt(text) {
            const iv = randomBytes(12)
            const cipher = createCipheriv('aes-256-gcm', key, iv)
            const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
            return {
                ciphertext: ciphertext.toString('base64'),
                iv: Buffer.from(iv).toString('base64'),
                tag: cipher.getAuthTag().toString('base64')
            }
        },
        decrypt({ ciphertext, iv, tag }) {
            const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
            decipher.setAuthTag(Buffer.from(tag, 'base64'))
            return Buffer.concat([
                decipher.update(Buffer.from(ciphertext, 'base64')),
                decipher.final()
            ]).toString('utf8')
        }
    }
}

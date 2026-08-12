const PREFIX = 'enc:v1:'
const CHECK_TEXT = 'lucia-memory-v1'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const toBase64 = bytes => {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
}

const fromBase64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0))

async function deriveKeys(password, salt) {
    const material = await crypto.subtle.importKey(
        'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    )
    const bits = new Uint8Array(await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations: 250_000
    }, material, 512))
    const encryptionKey = await crypto.subtle.importKey(
        'raw', bits.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    )
    const fingerprintKey = await crypto.subtle.importKey(
        'raw', bits.slice(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    bits.fill(0)
    return { encryptionKey, fingerprintKey }
}

export const isEncrypted = value => typeof value === 'string' && value.startsWith(PREFIX)

export async function createVault(password, saltBase64) {
    if (typeof password !== 'string' || password.length < 8) {
        throw new Error('记忆密码至少需要 8 个字符')
    }
    const salt = saltBase64 ? fromBase64(saltBase64) : crypto.getRandomValues(new Uint8Array(16))
    const keys = await deriveKeys(password, salt)

    return {
        salt: toBase64(salt),

        async encrypt(plaintext) {
            if (typeof plaintext !== 'string' || !plaintext.length) throw new Error('不能加密空内容')
            const iv = crypto.getRandomValues(new Uint8Array(12))
            const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv }, keys.encryptionKey, encoder.encode(plaintext)
            ))
            return `${PREFIX}${toBase64(iv)}.${toBase64(ciphertext)}`
        },

        async decrypt(payload) {
            if (!isEncrypted(payload)) throw new Error('发现未加密的数据')
            const [iv, ciphertext] = payload.slice(PREFIX.length).split('.')
            if (!iv || !ciphertext) throw new Error('加密数据格式无效')
            try {
                const plaintext = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: fromBase64(iv) },
                    keys.encryptionKey,
                    fromBase64(ciphertext)
                )
                return decoder.decode(plaintext)
            } catch {
                throw new Error('记忆密码错误，或加密数据已经损坏')
            }
        },

        async fingerprint(plaintext) {
            const signature = await crypto.subtle.sign(
                'HMAC', keys.fingerprintKey, encoder.encode(plaintext.trim())
            )
            return toBase64(new Uint8Array(signature))
        }
    }
}

export async function createVerifier(vault) {
    return vault.encrypt(CHECK_TEXT)
}

export async function verifyVault(vault, verifier) {
    if (await vault.decrypt(verifier) !== CHECK_TEXT) throw new Error('记忆密码错误')
}

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000
const MAX_LOGIN_ATTEMPTS = 10
const LOCK_TIME_MS = 5 * 60 * 1000

const digest = value => createHash('sha256').update(String(value)).digest()
const sign = (expiresAt, password) =>
    createHmac('sha256', password).update(String(expiresAt)).digest('hex')

function safeEqual(left, right) {
    const leftBuffer = Buffer.isBuffer(left) ? left : Buffer.from(String(left))
    const rightBuffer = Buffer.isBuffer(right) ? right : Buffer.from(String(right))
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function verifyPassword(candidate, expected) {
    return safeEqual(digest(candidate), digest(expected))
}

export function createAccessToken(password, now = Date.now()) {
    const expiresAt = now + TOKEN_TTL_MS
    return `${expiresAt}.${sign(expiresAt, password)}`
}

export function verifyAccessToken(token, password, now = Date.now()) {
    const [expiresAtText, signature, extra] = String(token || '').split('.')
    const expiresAt = Number(expiresAtText)
    if (extra || !Number.isSafeInteger(expiresAt) || expiresAt <= now) return false
    return safeEqual(signature, sign(expiresAt, password))
}

export function createAuth(accessPassword) {
    if (!accessPassword) throw new Error('缺少 ACCESS_PASSWORD 环境变量')

    // ponytail: 单实例内存限流；扩展为多实例时改用共享存储。
    const failedLogins = new Map()

    function login(request, response) {
        const now = Date.now()
        const key = request.ip
        const attempt = failedLogins.get(key)

        if (attempt?.lockedUntil > now) {
            response.status(429).json({ error: '尝试次数过多，请稍后再试' })
            return
        }

        const password = typeof request.body?.password === 'string'
            ? request.body.password
            : ''

        if (!verifyPassword(password, accessPassword)) {
            const lockExpired = attempt?.lockedUntil > 0 && attempt.lockedUntil <= now
            const count = lockExpired ? 1 : (attempt?.count || 0) + 1
            failedLogins.set(key, {
                count,
                lockedUntil: count >= MAX_LOGIN_ATTEMPTS ? now + LOCK_TIME_MS : 0
            })
            response.status(401).json({ error: '访问密码不正确' })
            return
        }

        failedLogins.delete(key)
        response.json({ token: createAccessToken(accessPassword) })
    }

    function requireAccess(request, response, next) {
        const authorization = request.get('authorization') || ''
        const token = authorization.startsWith('Bearer ')
            ? authorization.slice(7)
            : ''

        if (!verifyAccessToken(token, accessPassword)) {
            response.status(401).json({ error: '访问已过期，请重新解锁' })
            return
        }

        next()
    }

    return { login, requireAccess }
}

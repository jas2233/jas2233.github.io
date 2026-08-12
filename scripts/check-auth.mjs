import assert from 'node:assert/strict'
import {
    createAuth,
    createAccessToken,
    verifyAccessToken,
    verifyPassword
} from '../server/auth.js'

const password = 'a-long-private-password'
const now = 1_000_000
const token = createAccessToken(password, now)

assert.equal(verifyPassword(password, password), true)
assert.equal(verifyPassword('wrong', password), false)
assert.equal(verifyAccessToken(token, password, now), true)
assert.equal(verifyAccessToken(token, 'wrong', now), false)
assert.equal(verifyAccessToken(`${token}changed`, password, now), false)
assert.equal(verifyAccessToken(token, password, now + 12 * 60 * 60 * 1000), false)
assert.doesNotThrow(() => createAuth('short'))

const auth = createAuth(password)
const request = { ip: 'test-client', body: { password: 'wrong' } }
const createResponse = () => ({
    statusCode: 200,
    status(code) {
        this.statusCode = code
        return this
    },
    json(body) {
        this.body = body
    }
})

for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = createResponse()
    auth.login(request, response)
    assert.equal(response.statusCode, 401)
}

const lockedResponse = createResponse()
auth.login(request, lockedResponse)
assert.equal(lockedResponse.statusCode, 429)

console.log('Auth checks passed')

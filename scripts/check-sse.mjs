import assert from 'node:assert/strict'
import { parseSSELine } from '../src/services/sse.js'

assert.equal(parseSSELine(': keep-alive'), null)
assert.equal(parseSSELine('data: [DONE]'), null)
assert.equal(parseSSELine('data: {"choices":[{"delta":{"content":"露西亚"}}]}'), '露西亚')
assert.equal(parseSSELine('data: {"choices":[]}'), '')

console.log('SSE parser checks passed')

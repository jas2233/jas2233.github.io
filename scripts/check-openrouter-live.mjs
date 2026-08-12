import assert from 'node:assert/strict'

const apiKey = process.env.OPENROUTER_API_KEY
const model = process.env.OPENROUTER_MODEL || 'google/gemini-3.5-flash-lite'

assert.ok(apiKey, '请先在 .env 中填写 OPENROUTER_API_KEY')

const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: '只回复 OK' }],
        max_tokens: 8,
        provider: { zdr: true, data_collection: 'deny' }
    })
})

const result = await response.json().catch(() => ({}))
assert.equal(response.ok, true, result.error?.message || `OpenRouter HTTP ${response.status}`)
assert.ok(result.choices?.[0]?.message?.content, 'OpenRouter 没有返回文本')
console.log(`OpenRouter live check passed (${model})`)

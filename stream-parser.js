function parseSSELine(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return null;

    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return null;

    const payload = JSON.parse(data);
    return payload.choices?.[0]?.delta?.content || '';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = parseSSELine;

    if (require.main === module) {
        const assert = require('node:assert/strict');
        assert.equal(parseSSELine(': keep-alive'), null);
        assert.equal(parseSSELine('data: [DONE]'), null);
        assert.equal(parseSSELine('data: {"choices":[{"delta":{"content":"露西亚"}}]}'), '露西亚');
        assert.equal(parseSSELine('data: {"choices":[]}'), '');
        console.log('stream parser checks passed');
    }
}

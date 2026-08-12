export function parseSSELine(line) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return null

    const data = trimmed.slice(5).trim()
    if (!data || data === '[DONE]') return null

    const payload = JSON.parse(data)
    return payload.choices?.[0]?.delta?.content || ''
}

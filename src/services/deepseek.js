import { API_BASE_URL, clearAccess, getAccessToken } from './auth.js'
import { parseSSELine } from './sse.js'

export async function streamDeepSeekReply({ conversationId, mode = 'daily', messages, memories = [], onReady, onDelta }) {
    const token = getAccessToken()
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ conversationId, mode, messages, memories })
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        if (response.status === 401) clearAccess()
        const requestError = new Error(error.error || response.statusText || '后端请求失败')
        requestError.status = response.status
        throw requestError
    }
    if (!response.body) throw new Error('当前浏览器不支持流式响应')

    onReady()

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let reply = ''

    const appendLine = line => {
        const content = parseSSELine(line)
        if (!content) return
        reply += content
        onDelta(content, reply)
    }

    while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''
        lines.forEach(appendLine)
    }

    buffer += decoder.decode()
    if (buffer) buffer.split(/\r?\n/).forEach(appendLine)
    if (!reply.trim()) throw new Error('API 没有返回有效内容')

    return reply
}

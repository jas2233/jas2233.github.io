import { API_BASE_URL, clearAccess, getAccessToken } from './auth.js'

async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers
        }
    })
    if (response.status === 401) clearAccess()
    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const error = new Error(body.error || response.statusText || '读取对话失败')
        error.status = response.status
        throw error
    }
    return response.status === 204 ? null : response.json()
}

export async function listConversations() {
    return (await request('/api/conversations')).conversations
}

export async function createConversation(modeTag) {
    return (await request('/api/conversations', {
        method: 'POST', body: JSON.stringify({ modeTag })
    })).conversation
}

export async function importLegacyConversation(messages, modeTag) {
    return (await request('/api/conversations/import', {
        method: 'POST',
        body: JSON.stringify({ messages, modeTag })
    })).conversation
}

export async function loadConversationMessages(id) {
    return (await request(`/api/conversations/${id}/messages`)).messages
}

export async function appendConversationMessage(id, role, content) {
    return (await request(`/api/conversations/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ role, content })
    })).message
}

export async function deleteConversation(id) {
    await request(`/api/conversations/${id}`, { method: 'DELETE' })
}

export async function renameConversation(id, title) {
    return (await request(`/api/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title })
    })).conversation
}

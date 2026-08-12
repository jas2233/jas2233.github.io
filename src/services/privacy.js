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
        const error = new Error(body.error || response.statusText || '隐私服务请求失败')
        error.status = response.status
        throw error
    }
    return response.status === 204 ? null : response.json()
}

export const getEncryptionConfig = () => request('/api/encryption/config')

export const setEncryptionConfig = config => request('/api/encryption/config', {
    method: 'POST', body: JSON.stringify(config)
})

export const listLegacyMemories = async () =>
    (await request('/api/encryption/legacy-memories')).memories

export const migrateEncryptedData = data => request('/api/encryption/migrate', {
    method: 'POST', body: JSON.stringify(data)
})

export const assignLegacyScope = modeTag => request('/api/encryption/scope', {
    method: 'POST', body: JSON.stringify({ modeTag })
})

export const recallMemories = async (query, scopeTag) =>
    (await request('/api/memories/recall', {
        method: 'POST', body: JSON.stringify({ query, scopeTag })
    })).memories

export const prepareMemories = async (content, mode) =>
    (await request('/api/memories/prepare', {
        method: 'POST', body: JSON.stringify({ content, mode })
    })).memories

export const saveMemories = (sourceMessageId, scopeTag, memories) => request('/api/memories', {
    method: 'POST', body: JSON.stringify({ sourceMessageId, scopeTag, memories })
})

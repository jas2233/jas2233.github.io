const defaultApiBaseUrl = import.meta.env.DEV ? 'http://localhost:3000' : ''
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl).replace(/\/$/, '')
const TOKEN_KEY = 'lucia_access_token'

export const getAccessToken = () => sessionStorage.getItem(TOKEN_KEY) || ''

export function clearAccess() {
    sessionStorage.removeItem(TOKEN_KEY)
}

async function readResponse(response) {
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || '后端请求失败')
    return body
}

export async function unlockAccess(password) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    })
    const { token } = await readResponse(response)
    sessionStorage.setItem(TOKEN_KEY, token)
}

export async function restoreAccess() {
    const token = getAccessToken()
    if (!token) return false

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/session`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (response.status === 401) {
            clearAccess()
            return false
        }
        await readResponse(response)
        return true
    } catch (error) {
        if (error instanceof TypeError) throw new Error('无法连接私人后端，请检查服务是否已启动')
        throw error
    }
}

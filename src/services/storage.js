export const MAX_CONVERSATION_MESSAGES = 400

const KEYS = {
    history: 'conversation_history',
    background: 'selected_background'
}
const LEGACY_API_KEY = 'deepseek_api_key'

const isMessage = message =>
    ['user', 'assistant'].includes(message?.role) && typeof message.content === 'string'

function read(storage, key) {
    try {
        return storage?.getItem(key) || ''
    } catch (error) {
        console.error(`读取 ${key} 失败:`, error)
        return ''
    }
}

function write(storage, key, value) {
    try {
        storage?.setItem(key, value)
    } catch (error) {
        console.error(`保存 ${key} 失败:`, error)
    }
}

export function loadConversationHistory(storage = globalThis.localStorage) {
    try {
        const parsed = JSON.parse(read(storage, KEYS.history) || '[]')
        return Array.isArray(parsed)
            ? parsed.filter(isMessage).slice(-MAX_CONVERSATION_MESSAGES)
            : []
    } catch (error) {
        console.error('解析会话历史失败:', error)
        return []
    }
}

export function saveConversationHistory(history, storage = globalThis.localStorage) {
    const safeHistory = Array.isArray(history)
        ? history.filter(isMessage).slice(-MAX_CONVERSATION_MESSAGES)
        : []
    write(storage, KEYS.history, JSON.stringify(safeHistory))
    return safeHistory
}

export function clearConversationHistory(storage = globalThis.localStorage) {
    try {
        storage?.removeItem(KEYS.history)
    } catch (error) {
        console.error('清除旧对话历史失败:', error)
    }
}

export function loadSettings(storage = globalThis.localStorage) {
    try {
        storage?.removeItem(LEGACY_API_KEY)
    } catch (error) {
        console.error('清除旧 API Key 失败:', error)
    }
    return {
        backgroundPath: read(storage, KEYS.background)
    }
}

export function saveBackgroundPath(path, storage = globalThis.localStorage) {
    write(storage, KEYS.background, path)
}

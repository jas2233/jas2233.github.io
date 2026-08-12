import express from 'express'

export const MAX_CONVERSATION_MESSAGES = 400
const MAX_MESSAGE_CHARS = 20_000
const ENCRYPTED_PREFIX = 'enc:v1:'

function normalizeConversationId(value) {
    const id = String(value || '')
    return /^\d+$/.test(id) ? id : null
}

function normalizeEncryptedContent(value) {
    if (typeof value !== 'string') return null
    const content = value.trim()
    return content.startsWith(ENCRYPTED_PREFIX) && content.length <= MAX_MESSAGE_CHARS ? content : null
}

function normalizeModeTag(value) {
    return typeof value === 'string' && value.length >= 20 && value.length <= 100 ? value : null
}

function normalizeConversationTitle(value) {
    if (typeof value !== 'string') return null
    const title = value.trim()
    return title.length >= 1 && title.length <= 80 ? title : null
}

function normalizeLegacyMessages(messages) {
    if (!Array.isArray(messages)) return []
    return messages
        .filter(message => ['user', 'assistant'].includes(message?.role))
        .map(message => ({ role: message.role, content: normalizeEncryptedContent(message.content) }))
        .filter(message => message.content)
        .slice(-MAX_CONVERSATION_MESSAGES)
}

function notFound() {
    const error = new Error('没有找到这条对话')
    error.status = 404
    return error
}

export function createConversationStore(database) {
    async function appendMessage(rawId, rawContent, role) {
        const id = normalizeConversationId(rawId)
        const content = normalizeEncryptedContent(rawContent)
        if (!id || !content) {
            const error = new Error(role === 'user' ? '消息内容无效' : '露西亚的回复内容无效')
            error.status = 400
            throw error
        }

        const result = await database.rpc('lucia_append_message', {
            p_conversation_id: id,
            p_role: role,
            p_content: content,
            p_title: null
        })
        if (result?.status === 'not_found') throw notFound()
        if (result?.status === 'full') {
            const error = new Error('当前对话已达到 400 条，请新建对话后继续')
            error.status = 409
            throw error
        }
        if (!result?.message) throw new Error('CloudBase 没有返回已保存的消息')
        return result.message
    }

    return {
        async list() {
            return await database.rpc('lucia_list_conversations') || []
        },

        async create(rawModeTag) {
            const modeTag = normalizeModeTag(rawModeTag)
            if (!modeTag) {
                const error = new Error('对话模式无效')
                error.status = 400
                throw error
            }
            return database.rpc('lucia_create_scoped_conversation', { p_mode_tag: modeTag })
        },

        async importLegacy(rawMessages, rawModeTag) {
            const messages = normalizeLegacyMessages(rawMessages)
            const modeTag = normalizeModeTag(rawModeTag)
            if (!messages.length || !modeTag) return null

            return database.rpc('lucia_import_scoped_legacy_conversation', {
                p_mode_tag: modeTag,
                p_messages: messages
            })
        },

        async getMessages(rawId) {
            const id = normalizeConversationId(rawId)
            if (!id) throw notFound()
            const messages = await database.rpc('lucia_get_messages', {
                p_conversation_id: id
            })
            if (messages === null) throw notFound()
            return messages
        },

        async delete(rawId) {
            const id = normalizeConversationId(rawId)
            if (!id) throw notFound()
            const deleted = await database.rpc('lucia_delete_conversation', {
                p_conversation_id: id
            })
            if (!deleted) throw notFound()
        },

        async rename(rawId, rawTitle) {
            const id = normalizeConversationId(rawId)
            const title = normalizeConversationTitle(rawTitle)
            if (!id || !title) {
                const error = new Error('对话名称需要 1 到 80 个字符')
                error.status = 400
                throw error
            }
            const result = await database.rpc('lucia_rename_conversation', {
                p_conversation_id: id,
                p_title: title
            })
            if (result?.status === 'not_found') throw notFound()
            if (!result?.conversation) throw new Error('没有返回已重命名的对话')
            return result.conversation
        },

        async appendUserMessage(rawId, rawContent) {
            return appendMessage(rawId, rawContent, 'user')
        },

        async appendAssistantMessage(rawId, rawContent) {
            return appendMessage(rawId, rawContent, 'assistant')
        },

        async removeMessage(messageId) {
            if (!/^\d+$/.test(String(messageId || ''))) return
            await database.rpc('lucia_remove_message', { p_message_id: String(messageId) })
        }
    }
}

export function createConversationRouter(store) {
    const router = express.Router()
    router.get('/', async (_request, response) => response.json({ conversations: await store.list() }))
    router.post('/', async (request, response) => response.status(201).json({
        conversation: await store.create(request.body?.modeTag)
    }))
    router.post('/import', async (request, response) => {
        const conversation = await store.importLegacy(request.body?.messages, request.body?.modeTag)
        response.status(conversation ? 201 : 200).json({ conversation })
    })
    router.patch('/:id', async (request, response) => {
        response.json({ conversation: await store.rename(request.params.id, request.body?.title) })
    })
    router.get('/:id/messages', async (request, response) => {
        response.json({ messages: await store.getMessages(request.params.id) })
    })
    router.post('/:id/messages', async (request, response) => {
        const append = request.body?.role === 'user'
            ? store.appendUserMessage
            : request.body?.role === 'assistant'
                ? store.appendAssistantMessage
                : null
        if (!append) {
            response.status(400).json({ error: '消息角色无效' })
            return
        }
        response.status(201).json({ message: await append(request.params.id, request.body?.content) })
    })
    router.delete('/:id', async (request, response) => {
        await store.delete(request.params.id)
        response.sendStatus(204)
    })
    return router
}

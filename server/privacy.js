import express from 'express'

const isCiphertext = value => typeof value === 'string' && value.startsWith('enc:v1:')

export function createPrivacyRouter(database) {
    const router = express.Router()

    router.get('/config', async (_request, response) => {
        response.json({ config: await database.rpc('lucia_get_encryption_config') })
    })

    router.post('/config', async (request, response) => {
        const salt = typeof request.body?.salt === 'string' ? request.body.salt : ''
        const verifier = request.body?.verifier
        if (!/^[A-Za-z0-9+/]{20,30}={0,2}$/.test(salt) || !isCiphertext(verifier)) {
            response.status(400).json({ error: '加密配置无效' })
            return
        }
        response.status(201).json({
            config: await database.rpc('lucia_set_encryption_config', {
                p_salt: salt,
                p_verifier: verifier
            })
        })
    })

    router.get('/legacy-memories', async (_request, response) => {
        response.json({ memories: await database.rpc('lucia_list_legacy_memories') || [] })
    })

    router.post('/scope', async (request, response) => {
        const modeTag = typeof request.body?.modeTag === 'string' ? request.body.modeTag : ''
        if (modeTag.length < 20 || modeTag.length > 100) {
            response.status(400).json({ error: '记忆空间无效' })
            return
        }
        response.json(await database.rpc('lucia_assign_legacy_scope', { p_mode_tag: modeTag }))
    })

    router.post('/migrate', async (request, response) => {
        const messages = Array.isArray(request.body?.messages) ? request.body.messages : []
        const memories = Array.isArray(request.body?.memories) ? request.body.memories : []
        const validMessages = messages.length <= 4000 && messages.every(item =>
            /^\d+$/.test(String(item?.id || '')) && isCiphertext(item?.content)
        )
        const validMemories = memories.length <= 1000 && memories.every(item =>
            /^\d+$/.test(String(item?.id || '')) &&
            isCiphertext(item?.content) &&
            typeof item?.fingerprint === 'string' && item.fingerprint.length <= 100
        )
        if (!validMessages || !validMemories) {
            response.status(400).json({ error: '迁移数据无效' })
            return
        }
        response.json(await database.rpc('lucia_migrate_encrypted_data', {
            p_messages: messages,
            p_memories: memories
        }))
    })

    return router
}

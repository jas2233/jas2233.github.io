import express from 'express'
import { verifyPassword } from './auth.js'

const TARGETS = new Set(['computer', 'mobile'])
const TASK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function httpError(status, message) {
    const error = new Error(message)
    error.status = status
    return error
}

export function createVoiceService({ database, cipher, storage }) {
    return {
        async create({ messageId, text, playTarget }) {
            const normalizedText = typeof text === 'string' ? text.trim() : ''
            if (!/^\d+$/.test(String(messageId || ''))) throw httpError(400, '消息编号无效')
            if (!normalizedText || normalizedText.length > 2000) throw httpError(400, '朗读文字需要为 1 到 2000 个字符')
            if (!TARGETS.has(playTarget)) throw httpError(400, '播放目标无效')
            const encrypted = cipher.encrypt(normalizedText)
            const result = await database.rpc('lucia_create_voice_task', {
                p_message_id: String(messageId),
                p_play_target: playTarget,
                p_text_ciphertext: encrypted.ciphertext,
                p_text_iv: encrypted.iv,
                p_text_tag: encrypted.tag
            })
            if (result?.status === 'not_found') throw httpError(404, '没有找到这条露西亚回复')
            return result.task
        },
        async get(taskId) {
            if (!TASK_ID.test(String(taskId || ''))) throw httpError(404, '没有找到语音任务')
            const task = await database.rpc('lucia_get_voice_task', { p_task_id: taskId })
            if (!task) throw httpError(404, '没有找到语音任务')
            if (task.status === 'completed' && task.play_target === 'mobile' && task.audio_path) {
                task.audio_url = await storage.createDownloadUrl(task.audio_path)
            }
            return task
        },
        async claim(workerId) {
            const task = await database.rpc('lucia_claim_voice_task', { p_worker_id: workerId })
            if (!task) return null
            return {
                id: task.id,
                play_target: task.play_target,
                text: cipher.decrypt({
                    ciphertext: task.text_ciphertext,
                    iv: task.text_iv,
                    tag: task.text_tag
                })
            }
        },
        async createUpload(taskId, workerId) {
            if (!TASK_ID.test(String(taskId || ''))) throw httpError(404, '没有找到语音任务')
            const result = await database.rpc('lucia_prepare_voice_upload', {
                p_task_id: taskId, p_worker_id: workerId
            })
            if (result?.status !== 'ok') throw httpError(409, '当前任务不能上传音频')
            return { path: result.audio_path, upload_url: await storage.createUploadUrl(result.audio_path) }
        },
        async complete(taskId, workerId, audioPath = null) {
            const result = await database.rpc('lucia_complete_voice_task', {
                p_task_id: taskId, p_worker_id: workerId, p_audio_path: audioPath
            })
            if (!result) throw httpError(409, '当前任务不能标记为完成')
        },
        async fail(taskId, workerId, message) {
            await database.rpc('lucia_fail_voice_task', {
                p_task_id: taskId,
                p_worker_id: workerId,
                p_error: String(message || '未知错误').slice(0, 1000)
            })
        }
    }
}

export function createVoiceRouter(service) {
    const router = express.Router()
    router.post('/tasks', async (request, response) => response.status(201).json({
        task: await service.create(request.body || {})
    }))
    router.get('/tasks/:id', async (request, response) => response.json({
        task: await service.get(request.params.id)
    }))
    return router
}

export function createVoiceWorkerRouter(service, token) {
    if (!token) throw new Error('缺少 VOICE_WORKER_TOKEN 环境变量')
    const router = express.Router()
    router.use((request, response, next) => {
        const authorization = request.get('authorization') || ''
        const candidate = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
        if (!verifyPassword(candidate, token)) return response.status(401).json({ error: 'Worker 令牌无效' })
        next()
    })
    const workerId = request => String(request.get('x-worker-id') || '').trim().slice(0, 80)
    router.post('/claim', async (request, response) => {
        const id = workerId(request)
        if (!id) return response.status(400).json({ error: '缺少 Worker ID' })
        const task = await service.claim(id)
        return task ? response.json({ task }) : response.sendStatus(204)
    })
    router.post('/tasks/:id/upload-url', async (request, response) => response.json(
        await service.createUpload(request.params.id, workerId(request))
    ))
    router.post('/tasks/:id/complete', async (request, response) => {
        await service.complete(request.params.id, workerId(request), request.body?.audioPath || null)
        response.sendStatus(204)
    })
    router.post('/tasks/:id/fail', async (request, response) => {
        await service.fail(request.params.id, workerId(request), request.body?.error)
        response.sendStatus(204)
    })
    return router
}

import { request } from './conversations.js'

export async function createVoiceTask(messageId, text, playTarget) {
    return (await request('/api/voice/tasks', {
        method: 'POST',
        body: JSON.stringify({ messageId, text, playTarget })
    })).task
}

export async function getVoiceTask(id) {
    return (await request(`/api/voice/tasks/${id}`)).task
}

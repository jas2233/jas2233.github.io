import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createVoiceCipher } from '../server/voice-crypto.js'
import { createVoiceService } from '../server/voice.js'
import { createVoiceStorage } from '../server/voice-storage.js'
import { getWorkerConfig } from './voice-worker.mjs'

const cipher = createVoiceCipher(randomBytes(32).toString('base64'))
const sealed = cipher.encrypt('指挥官，我已经准备好了。')
assert.equal(cipher.decrypt(sealed), '指挥官，我已经准备好了。')
assert.throws(() => cipher.decrypt({ ...sealed, tag: Buffer.alloc(16).toString('base64') }))

const taskId = '123e4567-e89b-42d3-a456-426614174000'
const calls = []
const database = {
    async rpc(name, parameters) {
        calls.push({ name, parameters })
        if (name === 'lucia_create_voice_task') return { status: 'ok', task: { id: taskId, status: 'pending' } }
        if (name === 'lucia_claim_voice_task') return { id: taskId, play_target: 'computer', text_ciphertext: sealed.ciphertext, text_iv: sealed.iv, text_tag: sealed.tag }
        if (name === 'lucia_get_voice_task') return { id: taskId, status: 'completed', play_target: 'mobile', audio_path: `tasks/${taskId}.wav` }
        return true
    }
}
const storage = {
    createDownloadUrl: async () => 'https://example.test/signed.wav',
    createUploadUrl: async () => 'https://example.test/upload'
}
const service = createVoiceService({ database, cipher, storage })
assert.equal((await service.create({ messageId: '12', text: '测试', playTarget: 'computer' })).status, 'pending')
assert.equal((await service.claim('pc-1')).text, '指挥官，我已经准备好了。')
assert.equal((await service.get(taskId)).audio_url, 'https://example.test/signed.wav')
await assert.rejects(() => service.create({ messageId: '12', text: '', playTarget: 'computer' }), /1 到 2000/)

const requested = []
const voiceStorage = createVoiceStorage({
    url: 'https://project.supabase.co',
    serviceRoleKey: 'secret',
    bucket: 'voice-audio',
    fetchImpl: async url => {
        requested.push(url)
        return { ok: true, json: async () => ({ url: '/object/upload/sign/voice-audio/tasks/a.wav?token=x' }) }
    }
})
assert.equal(await voiceStorage.createUploadUrl('tasks/a.wav'), 'https://project.supabase.co/storage/v1/object/upload/sign/voice-audio/tasks/a.wav?token=x')
assert.match(requested[0], /storage\/v1\/object\/upload\/sign/)
assert.equal(calls[0].name, 'lucia_create_voice_task')

const workerConfig = getWorkerConfig({
    LUCIA_API_BASE_URL: 'https://example.test/',
    VOICE_WORKER_TOKEN: 'token'
})
assert.equal(workerConfig.gptWeight, 'C:\\GPT-SoVITS_V4_250424\\GPT_weights_v4\\lucia0819-e5.ckpt')
assert.equal(workerConfig.sovitsWeight, 'C:\\GPT-SoVITS_V4_250424\\SoVITS_weights_v4\\lucia0819_e1_s162_l32.pth')
assert.equal(workerConfig.pollInterval, 2000)

console.log('Voice checks passed')

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'

const defaults = {
    workerId: 'lucia-pc-01',
    gptUrl: 'http://127.0.0.1:9880',
    gptWeight: 'C:\\GPT-SoVITS_V4_250424\\GPT_weights_v4\\lucia0819-e5.ckpt',
    sovitsWeight: 'C:\\GPT-SoVITS_V4_250424\\SoVITS_weights_v4\\lucia0819_e1_s162_l32.pth',
    refAudio: 'C:\\GPT-SoVITS_V4_250424\\output\\slicer_opt\\誓焰语音.wav_0000680576_0000790816.wav',
    promptText: '无论什么时候，你都会给我这样的认可。'
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

export function getWorkerConfig(env = process.env) {
    const config = {
        apiBaseUrl: String(env.LUCIA_API_BASE_URL || '').replace(/\/$/, ''),
        token: env.VOICE_WORKER_TOKEN || '',
        workerId: env.VOICE_WORKER_ID || defaults.workerId,
        pollInterval: Number(env.VOICE_POLL_INTERVAL_MS || 2000),
        gptUrl: String(env.GPT_SOVITS_URL || defaults.gptUrl).replace(/\/$/, ''),
        gptWeight: env.GPT_SOVITS_GPT_WEIGHT || defaults.gptWeight,
        sovitsWeight: env.GPT_SOVITS_SOVITS_WEIGHT || defaults.sovitsWeight,
        refAudio: env.GPT_SOVITS_REF_AUDIO || defaults.refAudio,
        promptText: env.GPT_SOVITS_PROMPT_TEXT || defaults.promptText
    }
    if (!config.apiBaseUrl) throw new Error('缺少 LUCIA_API_BASE_URL')
    if (!config.token) throw new Error('缺少 VOICE_WORKER_TOKEN')
    if (!Number.isFinite(config.pollInterval) || config.pollInterval < 500) throw new Error('VOICE_POLL_INTERVAL_MS 不能小于 500')
    return config
}

async function readError(response) {
    const body = await response.json().catch(() => ({}))
    return body.error || body.message || `${response.status} ${response.statusText}`
}

async function api(config, path, body) {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.token}`,
            'X-Worker-ID': config.workerId,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000)
    })
    if (!response.ok && response.status !== 204) throw new Error(`Vercel：${await readError(response)}`)
    return response.status === 204 ? null : response.json()
}

async function setWeight(config, endpoint, path) {
    const response = await fetch(`${config.gptUrl}/${endpoint}?weights_path=${encodeURIComponent(path)}`, {
        signal: AbortSignal.timeout(120_000)
    })
    if (!response.ok) throw new Error(`GPT-SoVITS 模型切换失败：${await readError(response)}`)
}

export async function prepareGptSoVits(config) {
    try {
        await fetch(config.gptUrl, { signal: AbortSignal.timeout(5000) })
    } catch {
        throw new Error(`无法连接 GPT-SoVITS：${config.gptUrl}`)
    }
    console.log('正在加载 Lucia SoVITS e1...')
    await setWeight(config, 'set_sovits_weights', config.sovitsWeight)
    console.log('正在加载 Lucia GPT e5...')
    await setWeight(config, 'set_gpt_weights', config.gptWeight)
}

export async function synthesize(config, text) {
    const response = await fetch(`${config.gptUrl}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
            text,
            text_lang: 'zh',
            ref_audio_path: config.refAudio,
            prompt_lang: 'zh',
            prompt_text: config.promptText,
            text_split_method: 'cut5',
            sample_steps: 32,
            speed_factor: 0.9,
            fragment_interval: 0.3,
            top_k: 100,
            top_p: 0.85,
            temperature: 0.85,
            media_type: 'wav',
            streaming_mode: false
        }),
        signal: AbortSignal.timeout(10 * 60_000)
    })
    if (!response.ok) throw new Error(`GPT-SoVITS：${await readError(response)}`)
    const audio = Buffer.from(await response.arrayBuffer())
    if (audio.length < 44 || audio.subarray(0, 4).toString('ascii') !== 'RIFF') {
        throw new Error('GPT-SoVITS 没有返回有效的 WAV 文件')
    }
    return audio
}

async function playWav(path) {
    const command = `$player = New-Object System.Media.SoundPlayer('${path.replace(/'/g, "''")}'); $player.PlaySync()`
    const encoded = Buffer.from(command, 'utf16le').toString('base64')
    await new Promise((resolve, reject) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
            windowsHide: true, stdio: 'inherit'
        })
        child.once('error', reject)
        child.once('exit', code => code === 0 ? resolve() : reject(new Error(`电脑播放失败（退出码 ${code}）`)))
    })
}

async function processTask(config, task) {
    const directory = await mkdtemp(join(tmpdir(), 'lucia-voice-'))
    const wavPath = join(directory, `${task.id}.wav`)
    try {
        console.log(`[${task.id}] 正在生成 ${task.play_target} 语音...`)
        await writeFile(wavPath, await synthesize(config, task.text))
        let audioPath = null
        if (task.play_target === 'computer') {
            await playWav(wavPath)
        } else {
            const upload = await api(config, `/api/voice-worker/tasks/${task.id}/upload-url`)
            const response = await fetch(upload.upload_url, {
                method: 'PUT',
                headers: { 'Content-Type': 'audio/wav' },
                body: await readFile(wavPath),
                signal: AbortSignal.timeout(120_000)
            })
            if (!response.ok) throw new Error(`Supabase 上传失败：${await readError(response)}`)
            audioPath = upload.path
        }
        await api(config, `/api/voice-worker/tasks/${task.id}/complete`, { audioPath })
        console.log(`[${task.id}] 已完成`)
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
}

export async function runWorker(env = process.env) {
    const config = getWorkerConfig(env)
    console.log(`Worker：${config.workerId}`)
    console.log(`任务服务：${config.apiBaseUrl}`)
    console.log(`GPT-SoVITS：${config.gptUrl}`)
    await prepareGptSoVits(config)
    console.log('Lucia e5/e1 已加载，开始等待任务。')

    while (true) {
        let task
        try {
            task = (await api(config, '/api/voice-worker/claim'))?.task
            if (task) await processTask(config, task)
        } catch (error) {
            console.error(task ? `[${task.id}] ${error.message}` : error.message)
            if (task) {
                await api(config, `/api/voice-worker/tasks/${task.id}/fail`, { error: error.message })
                    .catch(reportError => console.error(`上报失败：${reportError.message}`))
            }
        }
        await delay(config.pollInterval)
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runWorker().catch(error => {
        console.error(error.message)
        process.exitCode = 1
    })
}

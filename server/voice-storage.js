const encodePath = path => path.split('/').map(encodeURIComponent).join('/')

export function createVoiceStorage({ url, serviceRoleKey, bucket, fetchImpl = fetch }) {
    if (!url || !serviceRoleKey || !bucket) throw new Error('语音存储配置不完整')
    const baseUrl = `${url.replace(/\/$/, '')}/storage/v1`
    const absoluteUrl = value => {
        if (!value) throw new Error('Supabase Storage 没有返回签名地址')
        if (/^https?:\/\//.test(value)) return value
        const path = value.startsWith('/storage/v1') ? value : `/storage/v1${value.startsWith('/') ? '' : '/'}${value}`
        return `${url.replace(/\/$/, '')}${path}`
    }
    const headers = {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
    }

    async function post(path, body) {
        const response = await fetchImpl(`${baseUrl}${path}`, {
            method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000)
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.message || data.error || `Supabase Storage 请求失败（${response.status}）`)
        return data
    }

    return {
        async createUploadUrl(path) {
            const data = await post(`/object/upload/sign/${encodeURIComponent(bucket)}/${encodePath(path)}`, {})
            return absoluteUrl(data.url)
        },
        async createDownloadUrl(path, expiresIn = 600) {
            const data = await post(`/object/sign/${encodeURIComponent(bucket)}/${encodePath(path)}`, { expiresIn })
            return absoluteUrl(data.signedURL || data.signedUrl)
        }
    }
}

export function createCloudBaseDatabase({ envId, apiKey, fetchImpl = fetch }) {
    if (!envId) throw new Error('缺少 CLOUDBASE_ENV_ID 环境变量')
    if (!apiKey) throw new Error('缺少 CLOUDBASE_API_KEY 环境变量')

    const rpcUrl = `https://${envId}.api.tcloudbasegateway.com/v1/rdb/rest/rpc`

    return {
        async rpc(name, parameters = {}) {
            if (!/^[a-z0-9_]+$/.test(name)) throw new Error('CloudBase RPC 名称无效')

            const response = await fetchImpl(`${rpcUrl}/${name}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(parameters),
                signal: AbortSignal.timeout(15_000)
            })
            const text = await response.text()
            let data = null
            try {
                data = text ? JSON.parse(text) : null
            } catch {
                data = text
            }
            if (!response.ok) {
                throw new Error(data?.message || data?.hint || data || `CloudBase 请求失败（${response.status}）`)
            }
            return data
        }
    }
}

export const db = createCloudBaseDatabase({
    envId: process.env.CLOUDBASE_ENV_ID,
    apiKey: process.env.CLOUDBASE_API_KEY
})

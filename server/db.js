export function createSupabaseDatabase({ url, serviceRoleKey, fetchImpl = fetch }) {
    if (!url) throw new Error('缺少 SUPABASE_URL 环境变量')
    if (!serviceRoleKey) throw new Error('缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量')

    const rpcUrl = `${url.replace(/\/$/, '')}/rest/v1/rpc`

    return {
        async rpc(name, parameters = {}) {
            if (!/^[a-z0-9_]+$/.test(name)) throw new Error('Supabase RPC 名称无效')

            const response = await fetchImpl(`${rpcUrl}/${name}`, {
                method: 'POST',
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
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
                throw new Error(data?.message || data?.hint || data || `Supabase 请求失败（${response.status}）`)
            }
            return data
        }
    }
}

export const db = createSupabaseDatabase({
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
})

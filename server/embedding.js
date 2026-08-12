export function createEmbeddingClient({
    apiKey,
    endpoint,
    model = 'text-embedding-v4',
    dimensions = 1024,
    fetchImpl = fetch
}) {
    if (!apiKey || !endpoint) throw new Error('缺少阿里云 Embedding 配置')

    return {
        async embed(input) {
            const texts = Array.isArray(input) ? input : [input]
            if (!texts.length || texts.length > 10) throw new Error('Embedding 文本数量必须为 1 到 10')

            const response = await fetchImpl(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    input: texts,
                    dimensions,
                    encoding_format: 'float'
                }),
                signal: AbortSignal.timeout(20_000)
            })
            const body = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(body.error?.message || body.message || '阿里云 Embedding 请求失败')
            }

            const vectors = [...(body.data || [])]
                .sort((left, right) => left.index - right.index)
                .map(item => item.embedding)
            if (vectors.length !== texts.length || vectors.some(vector => !Array.isArray(vector))) {
                throw new Error('阿里云 Embedding 返回的数据无效')
            }
            return vectors
        }
    }
}

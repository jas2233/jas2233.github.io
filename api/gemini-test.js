export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')
        response.status(405).json({ ok: false, error: 'Method Not Allowed' })
        return
    }

    const expectedToken = process.env.GEMINI_TEST_TOKEN
    const receivedToken = request.headers['x-test-token']

    if (!expectedToken || receivedToken !== expectedToken) {
        response.status(401).json({ ok: false, error: 'Unauthorized' })
        return
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    const model = process.env.OPENROUTER_MODEL || 'google/gemini-3.5-flash-lite'

    if (!apiKey) {
        response.status(500).json({ ok: false, error: 'OPENROUTER_API_KEY is not configured' })
        return
    }

    try {
        const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                stream: false,
                messages: [
                    { role: 'user', content: 'Reply with exactly: Gemini test succeeded.' }
                ],
                max_tokens: 30,
                provider: { zdr: true, data_collection: 'deny' }
            })
        })

        const body = await upstream.json().catch(() => ({}))

        if (!upstream.ok) {
            response.status(upstream.status).json({
                ok: false,
                model,
                error: body.error?.message || 'OpenRouter request failed'
            })
            return
        }

        response.status(200).json({
            ok: true,
            model,
            reply: body.choices?.[0]?.message?.content || ''
        })
    } catch (error) {
        response.status(502).json({
            ok: false,
            model,
            error: error.message || 'Network request failed'
        })
    }
}

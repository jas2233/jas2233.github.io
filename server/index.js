import express from 'express'
import { createAuth } from './auth.js'
import { createChatHandler } from './chat.js'
import { createConversationRouter, createConversationStore } from './conversations.js'
import { db } from './db.js'
import { createEmbeddingClient } from './embedding.js'
import { createMemoryRouter, createMemoryService } from './memories.js'
import { createPrivacyRouter } from './privacy.js'

const app = express()
const port = Number(process.env.PORT || 3000)
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
const auth = createAuth(process.env.ACCESS_PASSWORD)
const conversationStore = createConversationStore(db)
const embeddingConfigured = process.env.DASHSCOPE_API_KEY && process.env.DASHSCOPE_EMBEDDING_URL
const memory = embeddingConfigured
    ? createMemoryService({
        database: db,
        embedder: createEmbeddingClient({
            apiKey: process.env.DASHSCOPE_API_KEY,
            endpoint: process.env.DASHSCOPE_EMBEDDING_URL,
            model: process.env.DASHSCOPE_EMBEDDING_MODEL
        }),
        deepSeekApiKey: process.env.DEEPSEEK_API_KEY,
        deepSeekModel: process.env.DEEPSEEK_MODEL,
        openRouterApiKey: process.env.OPENROUTER_API_KEY,
        openRouterModel: process.env.OPENROUTER_MODEL
    })
    : null
if (!memory) console.warn('未配置阿里云 Embedding，长期记忆暂未启用')
const chat = createChatHandler({
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL,
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    openRouterModel: process.env.OPENROUTER_MODEL
})

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(express.json({ limit: '1mb' }))
app.use((request, response, next) => {
    const origin = request.get('origin')
    if (origin === frontendOrigin) {
        response.set({
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            Vary: 'Origin'
        })
    }

    if (request.method === 'OPTIONS') {
        response.sendStatus(origin === frontendOrigin ? 204 : 403)
        return
    }

    next()
})

app.post('/api/auth/login', auth.login)

app.get('/api/health', async (_request, response) => {
    try {
        await db.rpc('lucia_health')
        response.json({ ok: true })
    } catch (error) {
        console.error('数据库健康检查失败:', error)
        response.status(503).json({ ok: false })
    }
})

app.use('/api', auth.requireAccess)
app.get('/api/auth/session', (_request, response) => {
    response.json({ ok: true })
})
app.use('/api/conversations', createConversationRouter(conversationStore))
app.use('/api/encryption', createPrivacyRouter(db))
if (memory) app.use('/api/memories', createMemoryRouter(memory))
app.post('/api/chat', chat)

app.use((error, _request, response, _next) => {
    console.error('后端请求失败:', error)
    response.status(error.status || 500).json({ error: error.message || '服务器处理失败' })
})

export default app

if (process.env.VERCEL !== '1')
    app.listen(port, () => {
    console.log(`后端已启动：http://localhost:${port}`)
})

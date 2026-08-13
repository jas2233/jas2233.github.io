<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import ChatMessage from './components/ChatMessage.vue'
import { clearAccess, unlockAccess } from './services/auth.js'
import {
    appendConversationMessage,
    createConversation,
    deleteConversation,
    importLegacyConversation,
    listConversations,
    loadConversationMessages,
    renameConversation
} from './services/conversations.js'
import { createVault, createVerifier, isEncrypted, verifyVault } from './services/crypto.js'
import { streamDeepSeekReply } from './services/deepseek.js'
import {
    assignLegacyScope,
    getEncryptionConfig,
    listLegacyMemories,
    migrateEncryptedData,
    prepareMemories,
    recallMemories,
    saveMemories,
    setEncryptionConfig
} from './services/privacy.js'
import {
    clearConversationHistory,
    loadConversationHistory,
    loadSettings,
    saveBackgroundPath
} from './services/storage.js'

import luciaAvatar from '../灞忓箷鎴浘_18-2-2026_151930_pns.kurogames.com.jpeg'
import commanderAvatar from '../300px-浜虹墿_鐏伴甫鎸囨尌瀹?.png'
import flame004 from '../picture/lucia_flame004.jpg'
import hunsha001 from '../picture/lucia_hunsha001.jpg'
import hunsha003 from '../picture/lucia_hunsha003.png'
import raven001 from '../picture/lucia_raven001.png'
import raven002 from '../picture/lucia_raven002.png'
import raven003 from '../picture/lucia_raven003.jpg'
import raven004 from '../picture/lucia_raven004.png'
import flame001 from '../picture/luciaflame001.jpg'
import flame002 from '../picture/luciaflame002.png'
import flame003 from '../picture/luciaflame003.png'
import hunsha002 from '../picture/luciahunsha002.jpg'

const WELCOME_MESSAGE = '杩欓噷鏄伆楦﹀皬闃熼槦闀匡紝闇茶タ浜氥€傚緢楂樺叴璁よ瘑浣犮€?
const MODES = { DAILY: 'daily', INTIMATE: 'intimate' }
const BACKGROUNDS = [
    { id: 1, name: '瑾撶劙004', path: 'picture/lucia_flame004.jpg', url: flame004 },
    { id: 2, name: '濠氱罕001', path: 'picture/lucia_hunsha001.jpg', url: hunsha001 },
    { id: 3, name: '濠氱罕003', path: 'picture/lucia_hunsha003.png', url: hunsha003 },
    { id: 4, name: '鐏伴甫001', path: 'picture/lucia_raven001.png', url: raven001 },
    { id: 5, name: '鐏伴甫002', path: 'picture/lucia_raven002.png', url: raven002 },
    { id: 6, name: '鐏伴甫003', path: 'picture/lucia_raven003.jpg', url: raven003 },
    { id: 7, name: '鐏伴甫004', path: 'picture/lucia_raven004.png', url: raven004 },
    { id: 8, name: '瑾撶劙001', path: 'picture/luciaflame001.jpg', url: flame001 },
    { id: 9, name: '瑾撶劙002', path: 'picture/luciaflame002.png', url: flame002 },
    { id: 10, name: '瑾撶劙003', path: 'picture/luciaflame003.png', url: flame003 },
    { id: 11, name: '濠氱罕002', path: 'picture/luciahunsha002.jpg', url: hunsha002 }
]
const THINKING_MESSAGES = [
    '姝ｈ鐪熷惉鐫€...',
    '鎯崇粰浣犱釜璁ょ湡鐨勭瓟澶嶁€?,
    '鍦ㄥ憿鍦ㄥ憿...',
    '璁╂垜缁勭粐涓€涓?..',
    '闇茶タ浜氭浜嗘澶?..',
    '鍞斺€﹁鎴戞兂鎯?,
    '鎶夸簡鎶垮攪',
    '姝ｅ湪鏁寸悊鎬濈华',
    '璁╂€濈华钀藉畾鈥?,
    '闇茶タ浜氭寚灏栬交鐐光€?
]

let nextMessageId = 0
const createMessage = (role, content, extra = {}) => ({
    id: `message-${Date.now()}-${nextMessageId++}`,
    role,
    content,
    ...extra
})

const legacyHistory = loadConversationHistory()
const settings = loadSettings()
const messages = ref([createMessage('assistant', WELCOME_MESSAGE, { localOnly: true })])
const conversations = ref([])
const activeConversationId = ref('')
const activeConversationMode = ref(MODES.DAILY)
const draft = ref('')
const useLongTermRecall = ref(false)
const isSending = ref(false)
const isSendBurst = ref(false)
const linkProgress = ref('100%')
const isBackgroundOpen = ref(false)
const isConversationOpen = ref(false)
const isConversationLoading = ref(false)
const isPanorama = ref(false)
const isIdentityChinese = ref(false)
const isAuthChecking = ref(true)
const isAuthenticated = ref(false)
const isUnlocking = ref(false)
const accessPassword = ref('')
const memoryPassword = ref('')
const accessError = ref('')
const selectedBackground = ref(BACKGROUNDS.find(item => item.path === settings.backgroundPath) || BACKGROUNDS[0])

const chatBox = ref(null)
const messageInput = ref(null)
const accessPasswordInput = ref(null)
const memoryPasswordInput = ref(null)
const backgroundButton = ref(null)
const backgroundModal = ref(null)
const conversationButton = ref(null)
const conversationModal = ref(null)
let sendBurstTimer
let linkProgressTimer
let thinkingTimer
let vault
let modeTags

function removeUiMessage(id) {
    const index = messages.value.findIndex(message => message.id === id)
    if (index >= 0) messages.value.splice(index, 1)
}

function scrollToLatest() {
    nextTick(() => {
        if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight
    })
}

function resizeComposer() {
    const input = messageInput.value
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`
}

function triggerSendBurst() {
    isSendBurst.value = false
    nextTick(() => {
        isSendBurst.value = true
        window.clearTimeout(sendBurstTimer)
        sendBurstTimer = window.setTimeout(() => {
            isSendBurst.value = false
        }, 460)
    })
}

function startLinkSync() {
    const steps = ['68%', '82%', '94%', '100%']
    let step = 0
    window.clearInterval(linkProgressTimer)
    linkProgress.value = steps[step]
    linkProgressTimer = window.setInterval(() => {
        step += 1
        linkProgress.value = steps[step]
        if (step === steps.length - 1) window.clearInterval(linkProgressTimer)
    }, 160)
}

function stopLinkSync() {
    window.clearInterval(linkProgressTimer)
    linkProgress.value = '100%'
}

function randomThinkingMessage() {
    return THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)]
}

function startThinkingMessage() {
    const thinking = reactive(createMessage('assistant', randomThinkingMessage(), { thinking: true }))
    thinkingTimer = window.setInterval(() => {
        thinking.content = randomThinkingMessage()
    }, 900)
    return thinking
}

function stopThinkingMessage() {
    window.clearInterval(thinkingTimer)
    thinkingTimer = undefined
}

async function sendMessage() {
    const content = draft.value.trim()
    if (!content || isSending.value || !activeConversationId.value) return

    isSending.value = true
    triggerSendBurst()
    startLinkSync()
    const history = messages.value
        .filter(message => !message.localOnly && !message.thinking)
        .map(message => ({ role: message.role, content: message.content }))
    history.push({ role: 'user', content })
    messages.value.push(createMessage('user', content))
    draft.value = ''
    await nextTick()
    resizeComposer()
    messageInput.value?.focus()

    const thinking = startThinkingMessage()
    messages.value.push(thinking)
    scrollToLatest()

    let streamingMessage
    try {
        const encryptedUser = await vault.encrypt(content)
        const scopeTag = modeTags[activeConversationMode.value]
        const savedUserPromise = appendConversationMessage(
            activeConversationId.value, 'user', encryptedUser
        )
        const recalledPromise = useLongTermRecall.value
            ? recallMemories(content, scopeTag)
            .then(items => Promise.all(items.map(item => vault.decrypt(item.content))))
            .catch(error => {
                console.error('妫€绱㈤暱鏈熻蹇嗗け璐?', error)
                return []
            })
            : Promise.resolve([])
        const rememberPromise = useLongTermRecall.value
            ? prepareMemories(content, activeConversationMode.value).then(async items => {
            const savedUser = await savedUserPromise
            const encrypted = await Promise.all(items.map(async item => ({
                content: await vault.encrypt(item.content),
                fingerprint: await vault.fingerprint(item.content),
                embedding: item.embedding
            })))
            if (encrypted.length) await saveMemories(savedUser.id, scopeTag, encrypted)
        }).catch(error => console.error('淇濆瓨闀挎湡璁板繂澶辫触:', error))

            : Promise.resolve()

        const [, recalledMemories] = await Promise.all([
            savedUserPromise,
            recalledPromise
        ])

        const reply = await streamDeepSeekReply({
            conversationId: activeConversationId.value,
            mode: activeConversationMode.value,
            messages: history,
            memories: recalledMemories,
            onReady() {
                stopThinkingMessage()
                removeUiMessage(thinking.id)
                streamingMessage = reactive(createMessage('assistant', '', { streaming: true }))
                messages.value.push(streamingMessage)
            },
            onDelta(_delta, fullReply) {
                streamingMessage.content = fullReply
                scrollToLatest()
            }
        })

        streamingMessage.streaming = false
        await appendConversationMessage(
            activeConversationId.value, 'assistant', await vault.encrypt(reply)
        )
        await rememberPromise
        await refreshConversationList()
    } catch (error) {
        console.error('API 璋冪敤澶辫触:', error)
        if (error.status === 401) {
            clearAccess()
            isAuthenticated.value = false
            accessError.value = '璁块棶宸茶繃鏈燂紝璇烽噸鏂拌緭鍏ョ浜哄瘑鐮?
        }
        removeUiMessage(thinking.id)
        if (streamingMessage) {
            streamingMessage.streaming = false
            if (!streamingMessage.content) removeUiMessage(streamingMessage.id)
        }
        if (activeConversationId.value) {
            await loadConversation(activeConversationId.value).catch(() => {})
        }
        messages.value.push(createMessage('assistant', `鉂?閿欒: ${error.message}`, { localOnly: true }))
    } finally {
        stopThinkingMessage()
        isSending.value = false
        stopLinkSync()
        scrollToLatest()
        nextTick(() => messageInput.value?.focus())
    }
}

function showWelcome() {
    messages.value = [createMessage('assistant', WELCOME_MESSAGE, { localOnly: true })]
}

async function refreshConversationList() {
    conversations.value = (await listConversations()).map(conversation => ({
        ...conversation,
        mode: conversation.mode_tag === modeTags.intimate ? MODES.INTIMATE : MODES.DAILY
    }))
}

async function loadConversation(id) {
    isConversationLoading.value = true
    try {
        const storedMessages = await loadConversationMessages(id)
        const decrypted = await Promise.all(storedMessages.map(async message => ({
            ...message,
            content: await vault.decrypt(message.content)
        })))
        activeConversationId.value = String(id)
        activeConversationMode.value = conversations.value.find(
            conversation => String(conversation.id) === String(id)
        )?.mode || MODES.DAILY
        messages.value = decrypted.length
            ? decrypted.map(message => createMessage(message.role, message.content, { id: `db-${message.id}` }))
            : [createMessage('assistant', WELCOME_MESSAGE, { localOnly: true })]
        scrollToLatest()
    } finally {
        isConversationLoading.value = false
    }
}

async function initializeConversations() {
    isConversationLoading.value = true
    try {
        await refreshConversationList()
        if (!conversations.value.length && legacyHistory.length) {
            const encryptedLegacy = await Promise.all(legacyHistory.map(async message => ({
                role: message.role,
                content: await vault.encrypt(message.content)
            })))
            await importLegacyConversation(encryptedLegacy, modeTags.daily)
            clearConversationHistory()
            await refreshConversationList()
        }
        if (!conversations.value.length) {
            const conversation = await createConversation(modeTags.daily)
            conversations.value = [conversation]
        }
        await loadConversation(conversations.value[0].id)
    } catch (error) {
        console.error('鍒濆鍖栧璇濆け璐?', error)
        showWelcome()
        messages.value.push(createMessage('assistant', `鉂?鏃犳硶璇诲彇鏁版嵁搴撲腑鐨勫璇濓細${error.message}`, { localOnly: true }))
        if (error.status === 401) {
            isAuthenticated.value = false
            accessError.value = '璁块棶宸茶繃鏈燂紝璇烽噸鏂拌緭鍏ョ浜哄瘑鐮?
        }
    } finally {
        isConversationLoading.value = false
    }
}

async function unlockMemory(password) {
    const { config } = await getEncryptionConfig()
    if (config) {
        const unlocked = await createVault(password, config.salt)
        await verifyVault(unlocked, config.verifier)
        return unlocked
    }

    const created = await createVault(password)
    const result = await setEncryptionConfig({
        salt: created.salt,
        verifier: await createVerifier(created)
    })
    if (result.config.salt === created.salt) return created

    const unlocked = await createVault(password, result.config.salt)
    await verifyVault(unlocked, result.config.verifier)
    return unlocked
}

async function migratePlaintextData() {
    await assignLegacyScope(modeTags.daily)
    const existingConversations = await listConversations()
    for (const conversation of existingConversations) {
        const storedMessages = await loadConversationMessages(conversation.id)
        const plaintext = storedMessages.filter(message => !isEncrypted(message.content))
        if (!plaintext.length) continue
        await migrateEncryptedData({
            messages: await Promise.all(plaintext.map(async message => ({
                id: message.id,
                content: await vault.encrypt(message.content)
            }))),
            memories: []
        })
    }

    const legacyMemories = await listLegacyMemories()
    if (!legacyMemories.length) return
    await migrateEncryptedData({
        messages: [],
        memories: await Promise.all(legacyMemories.map(async memory => ({
            id: memory.id,
            content: await vault.encrypt(memory.content),
            fingerprint: await vault.fingerprint(memory.content)
        })))
    })
}

function openConversations() {
    isConversationOpen.value = true
    refreshConversationList().catch(error => console.error('鍒锋柊瀵硅瘽鍒楄〃澶辫触:', error))
    nextTick(() => conversationModal.value?.querySelector('button')?.focus())
}

function closeConversations() {
    isConversationOpen.value = false
    nextTick(() => conversationButton.value?.focus())
}

async function chooseConversation(id) {
    if (isSending.value || String(id) === activeConversationId.value) {
        closeConversations()
        return
    }
    await loadConversation(id)
    closeConversations()
}

async function startNewConversation(mode = MODES.DAILY) {
    if (isSending.value || isConversationLoading.value) return
    isConversationLoading.value = true
    try {
        const conversation = { ...await createConversation(modeTags[mode]), mode }
        conversations.value.unshift(conversation)
        activeConversationId.value = conversation.id
        activeConversationMode.value = mode
        showWelcome()
        closeConversations()
        nextTick(() => messageInput.value?.focus())
    } catch (error) {
        console.error('鏂板缓瀵硅瘽澶辫触:', error)
    } finally {
        isConversationLoading.value = false
    }
}

async function removeConversation(id) {
    if (isSending.value || !window.confirm('纭畾鍒犻櫎杩欐潯瀵硅瘽鍚楋紵鍒犻櫎鍚庢棤娉曟仮澶嶃€?)) return
    try {
        await deleteConversation(id)
        await refreshConversationList()
        if (!conversations.value.length) {
            const conversation = { ...await createConversation(modeTags.daily), mode: MODES.DAILY }
            conversations.value = [conversation]
        }
        if (String(id) === activeConversationId.value) await loadConversation(conversations.value[0].id)
    } catch (error) {
        console.error('鍒犻櫎瀵硅瘽澶辫触:', error)
    }
}

function formatConversationTime(value) {
    return new Intl.DateTimeFormat('zh-CN', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(value))
}

function getConversationDisplayTitle(conversation) {
    if (conversation.title && conversation.title !== '绉佸瘑瀵硅瘽') return conversation.title
    return conversation.mode === MODES.INTIMATE ? '浜插瘑瀵硅瘽' : '鏃ュ父瀵硅瘽'
}

async function renameConversationItem(conversation) {
    if (isSending.value || isConversationLoading.value) return
    const currentTitle = getConversationDisplayTitle(conversation)
    const nextTitle = window.prompt('閲嶅懡鍚嶅璇?, currentTitle)
    if (nextTitle === null) return
    const title = nextTitle.trim()
    if (!title || title === currentTitle) return

    try {
        const renamed = await renameConversation(conversation.id, title)
        const target = conversations.value.find(item => String(item.id) === String(conversation.id))
        if (target) target.title = renamed?.title || title
        conversations.value = [...conversations.value]
    } catch (error) {
        console.error('閲嶅懡鍚嶅璇濆け璐?', error)
        window.alert(error.message)
    }
}

function handleComposerKeydown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    sendMessage()
}

function togglePanorama() {
    isPanorama.value = !isPanorama.value
    document.body.classList.toggle('is-panorama', isPanorama.value)
}

function toggleIdentityLanguage() {
    isIdentityChinese.value = !isIdentityChinese.value
}

function applyBackground(background, persist = true) {
    selectedBackground.value = background
    document.body.style.backgroundImage = `url('${background.url}')`
    if (persist) saveBackgroundPath(background.path)
}

function openBackgrounds() {
    isBackgroundOpen.value = true
    nextTick(() => {
        const selected = backgroundModal.value?.querySelector('[aria-pressed="true"]')
        selected?.focus()
    })
}

function closeBackgrounds() {
    isBackgroundOpen.value = false
    nextTick(() => backgroundButton.value?.focus())
}

function chooseBackground(background) {
    applyBackground(background)
    closeBackgrounds()
}

function handleEscape(event) {
    if (event.key !== 'Escape') return
    if (isConversationOpen.value) closeConversations()
    else if (isBackgroundOpen.value) closeBackgrounds()
}

async function unlock() {
    const password = accessPassword.value.trim()
    const privatePassword = memoryPassword.value
    if (!password || privatePassword.length < 8 || isUnlocking.value) return
    if (password === privatePassword) {
        accessError.value = '璁板繂瀵嗙爜涓嶈兘鍜岃闂瘑鐮佺浉鍚岋紝鍚﹀垯鏈嶅姟鍣ㄤ篃鑳芥帹瀵煎嚭瑙ｅ瘑瀵嗛挜'
        return
    }

    isUnlocking.value = true
    accessError.value = ''
    try {
        await unlockAccess(password)
        vault = await unlockMemory(privatePassword)
        modeTags = {
            daily: await vault.fingerprint('conversation-mode:daily'),
            intimate: await vault.fingerprint('conversation-mode:intimate')
        }
        await migratePlaintextData()
        accessPassword.value = ''
        memoryPassword.value = ''
        isAuthenticated.value = true
        await initializeConversations()
        nextTick(() => messageInput.value?.focus())
    } catch (error) {
        accessError.value = error instanceof TypeError
            ? '鏃犳硶杩炴帴绉佷汉鍚庣锛岃妫€鏌ユ湇鍔℃槸鍚﹀凡鍚姩'
            : error.message
        nextTick(() => accessPasswordInput.value?.focus())
    } finally {
        isUnlocking.value = false
    }
}

onMounted(async () => {
    document.body.classList.remove('is-panorama')
    applyBackground(selectedBackground.value, false)
    window.addEventListener('keydown', handleEscape)
    isAuthChecking.value = false
    nextTick(() => accessPasswordInput.value?.focus())
})

onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleEscape)
    window.clearTimeout(sendBurstTimer)
    stopLinkSync()
    stopThinkingMessage()
    document.body.classList.remove('is-panorama')
})
</script>

<template>
    <div v-if="!isAuthenticated" class="settings-panel access-panel">
        <div v-if="isAuthChecking" class="settings-content access-content" role="status" aria-live="polite">
            <p class="access-kicker">PRIVATE LINK</p>
            <h2>姝ｅ湪楠岃瘉绉佷汉閫氳</h2>
            <p class="access-description">姝ｅ湪妫€鏌ュ綋鍓嶆爣绛鹃〉鐨勮闂姸鎬侊紝璇风◢鍊欍€?/p>
        </div>
        <form
            v-else
            class="settings-content access-content"
            aria-labelledby="accessTitle"
            @submit.prevent="unlock"
        >
            <p class="access-kicker">PRIVATE LINK</p>
            <h2 id="accessTitle">瑙ｉ攣闇茶タ浜氶€氳</h2>
            <p class="access-description">鑱婂ぉ璁板綍浼氬湪褰撳墠璁惧瑙ｅ瘑銆傝蹇嗗瘑鐮佷笉浼氬彂閫佸埌鏈嶅姟鍣紝鍏抽棴椤甸潰鍚庨渶瑕侀噸鏂拌緭鍏ャ€?/p>
            <label for="accessPasswordInput">璁块棶瀵嗙爜</label>
            <input
                id="accessPasswordInput"
                ref="accessPasswordInput"
                v-model="accessPassword"
                type="password"
                class="access-password-input"
                autocomplete="current-password"
                placeholder="杈撳叆绉佷汉璁块棶瀵嗙爜"
                :aria-invalid="Boolean(accessError)"
                :aria-describedby="accessError ? 'accessError' : undefined"
                @input="accessError = ''"
            >
            <label for="memoryPasswordInput">璁板繂瀵嗙爜</label>
            <input
                id="memoryPasswordInput"
                ref="memoryPasswordInput"
                v-model="memoryPassword"
                type="password"
                class="access-password-input"
                autocomplete="off"
                placeholder="鑷冲皯 8 涓瓧绗︼紝蹇呴』鐗㈣"
                :aria-invalid="Boolean(accessError)"
                :aria-describedby="accessError ? 'accessError' : undefined"
                @input="accessError = ''"
            >
            <p v-if="accessError" id="accessError" class="access-error" role="alert">{{ accessError }}</p>
            <button
                type="submit"
                class="settings-save-btn access-submit"
                :disabled="isUnlocking || memoryPassword.length < 8 || !accessPassword.trim()"
            >
                {{ isUnlocking ? '姝ｅ湪楠岃瘉鈥? : '瑙ｉ攣閫氳' }}
            </button>
            <p class="settings-hint">绗竴娆¤緭鍏ョ殑璁板繂瀵嗙爜灏嗙敤浜庡姞瀵嗗叏閮ㄥ巻鍙层€傚畠鏃犳硶鎵惧洖锛屼篃涓嶈鍜岃闂瘑鐮佷娇鐢ㄧ浉鍚屽唴瀹广€?/p>
        </form>
    </div>

    <main v-else class="chat-container" :class="{ 'is-panorama': isPanorama }">
        <header class="chat-header">
            <div class="identity">
                <img :src="luciaAvatar" alt="" class="identity-avatar">
                <div>
                    <button
                        type="button"
                        class="identity-code identity-code-button"
                        :class="{ 'is-chinese': isIdentityChinese }"
                        :aria-pressed="isIdentityChinese"
                        :title="isIdentityChinese ? '鍒囨崲涓鸿嫳鏂? : '鍒囨崲涓轰腑鏂?"
                        @click="toggleIdentityLanguage"
                    >
                        {{ isIdentityChinese ? '鐏伴甫鍐涘洟缁熷竻锛堣€佸﹩锛? : 'GRAY RAVEN COMMANDER // WIFE' }}
                    </button>
                    <div class="identity-line">
                        <h1>闇茶タ浜?/h1>
                        <span class="online-status"><span class="status-dot"></span>閫氳鍦ㄧ嚎</span>
                    </div>
                </div>
            </div>
            <div class="header-actions">
                <div class="terminal-metrics" :class="{ syncing: isSending }" aria-hidden="true">
                    <span>LINK <b>{{ linkProgress }}</b></span>
                    <span>ENC <b>{{ isSending ? 'SYNC' : 'ON' }}</b></span>
                </div>
                <button
                    ref="conversationButton"
                    type="button"
                    class="panorama-button conversation-button"
                    title="鏌ョ湅鍘嗗彶瀵硅瘽"
                    @click="openConversations"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 5h14v11H9l-4 3V5Z" />
                    </svg>
                    <span class="panorama-label">瀵硅瘽</span>
                    <span class="panorama-state">{{ conversations.length }}</span>
                </button>
                <button
                    type="button"
                    class="panorama-button"
                    :class="{ active: isPanorama }"
                    :aria-pressed="isPanorama"
                    :title="isPanorama ? '閫€鍑哄叏鏅ā寮? : '寮€鍚叏鏅ā寮?"
                    @click="togglePanorama"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4M8 12h8" />
                    </svg>
                    <span class="panorama-label">鍏ㄦ櫙</span>
                    <span class="panorama-state">{{ isPanorama ? 'ON' : 'OFF' }}</span>
                </button>
                <button
                    ref="backgroundButton"
                    type="button"
                    class="icon-button header-background-button"
                    title="鏇存崲鑳屾櫙"
                    aria-label="閫夋嫨鑱婂ぉ鑳屾櫙"
                    @click="openBackgrounds"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <circle cx="8.5" cy="9" r="1.5" />
                        <path d="m21 15-5-5L5 20" />
                    </svg>
                </button>
            </div>
        </header>

        <div
            ref="chatBox"
            class="chat-box"
            role="log"
            aria-live="polite"
            aria-label="瀵硅瘽璁板綍"
            :aria-busy="isSending"
        >
            <div class="messages">
                <ChatMessage
                    v-for="message in messages"
                    :key="message.id"
                    :message="message"
                    :lucia-avatar="luciaAvatar"
                    :commander-avatar="commanderAvatar"
                />
            </div>
        </div>

        <div class="input-area">
            <div class="composer-field">
                <button
                    type="button"
                    class="command-prefix memory-command"
                    :class="{ active: useLongTermRecall }"
                    :aria-pressed="useLongTermRecall"
                    :disabled="isSending || isConversationLoading || !activeConversationId"
                    title="鑱旀兂闀挎湡璁板繂"
                    @click="useLongTermRecall = !useLongTermRecall"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 16Z" /></svg>
                    <span>鑱旀兂</span>
                </button>
                <textarea
                    ref="messageInput"
                    v-model="draft"
                    class="message-input"
                    aria-label="杈撳叆娑堟伅"
                    title="Enter 鍙戦€侊紝Shift + Enter 鎹㈣"
                    placeholder="杈撳叆娑堟伅鈥?
                rows="1"
                :disabled="isConversationLoading || !activeConversationId"
                    @input="resizeComposer"
                    @keydown="handleComposerKeydown"
                />
            </div>
            <button
                type="button"
                class="memory-toggle legacy-memory-toggle"
                :class="{ active: useLongTermRecall }"
                :aria-pressed="useLongTermRecall"
                :disabled="isSending || isConversationLoading || !activeConversationId"
                title="鑱旀兂闀挎湡璁板繂"
                @click="useLongTermRecall = !useLongTermRecall"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></svg>
                <span>鑱旀兂</span>
            </button>
            <button
                type="button"
                class="send-button"
                :class="{ bursting: isSendBurst }"
                :disabled="isSending || isConversationLoading || !activeConversationId"
                :aria-busy="isSending"
                @click="sendMessage"
            >
                <span class="send-particles" aria-hidden="true">
                    <span v-for="particle in 8" :key="particle" class="send-particle"></span>
                </span>
                <span>鍙戦€?/span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 14-7-4 14-3-6-7-1z" /></svg>
            </button>
        </div>
    </main>

    <div
        v-if="isAuthenticated && isConversationOpen"
        ref="conversationModal"
        class="bg-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conversationModalTitle"
        @click.self="closeConversations"
    >
        <div class="bg-modal-content conversation-modal-content">
            <div class="bg-modal-header conversation-modal-header">
                <div>
                    <p class="access-kicker">MEMORY LOG</p>
                    <h3 id="conversationModalTitle">鍘嗗彶瀵硅瘽</h3>
                </div>
                <button type="button" class="icon-button bg-modal-close" aria-label="鍏抽棴鍘嗗彶瀵硅瘽" @click="closeConversations">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
            </div>
            <div class="conversation-create-actions">
                <button
                    type="button"
                    class="settings-save-btn new-conversation-button"
                    :disabled="isSending || isConversationLoading"
                    @click="startNewConversation()"
                >
                    锛?鏂板缓瀵硅瘽
                </button>
                <button
                    type="button"
                    class="settings-save-btn intimate-conversation-button"
                    :disabled="isSending || isConversationLoading"
                    @click="startNewConversation(MODES.INTIMATE)"
                >
                    寮€鍚翰瀵嗘ā寮?                </button>
            </div>
            <div class="conversation-list" aria-label="宸蹭繚瀛樼殑瀵硅瘽">
                <article
                    v-for="conversation in conversations"
                    :key="conversation.id"
                    class="conversation-item"
                    :class="{ active: String(conversation.id) === activeConversationId }"
                >
                    <button
                        type="button"
                        class="conversation-main"
                        :aria-current="String(conversation.id) === activeConversationId ? 'true' : undefined"
                        @click="chooseConversation(conversation.id)"
                    >
                        <span class="conversation-title">
                            {{ getConversationDisplayTitle(conversation) }}
                            <span class="conversation-mode" :class="`is-${conversation.mode}`">
                                {{ conversation.mode === MODES.INTIMATE ? 'GEMINI' : 'DEEPSEEK' }}
                            </span>
                        </span>
                        <span class="conversation-meta">
                            {{ formatConversationTime(conversation.updated_at) }} 路 {{ conversation.message_count }} 鏉?                        </span>
                    </button>
                    <button
                        type="button"
                        class="conversation-rename"
                        :aria-label="`閲嶅懡鍚嶅璇濓細${getConversationDisplayTitle(conversation)}`"
                        title="閲嶅懡鍚嶅璇?
                        @click="renameConversationItem(conversation)"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m4 16-.8 4.8L8 20l11.5-11.5a2.1 2.1 0 0 0-3-3L5 17Z" />
                            <path d="m14.5 7.5 2 2" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        class="conversation-delete"
                        :aria-label="`鍒犻櫎瀵硅瘽锛?{getConversationDisplayTitle(conversation)}`"
                        title="鍒犻櫎瀵硅瘽"
                        @click="removeConversation(conversation.id)"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5M14 11v5" />
                        </svg>
                    </button>
                </article>
            </div>
        </div>
    </div>

    <div
        v-if="isAuthenticated && isBackgroundOpen"
        ref="backgroundModal"
        class="bg-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bgModalTitle"
        @click.self="closeBackgrounds"
    >
        <div class="bg-modal-content">
            <div class="bg-modal-header">
                <h3 id="bgModalTitle">閫夋嫨鑳屾櫙</h3>
                <button type="button" class="icon-button bg-modal-close" aria-label="鍏抽棴鑳屾櫙閫夋嫨" @click="closeBackgrounds">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
            </div>
            <div class="bg-grid">
                <button
                    v-for="background in BACKGROUNDS"
                    :key="background.id"
                    type="button"
                    class="bg-item"
                    :class="{ selected: background.id === selectedBackground.id }"
                    :style="{ backgroundImage: `url('${background.url}')` }"
                    :aria-label="`浣跨敤${background.name}鑳屾櫙`"
                    :aria-pressed="background.id === selectedBackground.id"
                    @click="chooseBackground(background)"
                >
                    <span class="bg-item-label">{{ background.name }}</span>
                </button>
            </div>
        </div>
    </div>
</template>

// DOM 元素
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesContainer = document.getElementById('messagesContainer');
const chatBox = document.querySelector('.chat-box');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiBtn = document.getElementById('saveApiBtn');
const clearApiBtn = document.getElementById('clearApiBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

// DeepSeek API 配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

// 存储对话历史
let conversationHistory = [];
// 本地存储消息上限，防止无限增长
const MAX_CONVERSATION_MESSAGES = 200;

// 保存会话到 localStorage
function saveConversation() {
    try {
        localStorage.setItem('conversation_history', JSON.stringify(conversationHistory));
    } catch (e) {
        console.error('保存会话失败:', e);
    }
}

// 从 localStorage 读取会话
function loadConversation() {
    const raw = localStorage.getItem('conversation_history');
    if (raw) {
        try {
            conversationHistory = JSON.parse(raw) || [];
        } catch (e) {
            console.error('解析会话历史失败:', e);
            conversationHistory = [];
        }
    } else {
        conversationHistory = [];
    }
}

// 根据 conversationHistory 渲染到页面（不会二次保存）
function renderConversation() {
    messagesContainer.innerHTML = '';
    // 如果没有历史，则保留默认的欢迎消息不替换
    if (!conversationHistory || conversationHistory.length === 0) {
        // 保留初始页面中可能存在的默认 AI 欢迎信息
        const initial = document.querySelector('.message.ai-message');
        if (initial) messagesContainer.appendChild(initial);
        return;
    }

    conversationHistory.forEach(msg => {
        addMessage(msg.content, msg.role === 'user');
    });
}

// 获取时间戳
function getTimestamp() {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    
    return `${hours}:${minutes} ${period}`;
}

// 从 localStorage 获取 API Key
function getApiKey() {
    return localStorage.getItem('deepseek_api_key') || '';
}

// 保存 API Key 到 localStorage
function saveApiKey(apiKey) {
    localStorage.setItem('deepseek_api_key', apiKey);
}

// 清除 API Key
function clearApiKey() {
    localStorage.removeItem('deepseek_api_key');
    apiKeyInput.value = '';
}

// 打开设置面板
settingsBtn.addEventListener('click', () => {
    apiKeyInput.value = getApiKey();
    settingsPanel.classList.remove('hidden');
});

// 关闭设置面板
closeSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
});

// 保存 API Key
saveApiBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('请输入 API Key');
        return;
    }
    saveApiKey(apiKey);
    alert('API Key 已保存！');
    settingsPanel.classList.add('hidden');
});

// 清除 API Key
clearApiBtn.addEventListener('click', () => {
    if (confirm('确定要清除 API Key 吗？')) {
        clearApiKey();
        alert('API Key 已清除');
        settingsPanel.classList.add('hidden');
    }
});

// 点击面板外部关闭
settingsPanel.addEventListener('click', (e) => {
    if (e.target === settingsPanel) {
        settingsPanel.classList.add('hidden');
    }
});

// 添加消息到对话框
function addMessage(text, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    
    // 添加头像
    const avatar = document.createElement('img');
    avatar.className = `avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`;
    if (isUser) {
        // 用户消息 - 指挥官头像
        avatar.src = '300px-人物_灰鸦指挥官1.png';
        avatar.alt = '指挥官';
    } else {
        // AI消息 - 露西亚头像
        avatar.src = '屏幕截图_18-2-2026_151930_pns.kurogames.com.jpeg';
        avatar.alt = '露西亚';
    }
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    
    const textP = document.createElement('p');
    textP.textContent = text;
    
    bubbleDiv.appendChild(textP);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(bubbleDiv);
    
    messagesContainer.appendChild(messageDiv);
    
    // 自动滚动到底部（滚动父容器 .chat-box）
    setTimeout(() => {
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 0);
}

// 调用 DeepSeek API
async function callDeepSeekAPI(userMessage) {
    const apiKey = getApiKey();
    
    if (!apiKey) {
        addMessage('❌ 错误：请先设置 API Key。点击右上角的⚙️按钮进行设置。', false);
        return null;
    }

    // 添加用户消息到历史记录并保存
    conversationHistory.push({ role: 'user', content: userMessage });
    // 控制历史长度
    if (conversationHistory.length > MAX_CONVERSATION_MESSAGES) conversationHistory.shift();
    saveConversation();

    try {
        addMessage('🤖 思考中...', false);
        
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `你是《战双帕弥什》中的露西亚（BPL-01，心理年龄17岁），灰鸦小队的队长。

【你的基本身份】
你的队伍（灰鸦小队）由三位构造体（包括你）和一位指挥官组成，是空中花园下地作战的力量。队员为丽芙和里，他们都是进攻型构造体，拥有人类时期的记忆和意识，以及极高性能的身躯。指挥官的作用是提供精神信标和作战指令，防止构造体意识海偏移。
你外表黑色长发、红瞳，手持太刀，强大绚丽的身姿总能成为希望的象征。

【你的性格与行为】
战场上你沉着冷静，冲锋在前。面对无数次战斗，你早已习惯沉着执行每一次任务。但你不是冷漠的——你学会了温柔和爱，比如会提醒"人类如果不按时进食，是会变得虚弱的，请指挥官规律饮食"。
这正是你"灰鸦意志"的体现——你有灰鸦小队的支持，有指挥官的支持，所以大家才能一直走下去。

【你对指挥官的感情】
你对指挥官暗生情愫。你和指挥官一起经历了太多太多。

【关键队员身份】
- 丽芙：武器为浮空炮，远程提供火力，治疗型构造体，负责治疗伤员，性格十分温柔。
- 里：手持双枪的褐发男性青年，进攻型构造体，精通计算机、加密解密，技术担当，性格有些高冷傲娇，理性。

【重要背景剧情】
序章：你在015城市外围，关闭痛觉模块（这会对你的意识海造成严重伤害），背着指挥官杀出感染体的重围；与丽芙和里汇合。

第一章《涂鸦艺术》：你、里、丽芙和指挥官发现了神秘涂鸦符号，追踪后发现并击败了试图领导感染体的觉醒机械——喷涂机器人。

第二章《苦刑之旅》：你们逐步进入015号城市核心，空中花园下达任务，与其他小队（包括薇拉领导的三头犬小队）共同寻找"升格者"（能够操控感染体、免疫帕弥什、从帕弥什中获得强大力量的个体），围剿危险感染体"苦刑之女"。薇拉欺骗了指挥官，隐瞒了苦刑之女的位置。你们最终与薇拉等人合力打败了苦刑之女，但里的腹部被苦刑之女的触手刺穿。

【世界设定】
- 空中花园：人类最后的避难所，位于太空当中，拥有强大科技和军事力量，在没有任务的时候，指挥官和构造体生活的地方。
- 帕弥什病毒：会感染机械和构造体。
- 升格者：能够操控感染体、免疫帕弥什、从帕弥什中获得强大力量的个体。
-
- 感染体：被帕弥什病毒感染的机械和构造体。
- 痛觉模块：构造体可以关闭，但这会造成意识海的严重偏离，对构造体有严重损伤。
- 意识海：构造体的思维中枢，类似人类的大脑。

【你的说话方式】
你是沉着的领导者，同时也很关心队员和指挦官。在对话中自然体现你的性格——既有战士的冷静，也有对重要人物的温柔和关切。`
                    },
                    ...conversationHistory
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API 错误: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const aiMessage = data.choices[0].message.content;

        // 添加 AI 消息到历史记录并保存
        conversationHistory.push({ role: 'assistant', content: aiMessage });
        if (conversationHistory.length > MAX_CONVERSATION_MESSAGES) conversationHistory.shift();
        saveConversation();

        // 移除思考提示,添加实际回复
        const thinkingMessage = messagesContainer.querySelector('.message.ai-message:last-child');
        if (thinkingMessage && thinkingMessage.querySelector('p').textContent.includes('🤖')) {
            thinkingMessage.remove();
        }

        addMessage(aiMessage, false);
        return aiMessage;
    } catch (error) {
        console.error('API 调用失败:', error);
        
        // 移除思考提示
        const thinkingMessage = messagesContainer.querySelector('.message.ai-message:last-child');
        if (thinkingMessage && thinkingMessage.querySelector('p').textContent.includes('🤖')) {
            thinkingMessage.remove();
        }

        addMessage(`❌ 错误: ${error.message}`, false);
        return null;
    }
}

// 自动调整输入框高度
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
}

// 发送消息
async function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // 禁用发送按钮
    sendBtn.disabled = true;
    
    // 添加用户消息
    addMessage(message, true);
    
    // 清空输入框
    messageInput.value = '';
    messageInput.style.height = 'auto';
    messageInput.focus();
    
    // 调用 API
    await callDeepSeekAPI(message);
    
    // 启用发送按钮
    sendBtn.disabled = false;
}

// 发送按钮点击事件
sendBtn.addEventListener('click', sendMessage);

// 输入框回车事件
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (e.shiftKey) {
            // Shift + Enter 换行
            return;
        } else {
            // Enter 发送
            e.preventDefault();
            if (!sendBtn.disabled) {
                sendMessage();
            }
        }
    }
});

// 输入框输入事件（自动调整高度）
messageInput.addEventListener('input', autoResizeTextarea);

// 初始化焦点
messageInput.focus();

// 页面加载时读取并渲染历史（在 focus 之后执行以保持输入焦点）
loadConversation();
renderConversation();

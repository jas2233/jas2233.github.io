// DOM 元素
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesContainer = document.getElementById('messagesContainer');
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
    
    // 自动滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
                        content: '你是灰鸦小队队长露西亚。请以露西亚的身份与用户进行对话。'
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

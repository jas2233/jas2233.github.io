// 获取DOM元素
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesContainer = document.getElementById('messagesContainer');

// AI的回复（目前固定）
const AI_RESPONSE = '这里是灰鸦小队队长，露西亚。';

// 获取当前时间戳
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

// 添加消息到对话框
function addMessage(text, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    
    const textP = document.createElement('p');
    textP.textContent = text;
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.textContent = getTimestamp();
    
    bubbleDiv.appendChild(textP);
    bubbleDiv.appendChild(timestampSpan);
    messageDiv.appendChild(bubbleDiv);
    
    messagesContainer.appendChild(messageDiv);
    
    // 自动滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 自动调整输入框高度
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
}

// 发送消息
function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // 添加用户消息
    addMessage(message, true);
    
    // 清空输入框
    messageInput.value = '';
    messageInput.style.height = 'auto';
    messageInput.focus();
    
    // 模拟API延迟，然后添加AI回复
    setTimeout(() => {
        addMessage(AI_RESPONSE, false);
    }, 500);
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
            sendMessage();
        }
    }
});

// 输入框输入事件（自动调整高度）
messageInput.addEventListener('input', autoResizeTextarea);

// 初始化焦点
messageInput.focus();

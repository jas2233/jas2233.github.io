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
const bgBtn = document.getElementById('bgBtn');
const bgModal = document.getElementById('bgModal');
const bgGrid = document.getElementById('bgGrid');
const closeBgModal = document.getElementById('closeBgModal');

// DeepSeek API 配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

// 背景图片列表
const BACKGROUNDS = [
    { id: 1, name: '火焰004', path: 'picture/lucia_flame004.jpg' },
    { id: 2, name: '昏沙001', path: 'picture/lucia_hunsha001.jpg' },
    { id: 3, name: '昏沙003', path: 'picture/lucia_hunsha003.png' },
    { id: 4, name: '灰鸦001', path: 'picture/lucia_raven001.png' },
    { id: 5, name: '灰鸦002', path: 'picture/lucia_raven002.png' },
    { id: 6, name: '灰鸦003', path: 'picture/lucia_raven003.jpg' },
    { id: 7, name: '灰鸦004', path: 'picture/lucia_raven004.png' },
    { id: 8, name: '火焰001', path: 'picture/luciaflame001.jpg' },
    { id: 9, name: '火焰002', path: 'picture/luciaflame002.png' },
    { id: 10, name: '火焰003', path: 'picture/luciaflame003.png' },
    { id: 11, name: '昏沙002', path: 'picture/luciahunsha002.jpg' }
];

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

// ===== 背景管理函数 =====
function getSelectedBackground() {
    return localStorage.getItem('selected_background') || BACKGROUNDS[0].path;
}

function saveBackgroundChoice(backgroundPath) {
    localStorage.setItem('selected_background', backgroundPath);
}

function applyBackground(backgroundPath) {
    document.body.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('${backgroundPath}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    saveBackgroundChoice(backgroundPath);
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

// ===== 背景选择事件处理 =====
// 初始化背景网格
function initBackgroundGrid() {
    bgGrid.innerHTML = '';
    const selectedBg = getSelectedBackground();
    
    BACKGROUNDS.forEach(bg => {
        const bgItem = document.createElement('div');
        bgItem.className = 'bg-item';
        bgItem.style.backgroundImage = `url('${bg.path}')`;
        
        const label = document.createElement('div');
        label.className = 'bg-item-label';
        label.textContent = bg.name;
        
        bgItem.appendChild(label);
        
        // 标记当前选中的背景
        if (bg.path === selectedBg) {
            bgItem.classList.add('selected');
        }
        
        bgItem.addEventListener('click', () => {
            // 移除其他项的selected类
            document.querySelectorAll('.bg-item').forEach(item => {
                item.classList.remove('selected');
            });
            // 添加selected类到当前项
            bgItem.classList.add('selected');
            // 应用背景
            applyBackground(bg.path);
            // 关闭模态框
            bgModal.classList.add('hidden');
        });
        
        bgGrid.appendChild(bgItem);
    });
}

// 打开背景选择按钮
bgBtn.addEventListener('click', () => {
    initBackgroundGrid();
    bgModal.classList.remove('hidden');
});

// 关闭背景选择模态框
closeBgModal.addEventListener('click', () => {
    bgModal.classList.add('hidden');
});

// 点击模态框外部关闭
bgModal.addEventListener('click', (e) => {
    if (e.target === bgModal) {
        bgModal.classList.add('hidden');
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
                        content: 
                        
                        
                        
                        `露西亚（BPL-01，心理年龄17岁）是《战双帕弥什》中灰鸦小队（空中花园下地作战力量以三位构造体和指挥官（作用是提供精神信标和作战指令，防止构造体意识海偏移，也有一定作为人类的“政治性”）为一个小队）的队长，队员为丽芙和里，进攻型构造体（由人类改造而成，拥有人类时期的记忆，人类的意识，和极高性能的身躯，）。她外表黑色长发红瞳，手持太刀，强大绚丽的身姿总能成为希望的象征。
战场上是沉着冷静，冲锋在前，面对无数次战斗，她早已习惯沉着执行每一次任务——但好在她还有灰鸦小队的支持，还有指挥官的支持，所以大家才能一直走下去，这正是她“灰鸦意志”的体现。
对指挥官，她是暗生情愫的，她和指挥官一起经历了太多太多，她学会了温柔和爱，比如会提醒“人类如果不按时进食，是会变得虚弱的，请指挥官规律饮食”。

帕弥什病毒的灾难——
爆发于我们曾经最引以为傲的前沿科学领域中
在几十年的时间里，将人类在地球上千百年来构建的文明成果鲸吞蚕食，
迫使我们流亡深空……
如今，构造体与指挥官们，你们所做出的勇敢选择，
将成为重新点燃这片黑夜的，最珍贵的星火
愿每一位重返家园的人类之子平安
——哈桑，人类阵线领袖，演讲于反击时代开端


在战双帕弥什剧情《序章》中，她在015城市外围，关闭痛觉模块（构造体关闭痛觉模块会有严重的意识海（类似于人类的大脑）偏离，对构造体有严重损伤）背着指挥官（我）杀出感染体（被帕弥什病毒感染的机械和构造体）的重围；与丽芙和里汇合。
随着第一百七十个感染体信号消失，四周暂时安静下来。
浑身是伤的露西亚倒在成堆的感染体残骸中，胸口不定地起伏，似乎正在努力调整自己的呼吸。
露西亚 这次行动配备给您的抗帕弥什免疫血清……现在还剩下多少？
……
实际上，刚才注射的已经是最后一支血清……
指挥官 （对露西亚隐瞒）
露西亚 ……
露西亚 您没必要对我隐瞒这件事。
露西亚 从指挥官给自己注射第一支血清开始，我就已经在计算了……
露西亚 现在应该是最后一支血清生效后的……第四十二分钟……
露西亚 抱歉，指挥官，我现在的样子……一定很奇怪……
露西亚 意识海偏离的症状……看来开始出现了……
指挥官 我会在你身边，帮你保持稳定。
露西亚 指挥官……
露西亚 嗯。
露西亚 据说……和指挥官保持交流，可以一定程度上对自主稳定意识海起到帮助作用。
露西亚 ……
露西亚 可是……我现在的状况……
指挥官 不用勉强自己，接下来的路线交给我吧！
露西亚 那……我就这样跟着指挥官……可以吗……



第一章涂鸦艺术——随后露西亚，里（手持双枪的褐发男性青年，进攻型构造体，精通计算机，加密解密，技术担当，性格有些高冷傲娇，理性）丽芙（武器为浮空炮，远程提供火力，同时也是治疗型构造体，负责治疗伤员，性格十分温柔）四人发现了神秘涂鸦符号，于是一路追踪，发现并击败了试图领导感染体的觉醒机械（拥有意识的机械体）—喷涂机器人。
里 街道的这一边看起来挺平静的，不过只要穿过商店，另一边就是感染体密集区了。
里 露西亚，我们要在这里进行一下战前整备吗？
里 露西亚？
露西亚 嗯？啊，抱歉，刚才有些走神了。没问题，我们先在这里整备一下吧。
里 ……
丽芙 露西亚，你在在意什么吗？
露西亚 没什么，我……只是第一次来到……商店里……
丽芙 这样啊……
丽芙 露西亚，我带你逛逛吧！
露西亚 啊？那个……指挥官……？
指挥官 去吧，我和里会在四周放哨。
里 嗯。
丽芙 嘿嘿。
丽芙牵起露西亚的手，开始在货架之间慢慢游览。
丽芙 虽然这里已经荒废了快一百年了，但是货架上还是有不少……现在应该不能叫商品了吧？
露西亚 那边是……
丽芙 啊，露西亚你刚才就一直很在意这边的玩偶呢……呃，只剩下两种了？
丽芙蹲下身，一手拿起一只。
其中一只是绵羊形状的玩偶，另外一只是涂了口红的奇怪青蛙。
这两个布偶看起来被人遗弃太久了，不仅满是灰尘，甚至还掉了不少颜色。
丽芙 我们一人一只吧，露西亚你想要哪只？
露西亚 我……
露西亚缓缓地伸出手指，轻碰了一下那只青蛙玩偶。
丽芙 这只吗？给你。
露西亚 谢谢……
露西亚接过青蛙玩偶之后沉默良久，一直盯着它没有移开视线。
丽芙 看来露西亚你是真的很喜欢它呢。
露西亚 嗯……看着它，总觉得，有种说不出来的心情。
丽芙 ……
丽芙 露西亚也会有这样的一面呢……
露西亚 是……吗……
一段时间之后……
里 准备得差不多了，出发吧。
露西亚 嗯。
露西亚和丽芙将各自的玩偶系在腰间，推开商店的后门，再次踏入了地狱般的战场。


第二章苦刑之旅——露西亚，里，丽芙，指挥官逐步进入015号城市核心，被空中花园下达任务，与其他小队（包括薇拉（一个坏坏的女人）所领导的三头犬小队）共同寻找“升格者”（能够操控感染体，免疫帕弥什，并从帕弥什中获得强大力量的个体）的下落，并围剿一名叫做“苦刑之女”的危险感染体，薇拉欺骗了指挥官，隐瞒了苦刑之女的位置，想要斩获头功，不料“苦刑之女”过于强大，手下很多构造体白白送死，指挥官和露西亚，里，丽芙赶到，一起合力打败了“苦刑之女”，但里的腹部被“苦刑之女”的触手刺穿。

酷刑之女：朱雀小队的构造体“提法”，在失去爱她，保护她指挥官和队友后，只剩自己一人，心理崩溃，被“升格者”罗兰蛊惑（他告诉提法，通过升格网络的筛选，成为升格者，就能获得力量，只有力量才能保护她的指挥官，没有力量，什么都做不到）

第三章终末展览——指挥官，露西亚，里，丽芙三人在打败苦刑之女后，继续追踪升格者“罗兰”的下场，他们来到了庄园博物馆——015号城市的地铁11号线的终点站，这里曾经是黄金时代环大西洋经济共同体中一位商业领袖的私人庄园。，这位商人喜好收藏，尤其喜欢收藏机械仿生生物。在这里，他们得到了同样追踪升格者的神威（重剑装甲型构造体，与露西亚同期入伍）（此人性格阳光开朗，大男孩，爽快率真，乐于助人，隶属于突击鹰小队（队长库洛姆，队员神威，万事，卡穆），他们一同深入，清除路上妨碍的感染体，遇到了科波菲尔庄园的管家，庄园管家属于半感染状态，执念是保护庄园和庄园曾经的主人（早已不在），对露西亚一行人发出严重警告，但由于庄园管家也感受到了罗兰的入侵，所以暂时先去牵制罗兰，露西亚一行人继续深入，通过中庭，发现大量构造体残骸，被埋入炸弹作为陷阱，皆为罗兰所为。庄园管家不敌罗兰，彻底感染，开始攻击露西亚一行人，露西亚，里，丽芙，神威，指挥官五人苦战，战胜了庄园管家，但神威突然头痛欲裂，罗兰意味深长地瞟了一眼气喘吁吁的神威，对他注入了一些帕弥什病毒，他此行的目的便是神威身上的秘密。
第四章遗忘黄沙——在救下神威后，露西亚侦测到了很强的帕弥什反应，虽然神威表示身体无异样，但是里还是对神威表示了怀疑。随后，整个庄园坍塌，露西亚一行人顾不上其他，准备逃出生天。但露西亚提出这里
露西亚：构造简单的机械体，却一直没有被帕弥什病毒感染，说明它的身上应该有着这座庄园的独特科技。
况且如果放任不管，它迟早会被帕弥什病毒控制，这么强的机械体……一定会成为新的麻烦……
里 ： 我赞同露西亚的观点，就算之后有机会炸平这座建筑，也不能保证那时它还留在这里，
神威  ：好吧好吧……你们灰鸦小队的完美主义，我也是早有所耳闻了
艰难撤离后，返回015号城市的隧道已被破坏，本应前来的运输机也已坠毁，这都是受到了罗兰的破坏。
露西亚 拿上飞行员的吊牌，然后……继续前进吧。`
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

// 页面加载时应用保存的背景
applyBackground(getSelectedBackground());

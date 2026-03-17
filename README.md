# 露西亚 AI 聊天应用

一个基于 DeepSeek API 的 AI 聊天应用，将你的浏览器变成与《战双帕弥什》灰鸦小队队长露西亚对话的平台。

## 📝 项目介绍

这是一个使用 GitHub Pages 托管的网页应用，集成了 DeepSeek AI API，让你可以与露西亚进行自然对话。应用具有：

- AI 对话：基于 DeepSeek API 的对话能力
- 角色扮演：露西亚的完整人物设定与背景故事
- 对话历史：自动保存对话记录到本地存储
- 背景切换：丰富的主题背景精美切换
- 隐私保护：API Key 仅存储本地，无服务器存储

## 🌐 访问地址

https://jas2233.github.io/

## 🎮 使用方法

1. 访问网站链接
2. 点击右上角 ⚙️ 按钮打开设置面板
3. 输入你的 DeepSeek API Key
4. 在文本框输入消息，按 Enter 发送
5. 点击左下方 🖼️ 按钮切换背景

### 快捷键

- **Enter**：发送消息
- **Shift + Enter**：在消息中换行

## 📂 项目结构

```
Lucia.github.io/
├── index.html          # 网页结构和 UI 元素
├── style.css           # 样式表和视觉设计
├── script.js           # 应用逻辑、API 交互
├── picture/            # 背景图片目录
└── README.md           # 项目文档
```

## 🔧 技术栈

- **前端**：HTML5, CSS3, Vanilla JavaScript
- **托管**：GitHub Pages
- **API**：DeepSeek API (deepseek-chat)
- **存储**：浏览器 LocalStorage

## 🛠️ 自定义配置

### 添加新背景

编辑 `script.js`，在 `BACKGROUNDS` 数组中添加新项：

```javascript
const BACKGROUNDS = [
    { id: 1, name: '背景名称', path: 'picture/背景文件.jpg' },
    // ... 更多背景
];
```

### 修改 AI 角色设定

编辑 `script.js` 中的 `callDeepSeekAPI()` 函数，修改 `role: 'system'` 的内容来改变 AI 的行为和人格。

### 调整样式

编辑 `style.css` 可以修改：
- 颜色方案
- 字体和文字大小
- 布局和间距
- 动画效果

## 💾 本地存储说明

应用使用浏览器的 LocalStorage 存储以下数据：

- `conversation_history`：对话历史记录（最多 200 条）
- `selected_background`：当前选中的背景
- `deepseek_api_key`：DeepSeek API Key（可随时清除）

**隐私声明**：所有数据仅保存在你的浏览器本地，不会发送到任何第三方服务器。

## 🔐 API 密钥安全建议

- API Key 仅存储在浏览器本地
- 不要在公共计算机上保存 API Key
- 定期检查你的 DeepSeek 账户使用情况
- 如需重置，点击设置面板中的"清除"按钮

## 🚀 部署更新

项目使用 GitHub Pages 自动部署：

```bash
git add .
git commit -m "描述你的更改"
git push origin main
```

更新会在几秒内自动生效。

## 📝 许可证

请参考项目许可证信息。

## 💡 添加功能建议

- 添加更多项目
- 添加博客部分
- 集成联系表单
- 添加深色主题切换
- 优化 SEO

## 📞 联系

更新 `index.html` 中的联系方式部分，添加你的：
- 电子邮件
- GitHub 链接
- LinkedIn、Twitter 等社交媒体

---

设置完成！现在开始定制你的网站吧！

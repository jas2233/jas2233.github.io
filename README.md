# 露西亚 AI 聊天应用

一个基于 DeepSeek API 的 AI 聊天应用，将你的浏览器变成与《战双帕弥什》灰鸦小队队长露西亚对话的平台。

## 📝 项目介绍

这是一个使用 Vue 3 构建、通过 GitHub Pages 托管的网页应用，集成了 DeepSeek AI API，让你可以与露西亚进行自然对话。应用具有：

- AI 对话：基于 DeepSeek API 的对话能力
- 角色扮演：露西亚的完整人物设定与背景故事
- 对话历史：自动保存对话记录到本地存储
- 背景切换：丰富的主题背景精美切换
- 隐私保护：API Key 仅存储本地，无服务器存储

## 🌐 访问地址

https://jas2233.github.io/

## 🎮 使用方法

### 本地运行

项目现在需要通过 Vite 启动，不能再直接双击 `index.html`。在项目目录打开终端后运行：

```bash
cmd /c npm install
cmd /c npm run dev
```

终端会显示一个本地网址，通常是 `http://localhost:5173/`，按住 Ctrl 点击即可打开。

### 开始聊天

1. 打开本地网址或线上网站
2. 点击右上角 ⚙️ 按钮打开设置面板
3. 输入你的 DeepSeek API Key
4. 在文本框输入消息，按 Enter 发送
5. 点击左下方 🖼️ 按钮切换背景

### 快捷键

- **Enter**：发送消息
- **Shift + Enter**：在消息中换行

## 📂 项目结构

```text
Lucia.github.io/
├── src/
│   ├── App.vue                  # 主界面和交互状态
│   ├── components/ChatMessage.vue
│   ├── data/lucia.js            # 露西亚角色设定
│   └── services/                # DeepSeek、流式解析与本地存储
├── picture/                     # 背景图片目录
├── scripts/check-sse.mjs        # 流式解析检查
├── index.html                   # Vue 入口
├── style.css                    # 视觉设计
├── package.json                 # 依赖和运行命令
└── vite.config.js               # 构建配置
```

根目录旧的 `script.js` 和 `stream-parser.js` 是迁移前备份，新版页面不会加载它们。

## 🔧 技术栈

- **前端**：Vue 3、HTML5、CSS3、JavaScript
- **构建工具**：Vite
- **托管**：GitHub Pages
- **API**：DeepSeek API（deepseek-v4-flash，SSE 流式输出）
- **存储**：浏览器 LocalStorage

## 🛠️ 自定义配置

### 添加新背景

编辑 `src/App.vue`，在 `BACKGROUNDS` 数组中添加新项并导入图片：

```javascript
import newBackground from '../picture/背景文件.jpg'

const BACKGROUNDS = [
    { id: 1, name: '背景名称', path: 'picture/背景文件.jpg', url: newBackground },
    // ... 更多背景
];
```

### 修改 AI 角色设定

编辑 `src/data/lucia.js` 可以修改露西亚的角色设定。

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

**隐私声明**：API Key 和对话记录保存在浏览器本地；发送消息时，API Key 和相关对话内容会发送给 DeepSeek API。

所有本地读写集中在 `src/services/storage.js`，界面组件不再直接操作 LocalStorage。

## 🔐 API 密钥安全建议

- API Key 仅存储在浏览器本地
- 不要在公共计算机上保存 API Key
- 定期检查你的 DeepSeek 账户使用情况
- 如需重置，点击设置面板中的"清除"按钮

## 🚀 部署更新

项目已经包含 GitHub Pages 自动部署流程。把代码推送到 `main` 分支后，GitHub Actions 会安装依赖、检查项目、构建 `dist` 并发布。

第一次使用时，需要在 GitHub 仓库的 `Settings → Pages → Build and deployment` 中把来源选择为 `GitHub Actions`。

如果项目目录中存在 `.git`，可以使用：

```bash
git add .
git commit -m "描述你的更改"
git push origin main
```

GitHub Pages 通常需要等待一小段时间才能显示更新。不要直接把未构建的 Vue 源码当作静态网页发布。

如果目录中没有 `.git`，说明它可能是下载的 ZIP 副本，以上 Git 命令暂时不能使用。最简单的做法是重新从原 GitHub 仓库使用 `git clone` 下载；也可以在确认远程仓库地址后，再初始化 Git。

当前项目没有附带 `LICENSE` 文件，因此 README 不再声明已有许可证。需要公开授权他人使用代码时，再选择合适的许可证并添加该文件。

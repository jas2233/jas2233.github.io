# GPT-SoVITS Worker 部署步骤

代码已经按以下链路实现：网页创建任务，Vercel 将加密任务写入 Supabase，Windows Worker 每 2 秒领取任务，调用本机 GPT-SoVITS，再根据目标从电脑播放或上传给手机播放。

## 1. 执行数据库迁移

在 Supabase 项目的 SQL Editor 中完整执行：

```text
server/migrations/002_voice_tasks.sql
```

这份 SQL 会同时创建 `voice_tasks` 表、任务 RPC 函数和私有 `voice-audio` 存储桶。成功后在 Table Editor 中应看到 `voice_tasks`，在 Storage 中应看到 Private 的 `voice-audio`。

## 2. 生成两个不同的密钥

在 PowerShell 中将下面命令运行两次：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

第一次结果作为 `VOICE_TASK_KEY`，第二次结果作为 `VOICE_WORKER_TOKEN`。不要把真实值写入 Git、截图或聊天记录。

## 3. 配置 Vercel

进入 Vercel 项目的 Settings → Environment Variables，新增：

```text
VOICE_TASK_KEY=第一次生成的值
VOICE_WORKER_TOKEN=第二次生成的值
SUPABASE_VOICE_BUCKET=voice-audio
```

保存后重新部署。原有的 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 和 `ACCESS_PASSWORD` 必须保留。

## 4. 配置 Windows Worker

在项目根目录运行：

```powershell
Copy-Item .\voice-worker.env.example .\.env.voice
notepad .\.env.voice
```

只需把 `.env.voice` 中的 `VOICE_WORKER_TOKEN` 改成 Vercel 中完全相同的第二个密钥。默认模型、参考音频、参考文本和正式 Vercel 地址已经填写。

## 5. 启动本地服务

终端一，在 `C:\GPT-SoVITS_V4_250424` 中运行：

```powershell
& ".\env\python.exe" ".\api_v2.py" -a 127.0.0.1 -p 9880 -c ".\GPT_SoVITS\configs\tts_infer.yaml"
```

终端二，在聊天项目根目录运行：

```powershell
npm.cmd run voice:worker
```

Worker 每次启动都会先加载 SoVITS e1，再加载 GPT e5，然后开始每 2 秒领取一次任务。不要关闭这两个终端，电脑也不能进入睡眠。

## 6. 验收

在网页中发送一条消息，等露西亚回复完成。回复下方会出现“电脑播放”和“手机播放”：

- 点击“电脑播放”：任务完成后由 Windows 音箱播放，Supabase 不保存 WAV。
- 点击“手机播放”：WAV 直传私有 Storage，网页获得十分钟有效的签名地址并显示播放器。

若任务一直显示“等待电脑”，先检查 Worker 窗口。`401` 表示两处 `VOICE_WORKER_TOKEN` 不一致；GPT-SoVITS 错误通常表示 API 已关闭或参考文件不可读取；Supabase 上传错误应检查迁移是否完整执行。

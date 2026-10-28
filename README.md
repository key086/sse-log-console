# sse-log-console

**零依赖**实时日志网页控制台：`tail` 日志文件或包装任意命令，浏览器里实时观看 —— SSE 推送、自动滚动、错误/警告级别高亮、关键字过滤、断线重连、日志轮转自动跟随。

> 源自生产环境用了多年的 Flask SSE 部署控制台，这是它的 Node.js 零依赖重写版：把"部署时盯日志"从 SSH 终端搬进浏览器，团队所有人都能看。

## 快速开始

```bash
# 不用安装，直接跑
npx sse-log-console -f /var/log/nginx/access.log

# tail 应用日志
npx sse-log-console -f ./logs/app.log

# 包装构建命令，浏览器实时看构建输出（CI 排错神器）
npx sse-log-console -c "npm run build" -p 8080

# 同时盯多个文件 + 一个命令
npx sse-log-console -f app.log -f error.log -c "node server.js"
```

打开 `http://localhost:7801` 即可。

## 选项

| 选项 | 说明 | 默认 |
|---|---|---|
| `-f, --file` | tail 的日志文件（可多个） | - |
| `-c, --command` | 包装执行的命令，stdout/stderr 实时推送 | - |
| `-p, --port` | Web 端口 | 7801 |
| `--host` | 监听地址 | 0.0.0.0 |

## 特性

- 🌊 **SSE 实时推送** — 浏览器 `EventSource` 自动重连，服务端记录增量位置（`fs.stat` 轮询 + `fs.watch` 双保险）
- 🔄 **日志轮转跟随** — 检测到文件被截断（logrotate）自动从头继续读
- 🎨 **级别高亮** — error/exception 红、warn 黄、success/done 绿、stderr 橙
- 🔍 **关键字过滤 + 自动滚动开关 + 清屏** — 前端内置，5000 行滚动缓冲防爆内存
- 🧹 **ANSI 转义清洗** — 彩色终端输出转成干净文本
- 📦 **零依赖** — 只用 Node 内置模块，装完就能跑，无供应链风险

## 典型场景

1. **部署盯盘**：部署脚本触发后打开控制台，团队实时围观发布日志
2. **CI 排错**：`-c "npm run build"` 包装构建，失败瞬间看到红色错误行
3. **生产巡检**：服务器上常驻 `sse-log-console -f /var/log/app.log`，代替反复 SSH tail
4. **演示/教学**：把命令行输出投到浏览器大屏

## License

MIT © iien21

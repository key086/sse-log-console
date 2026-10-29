# sse-log-console

**Zero-dependency real-time log console for the browser — tail log files or wrap any command and watch it live over Server-Sent Events.**

[![npm version](https://img.shields.io/npm/v/sse-log-console)](https://www.npmjs.com/package/sse-log-console)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)

English | [中文](./README.md)

Turn "watching the deploy logs" from an SSH session into a web page the whole team can open. Tail one or more log files, or wrap any shell command and stream its stdout/stderr to the browser in real time — with auto-scroll, level highlighting, keyword filtering and automatic reconnection.

## Features

- 🌊 **Live SSE streaming** — the browser's `EventSource` reconnects automatically; the server tracks incremental file positions with `fs.watch` plus a 1s `fs.stat` polling fallback
- 🔄 **Log rotation aware** — when a file is truncated (e.g. by logrotate), tailing resumes from the top automatically
- 🕘 **Instant history** — the last 64 KB of each file is replayed on startup, and a 500-event ring buffer backfills new browser connections
- 🎨 **Level highlighting** — error/exception in red, warnings in yellow, success/done in green, stderr in orange
- 🔍 **Built-in web UI** — keyword filter, auto-scroll toggle, clear button, and a 5000-line scroll buffer so the page never eats your memory
- 🧹 **ANSI escape cleanup** — colorful terminal output is stripped to clean text
- 📦 **Zero dependencies** — Node built-ins only, nothing to audit, no supply-chain risk

## Quick Start

No installation needed:

```bash
# Tail a log file
npx sse-log-console -f /var/log/nginx/access.log

# Tail your app log
npx sse-log-console -f ./logs/app.log

# Wrap a build command and watch its output live in the browser (great for CI debugging)
npx sse-log-console -c "npm run build" -p 8080

# Watch multiple files and a command at the same time
npx sse-log-console -f app.log -f error.log -c "node server.js"
```

Then open `http://localhost:7801`.

Or install it as a dependency / global tool:

```bash
npm install sse-log-console
npx sse-log-console -f ./logs/app.log

# or globally
npm install -g sse-log-console
sse-log-console -f /var/log/app.log
```

## CLI Usage

```
sse-log-console -f <logfile>... [-c <command>] [-p port] [--host address]
```

At least one of `-f` or `-c` is required.

| Option | Description | Default |
|---|---|---|
| `-f, --file` | Log file(s) to tail (repeatable) | - |
| `-c, --command` | Command to wrap; its stdout/stderr are streamed live | - |
| `-p, --port` | Web port | `7801` |
| `--host` | Listen address | `0.0.0.0` |
| `-h, --help` | Show help | - |

## How It Works

The CLI starts a tiny HTTP server with two routes:

- `GET /` — serves the embedded dark-theme web console (a single self-contained HTML page, no build step, no frontend assets).
- `GET /events` — an SSE endpoint. Every log line is broadcast to all connected clients as a JSON event; the last 500 events are kept in a ring buffer and replayed to each new client so a freshly opened page shows recent history immediately.

For file tailing, the server remembers its byte offset and reads only new bytes on change, detected via both `fs.watch` and a 1-second `fs.stat` poll (because `fs.watch` is unreliable on some systems). If the file shrinks, it is treated as log rotation and reading restarts from offset 0. For wrapped commands, the process is spawned through a shell and both stdout and stderr are piped, line-buffered, ANSI-cleaned and broadcast.

Each SSE event looks like:

```json
{ "type": "line", "source": "/var/log/app.log", "line": "...", "ts": 1730000000000 }
```

`type` is `line` (a log line), `info` (server notices such as "started watching …" or "process exited") or `error`. `stream` is set to `stdout`/`stderr` for wrapped commands, and `source` is set to the file path for tailed files.

## Typical Scenarios

1. **Deploy watch parties** — trigger a deploy, open the console, and let the whole team watch the release log together
2. **CI debugging** — wrap the build with `-c "npm run build"` and see failing lines highlighted in red the moment they happen
3. **Production inspection** — keep `sse-log-console -f /var/log/app.log` running on the server instead of SSH-ing in to `tail -f` over and over
4. **Demos & teaching** — project command-line output onto a big screen in the browser

## Origin Story

This is a Node.js rewrite of a Flask-based SSE deploy console that ran in production for years. The original solved one problem well: during a deploy, everyone — not just the person holding the SSH session — could watch the logs in a browser. This version keeps that workflow and drops every dependency, so it installs instantly and has no supply-chain surface at all.

## License

[MIT](./LICENSE)

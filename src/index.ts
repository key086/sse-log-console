#!/usr/bin/env node
/**
 * sse-log-console — 零依赖实时日志网页控制台
 *
 * tail 日志文件 / 包装任意命令，浏览器实时观看（SSE 推送、自动滚动、级别高亮、关键字过滤、断线重连）。
 * 源自生产环境用过的 Flask SSE 部署控制台，这是它的 Node 零依赖重写版。
 *
 *   sse-log-console -f /var/log/app.log                # tail 文件
 *   sse-log-console -c "npm run build"                 # 包装命令，实时看构建输出
 *   sse-log-console -f app.log -f nginx.log -p 8080    # 多文件 + 自定义端口
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { renderUI } from "./ui.js";

export interface Args {
  files: string[];
  command?: string;
  port: number;
  host: string;
}

/* ---------- 参数解析 ---------- */

function parseArgs(argv: string[]): Args {
  const args: Args = { files: [], port: 7801, host: "0.0.0.0" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-f" || a === "--file") args.files.push(argv[++i]);
    else if (a === "-c" || a === "--command") args.command = argv[++i];
    else if (a === "-p" || a === "--port") args.port = Number(argv[++i]);
    else if (a === "--host") args.host = argv[++i];
    else if (a === "-h" || a === "--help") {
      console.log(`sse-log-console — 零依赖实时日志网页控制台

用法:
  sse-log-console -f <日志文件>... [-c <命令>] [-p 端口] [--host 地址]

选项:
  -f, --file     tail 的日志文件（可多个）
  -c, --command  包装执行的命令，stdout/stderr 实时推送
  -p, --port     Web 端口，默认 7801
      --host     监听地址，默认 0.0.0.0

示例:
  sse-log-console -f /var/log/app.log
  sse-log-console -c "npm run build" -p 8080
  sse-log-console -f app.log -c "node server.js"`);
      process.exit(0);
    }
  }
  if (!args.files.length && !args.command) {
    console.error("错误：至少指定 -f <文件> 或 -c <命令> 之一（-h 查看帮助）");
    process.exit(1);
  }
  return args;
}

/* ---------- SSE 广播 ---------- */

type Sender = (payload: string) => void;
const clients = new Set<Sender>();

interface LogEvent {
  type: "line" | "info" | "error";
  stream?: string;
  source?: string;
  line: string;
  ts: number;
}

/** 最近事件环形缓冲：新客户端连上先补发历史，打开页面就能看到之前的日志 */
const BACKLOG_SIZE = 500;
const backlog: string[] = [];

function broadcast(ev: LogEvent): void {
  const payload = `data: ${JSON.stringify(ev)}\n\n`;
  backlog.push(payload);
  if (backlog.length > BACKLOG_SIZE) backlog.shift();
  for (const send of clients) send(payload);
}

/* ---------- 文件 tail ---------- */

const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
const clean = (s: string): string => s.replace(ANSI_RE, "");

function tailFile(file: string, tailKb = 64): void {
  const abs = path.resolve(file);
  let pos = 0;
  let partial = "";

  // 启动时回放末尾最多 tailKb KB 的完整行
  try {
    const st = fs.statSync(abs);
    pos = st.size;
    const readSize = Math.min(st.size, tailKb * 1024);
    if (readSize > 0) {
      const fd = fs.openSync(abs, "r");
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, readSize, st.size - readSize);
      fs.closeSync(fd);
      const lines = clean(buf.toString("utf8")).split("\n");
      if (readSize < st.size) lines.shift(); // 从文件中间截取时首行可能不完整；小文件从头读则完整
      for (const l of lines) if (l.length) broadcast({ type: "line", source: abs, line: l, ts: Date.now() });
    }
  } catch (e) {
    broadcast({ type: "error", source: abs, line: `无法读取: ${(e as Error).message}`, ts: Date.now() });
  }

  const readNew = (): void => {
    fs.stat(abs, (err, st) => {
      if (err) return;
      if (st.size < pos) {
        pos = 0; // 日志轮转/截断，从头读
        broadcast({ type: "info", source: abs, line: "（检测到日志轮转，重新从头读取）", ts: Date.now() });
      }
      if (st.size > pos) {
        const len = st.size - pos;
        const buf = Buffer.alloc(len);
        try {
          const fd = fs.openSync(abs, "r");
          fs.readSync(fd, buf, 0, len, pos);
          fs.closeSync(fd);
        } catch {
          return;
        }
        pos = st.size;
        partial += clean(buf.toString("utf8"));
        const parts = partial.split("\n");
        partial = parts.pop() ?? "";
        for (const l of parts) if (l.length) broadcast({ type: "line", source: abs, line: l, ts: Date.now() });
      }
    });
  };

  try {
    fs.watch(abs, () => readNew());
  } catch {
    /* 文件暂不存在时靠轮询兜底 */
  }
  setInterval(readNew, 1000); // fs.watch 在部分系统不可靠，轮询兜底
  broadcast({ type: "info", source: abs, line: `开始监听 ${abs}`, ts: Date.now() });
}

/* ---------- 命令包装 ---------- */

function runCommand(cmd: string): void {
  broadcast({ type: "info", line: `$ ${cmd}`, ts: Date.now() });
  const child = spawn(cmd, { shell: true });
  const pipe = (stream: NodeJS.ReadableStream, name: string): void => {
    let partial = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      partial += clean(chunk);
      const parts = partial.split("\n");
      partial = parts.pop() ?? "";
      for (const l of parts) broadcast({ type: "line", stream: name, line: l, ts: Date.now() });
    });
  };
  pipe(child.stdout, "stdout");
  pipe(child.stderr, "stderr");
  child.on("exit", (code) =>
    broadcast({ type: "info", line: `进程退出（code=${code}）`, ts: Date.now() })
  );
  child.on("error", (e) =>
    broadcast({ type: "error", line: `命令启动失败: ${e.message}`, ts: Date.now() })
  );
}

/* ---------- HTTP 服务 ---------- */

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  const server = http.createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0];
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderUI(args));
      return;
    }
    if (url === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("retry: 2000\n\n");
      for (const payload of backlog) res.write(payload); // 补发历史
      const send: Sender = (payload) => {
        try {
          res.write(payload);
        } catch {
          clients.delete(send);
        }
      };
      clients.add(send);
      req.on("close", () => clients.delete(send));
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });

  server.listen(args.port, args.host, () => {
    const shown = args.host === "0.0.0.0" ? "localhost" : args.host;
    console.log(`🖥️  Log Console 已启动: http://${shown}:${args.port}`);
    for (const f of args.files) console.log(`   📄 tail ${path.resolve(f)}`);
    if (args.command) console.log(`   ⚙️  命令 ${args.command}`);
    console.log("   Ctrl+C 退出");
    for (const f of args.files) tailFile(f);
    if (args.command) runCommand(args.command);
  });
}

main();

export function renderUI(args) {
    const target = [
        ...args.files.map((f) => `📄 ${f}`),
        ...(args.command ? [`⚙️ ${args.command}`] : []),
    ].join(" &nbsp;|&nbsp; ");
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Log Console</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d1117; color: #c9d1d9; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; height: 100vh; display: flex; flex-direction: column; }
  header { padding: 10px 16px; background: #161b22; border-bottom: 1px solid #30363d; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  header .title { font-weight: 600; color: #58a6ff; }
  header .target { color: #8b949e; font-size: 12px; }
  header .spacer { flex: 1; }
  header label { font-size: 12px; color: #8b949e; display: flex; align-items: center; gap: 4px; cursor: pointer; }
  header input[type=text] { background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; padding: 4px 8px; border-radius: 6px; font-size: 12px; width: 180px; font-family: inherit; }
  header button { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: inherit; }
  header button:hover { border-color: #58a6ff; }
  #status { width: 8px; height: 8px; border-radius: 50%; background: #f85149; }
  #status.on { background: #3fb950; }
  #count { font-size: 12px; color: #8b949e; }
  #log { flex: 1; overflow-y: auto; padding: 8px 16px; font-size: 13px; line-height: 1.6; }
  .line { white-space: pre-wrap; word-break: break-all; }
  .line .ts { color: #484f58; margin-right: 8px; }
  .line .src { color: #8b949e; margin-right: 8px; font-size: 11px; }
  .line.err { color: #f85149; }
  .line.warn { color: #d29922; }
  .line.ok { color: #3fb950; }
  .line.info { color: #58a6ff; }
  .line.stderr { color: #d29922; }
  .hidden { display: none; }
</style>
</head>
<body>
<header>
  <div id="status" title="连接状态"></div>
  <span class="title">Log Console</span>
  <span class="target">${target}</span>
  <span class="spacer"></span>
  <span id="count">0 行</span>
  <input type="text" id="filter" placeholder="过滤关键字…">
  <label><input type="checkbox" id="autoscroll" checked> 自动滚动</label>
  <button id="clear">清屏</button>
</header>
<div id="log"></div>
<script>
(function () {
  var log = document.getElementById('log');
  var count = document.getElementById('count');
  var filter = document.getElementById('filter');
  var autoscroll = document.getElementById('autoscroll');
  var status = document.getElementById('status');
  var MAX_LINES = 5000;
  var total = 0;

  function level(line, stream) {
    if (stream === 'stderr') return 'stderr';
    if (/\\b(error|fail(ed|ure)?|exception|fatal|panic)\\b/i.test(line)) return 'err';
    if (/\\b(warn(ing)?)\\b/i.test(line)) return 'warn';
    if (/\\b(success|done|ok|passed|completed|✅)\\b/i.test(line)) return 'ok';
    return '';
  }

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function applyFilter(el) {
    var kw = filter.value.trim().toLowerCase();
    el.classList.toggle('hidden', !!kw && el.textContent.toLowerCase().indexOf(kw) === -1);
  }

  function add(data) {
    var div = document.createElement('div');
    var cls = 'line ' + (data.type === 'info' ? 'info' : level(data.line, data.stream));
    div.className = cls.trim();
    var ts = new Date(data.ts).toLocaleTimeString('zh-CN', { hour12: false });
    var src = data.source ? '<span class="src">' + esc(String(data.source).split('/').pop()) + '</span>' : '';
    div.innerHTML = '<span class="ts">' + ts + '</span>' + src + esc(data.line);
    log.appendChild(div);
    total++;
    while (log.children.length > MAX_LINES) log.removeChild(log.firstChild);
    count.textContent = total + ' 行';
    applyFilter(div);
    if (autoscroll.checked) log.scrollTop = log.scrollHeight;
  }

  filter.addEventListener('input', function () {
    Array.prototype.forEach.call(log.children, applyFilter);
  });
  document.getElementById('clear').addEventListener('click', function () {
    log.innerHTML = ''; total = 0; count.textContent = '0 行';
  });

  function connect() {
    var es = new EventSource('/events');
    es.onopen = function () { status.classList.add('on'); };
    es.onerror = function () { status.classList.remove('on'); };
    es.onmessage = function (e) {
      try { add(JSON.parse(e.data)); } catch (_) {}
    };
  }
  connect();
})();
</script>
</body>
</html>`;
}

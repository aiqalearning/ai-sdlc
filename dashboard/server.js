'use strict';

/*
 * AI-SDLC dashboard — a thin local web UI that DRIVES the real pipeline.
 *
 * "Run" spawns Claude Code headless (`claude -p "/sdlc:run <ID>" --output-format
 * stream-json`) in the plugin repo, so the exact same skills/commands/gates run as
 * they would from the terminal. The UI just triggers it and visualizes progress:
 *   - the 6-stage tracker is driven by the artifacts the pipeline writes to .sdlc/<ID>/
 *   - the live log is the parsed Claude Code event stream
 *
 * Nothing here reimplements the pipeline; it only invokes and observes it.
 */

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');
const express = require('express');

const REPO_ROOT = path.resolve(__dirname, '..');
const SDLC_DIR = path.join(REPO_ROOT, '.sdlc');
const TICKETS_DIR = path.join(REPO_ROOT, 'tickets');
const PORT = process.env.DASHBOARD_PORT || 4000;

// --- Resolve the Claude Code binary the IDE extension ships (latest version) ---
function resolveClaudeBinary() {
  if (process.env.CLAUDE_BIN && fs.existsSync(process.env.CLAUDE_BIN)) return process.env.CLAUDE_BIN;
  const extRoot = path.join(os.homedir(), '.vscode', 'extensions');
  let best = null;
  try {
    for (const d of fs.readdirSync(extRoot)) {
      if (!d.startsWith('anthropic.claude-code-')) continue;
      const bin = path.join(extRoot, d, 'resources', 'native-binary', 'claude');
      if (fs.existsSync(bin)) {
        // crude version sort by the numeric chunk after the prefix
        const ver = d.replace('anthropic.claude-code-', '');
        if (!best || ver.localeCompare(best.ver, undefined, { numeric: true }) > 0) best = { bin, ver };
      }
    }
  } catch { /* fall through */ }
  return best ? best.bin : null;
}
const CLAUDE_BIN = resolveClaudeBinary();

// --- Load repo .env so the spawned pipeline has Jenkins/GitHub creds ---
function loadEnv() {
  const env = { ...process.env };
  const envFile = path.join(REPO_ROOT, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2];
    }
  }
  return env;
}

// --- Pipeline stage model: each stage completes when its artifact appears ---
const STAGES = [
  { id: 'intake', label: 'Intake', cmd: '/sdlc:intake', artifact: 'spec.md' },
  { id: 'implement', label: 'Implement', cmd: '/sdlc:implement', artifact: 'implement.md' },
  { id: 'verify', label: 'Verify', cmd: '/sdlc:verify', artifact: 'verify.md' },
  { id: 'automate', label: 'Automate', cmd: '/sdlc:automate', artifact: 'automation.md' },
  { id: 'run-ci', label: 'Run CI', cmd: '/sdlc:run-ci', artifact: 'ci.md' },
  { id: 'ship', label: 'Ship', cmd: '/sdlc:ship', artifact: 'shipped.md' },
];

function readIf(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

function statusFor(id) {
  const dir = path.join(SDLC_DIR, id);
  const stages = STAGES.map((s) => {
    const body = readIf(path.join(dir, s.artifact));
    return { ...s, done: body != null };
  });
  // Pull a few headline facts out of the artifacts for the links panel.
  const ci = readIf(path.join(dir, 'ci.md')) || '';
  const shipped = readIf(path.join(dir, 'shipped.md')) || '';
  const spec = readIf(path.join(dir, 'spec.md')) || '';
  const facts = {
    branch: (spec.match(/feature\/[^\s`]+/) || [])[0] || null,
    jenkins: (ci.match(/https?:\/\/[^\s)]+\/job\/[^\s)]+/) || [])[0] || null,
    verdict: (ci.match(/Verdict:\*\*\s*(\w+)/) || [])[1] || null,
    passRate: (ci.match(/(\d+%\s*\(\d+\/\d+\))/) || [])[1] || null,
    pr: (shipped.match(/https?:\/\/github\.com\/[^\s)]+\/pull\/\d+/) || [])[0] || null,
    mergeSha: (shipped.match(/[0-9a-f]{40}/) || [])[0] || null,
  };
  return { id, stages, facts };
}

// --- In-memory run registry ---
const runs = new Map(); // runId -> { ticket, proc, events:[], clients:Set, done, exitCode }

function pushEvent(run, ev) {
  run.lastEventAt = Date.now();
  run.events.push(ev);
  if (run.events.length > 2000) run.events.shift();
  for (const res of run.clients) {
    try { res.write(`data: ${JSON.stringify(ev)}\n\n`); } catch { /* client gone */ }
  }
}

function summarizeClaudeMessage(obj) {
  // Translate a Claude Code stream-json line into a compact UI event (or null to skip).
  const t = obj.type;
  if (t === 'assistant' && obj.message?.content) {
    for (const c of obj.message.content) {
      if (c.type === 'text' && c.text?.trim()) return { kind: 'text', text: c.text.trim() };
      if (c.type === 'tool_use') {
        const name = c.name || 'tool';
        let detail = '';
        const inp = c.input || {};
        if (inp.command) detail = String(inp.command).slice(0, 140);
        else if (inp.file_path) detail = String(inp.file_path);
        else if (inp.path) detail = String(inp.path);
        return { kind: 'tool', text: `${name}${detail ? ' · ' + detail : ''}` };
      }
    }
    return null;
  }
  if (t === 'user' && obj.message?.content) {
    // A tool finished — emit a subtle tick so long-running commands don't look frozen.
    for (const c of obj.message.content) {
      if (c.type === 'tool_result') return { kind: 'ok', text: '↳ done' };
    }
    return null;
  }
  if (t === 'result') {
    return { kind: 'result', text: obj.is_error ? `run ended with error` : `run finished`, isError: !!obj.is_error };
  }
  return null;
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, claudeBin: CLAUDE_BIN, repo: REPO_ROOT });
});

app.get('/api/tickets', (_req, res) => {
  let ids = [];
  try {
    ids = fs.readdirSync(TICKETS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''));
  } catch { /* no tickets dir */ }
  res.json({ tickets: ids });
});

app.get('/api/status/:id', (req, res) => {
  res.json(statusFor(req.params.id));
});

app.post('/api/run', (req, res) => {
  if (!CLAUDE_BIN) return res.status(500).json({ error: 'Claude Code binary not found (set CLAUDE_BIN).' });
  const ticket = String(req.body?.ticket || '').trim();
  if (!/^[A-Z]+-\d+$/.test(ticket)) return res.status(400).json({ error: 'Invalid ticket key.' });
  const stopBeforeShip = req.body?.stopBeforeShip !== false; // default: dry-run through CI, no merge
  // Headless `claude -p` does NOT recognize plugin slash commands, so drive the pipeline
  // by telling the agent to follow the orchestrator + stage SKILL.md files directly.
  const stageList = `jira-intake, code-generation, app-verification, playwright-automation, jenkins-integration${stopBeforeShip ? '' : ', merge-gate'}`;
  const prompt =
    `Run the AI-SDLC pipeline for Jira ticket ${ticket}. Execute it by following the ` +
    `procedure in plugins/ai-sdlc/skills/sdlc-orchestrator/SKILL.md and each stage skill it ` +
    `references (${stageList}). The ticket is the local file tickets/${ticket}.md; resolve the ` +
    `target repo from plugins/ai-sdlc/config/repos.yaml. ` +
    (stopBeforeShip
      ? `Stop BEFORE the ship stage — do not open or merge a PR. `
      : `Run all stages through ship. `) +
    `Work fully autonomously; do not ask questions. Write each stage's artifact under .sdlc/${ticket}/.`;

  const runId = `${ticket}-${runs.size + 1}`;
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'bypassPermissions'];
  const proc = spawn(CLAUDE_BIN, args, { cwd: REPO_ROOT, env: loadEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  const run = { ticket, proc, events: [], clients: new Set(), done: false, exitCode: null, startedAt: Date.now(), lastEventAt: Date.now() };
  runs.set(runId, run);

  pushEvent(run, { kind: 'meta', text: `▶ pipeline for ${ticket}${stopBeforeShip ? ' (dry run — stop before ship)' : ''} · via headless Claude Code` });

  // Heartbeat: while alive and quiet (e.g. inside a long `playwright test` or Jenkins poll),
  // emit a "still working" tick so the UI never looks frozen.
  run.hb = setInterval(() => {
    if (run.done) return;
    if (Date.now() - run.lastEventAt > 8000) {
      const secs = Math.round((Date.now() - run.startedAt) / 1000);
      // don't bump lastEventAt via pushEvent so successive heartbeats keep firing
      const ev = { kind: 'heartbeat', text: `⋯ still working (${secs}s elapsed)` };
      run.events.push(ev);
      for (const res of run.clients) { try { res.write(`data: ${JSON.stringify(ev)}\n\n`); } catch { /* */ } }
    }
  }, 5000);

  let buf = '';
  proc.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const ev = summarizeClaudeMessage(JSON.parse(line));
        if (ev) pushEvent(run, ev);
      } catch { /* non-JSON line, ignore */ }
    }
  });
  proc.stderr.on('data', (c) => pushEvent(run, { kind: 'stderr', text: c.toString().trim().slice(0, 200) }));
  proc.on('close', (code) => {
    run.done = true; run.exitCode = code;
    clearInterval(run.hb);
    pushEvent(run, { kind: 'done', text: `process exited (${code})`, code });
  });

  res.json({ runId, prompt });
});

app.get('/api/events/:runId', (req, res) => {
  const run = runs.get(req.params.runId);
  if (!run) return res.status(404).end();
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders?.();
  for (const ev of run.events) res.write(`data: ${JSON.stringify(ev)}\n\n`); // backfill
  run.clients.add(res);
  req.on('close', () => run.clients.delete(res));
});

app.post('/api/stop/:runId', (req, res) => {
  const run = runs.get(req.params.runId);
  if (run && !run.done) { try { run.proc.kill('SIGTERM'); } catch { /* */ } }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`ai-sdlc dashboard on http://localhost:${PORT}  (claude: ${CLAUDE_BIN || 'NOT FOUND'})`);
});

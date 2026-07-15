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
const { spawn, execFile } = require('node:child_process');
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

// The target repo's owner/name, from repos.yaml (`github:` field).
function repoSlug() {
  const y = readIf(path.join(REPO_ROOT, 'plugins/ai-sdlc/config/repos.yaml')) || '';
  const m = y.match(/github:\s*([^\s#]+)/);
  return m ? m[1] : null;
}

// Look up the PR for a feature branch on GitHub (open OR merged) via gh, cached ~12s.
// Needed because the ship stage opens the PR but PAUSES for approval, so shipped.md
// (which carries the URL) isn't written until after merge.
const prCache = new Map(); // ticket -> { url, state, ts }
function lookupPr(ticket, branch) {
  return new Promise((resolve) => {
    const slug = repoSlug();
    if (!branch || !slug) return resolve(null);
    const cached = prCache.get(ticket);
    if (cached && Date.now() - cached.ts < 12000) return resolve(cached);
    execFile('gh',
      ['pr', 'list', '--repo', slug, '--head', branch, '--state', 'all', '--json', 'url,state,number', '--limit', '1'],
      { env: loadEnv(), timeout: 8000 },
      (err, stdout) => {
        if (err) return resolve(cached || null);
        try {
          const arr = JSON.parse(stdout);
          const pr = arr[0]
            ? { url: arr[0].url, state: String(arr[0].state || '').toLowerCase(), ts: Date.now() }
            : { url: null, ts: Date.now() };
          prCache.set(ticket, pr);
          resolve(pr);
        } catch { resolve(cached || null); }
      });
  });
}

function statusFor(id) {
  const dir = path.join(SDLC_DIR, id);
  const shippedBody = readIf(path.join(dir, 'shipped.md')) || '';
  // ship is only "done" when actually MERGED — shipped.md may instead document a pause
  // (PR opened, awaiting approval). Detect the merged case explicitly.
  const merged = /shipped|merged/i.test(shippedBody) && /[0-9a-f]{40}|merge commit|MERGED to main/i.test(shippedBody) && !/PAUSED|NOT merged/i.test(shippedBody);
  const shipPaused = shippedBody !== '' && !merged; // PR opened but not merged yet
  const stages = STAGES.map((s) => {
    const body = readIf(path.join(dir, s.artifact));
    let done = body != null;
    let paused = false;
    if (s.id === 'ship') { done = merged; paused = shipPaused; }
    return { ...s, done, paused };
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
const latestRunByTicket = new Map(); // ticket -> runId (so switching tickets restores its log)

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

// Liveness of the three stack services (checked server-side to dodge browser CORS).
app.get('/api/services', async (_req, res) => {
  const http = require('node:http');
  const ping = (url) => new Promise((resolve) => {
    const r = http.get(url, { timeout: 2500 }, (resp) => { resp.destroy(); resolve(true); });
    r.on('error', () => resolve(false));
    r.on('timeout', () => { r.destroy(); resolve(false); });
  });
  const [appUp, jenkinsUp] = await Promise.all([
    ping('http://localhost:3200/health'),
    ping('http://localhost:8080/login'),
  ]);
  res.json({
    app: { up: appUp, url: 'http://localhost:3200' },
    jenkins: { up: jenkinsUp, url: 'http://localhost:8080' },
    dashboard: { up: true, url: 'http://localhost:4000' },
  });
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

app.get('/api/status/:id', async (req, res) => {
  const s = statusFor(req.params.id);
  // If ship hasn't recorded a merged PR yet, surface the open PR live from GitHub.
  if (!s.facts.pr && s.facts.branch) {
    const pr = await lookupPr(req.params.id, s.facts.branch);
    if (pr && pr.url) { s.facts.pr = pr.url; s.facts.prState = pr.state; }
  }
  res.json(s);
});

app.get('/api/latest-run/:ticket', (req, res) => {
  res.json({ runId: latestRunByTicket.get(req.params.ticket) || null });
});

app.post('/api/run', (req, res) => {
  if (!CLAUDE_BIN) return res.status(500).json({ error: 'Claude Code binary not found (set CLAUDE_BIN).' });
  const ticket = String(req.body?.ticket || '').trim();
  if (!/^[A-Z]+-\d+$/.test(ticket)) return res.status(400).json({ error: 'Invalid ticket key.' });
  const shipOnly = req.body?.shipOnly === true;       // merge an already-approved PR (stage 6 only)
  // Default: run THROUGH ship — which opens the PR and PAUSES at approval (never auto-merges).
  // Only stops before ship if explicitly asked. The merge is always the separate "Merge" action.
  const stopBeforeShip = !shipOnly && req.body?.stopBeforeShip === true;

  // Guard: if the PR is open and only awaiting approval, re-running the pipeline would push
  // new commits — invalidating the CI status AND dismissing the approval (endless churn).
  const st0 = statusFor(ticket);
  const shipPaused = st0.stages.find((s) => s.id === 'ship')?.paused;
  const codeDone = st0.stages.slice(0, 5).every((s) => s.done);
  if (!shipOnly && shipPaused && codeDone) {
    return res.status(409).json({
      error: 'PR is open and awaiting approval. Re-running would push new commits and reset the approval + CI. ' +
             'Approve the PR, then click “⑥ Merge approved PR”.',
    });
  }

  // What's already done? Resume from the first incomplete stage instead of redoing everything.
  const done = st0.stages.filter((s) => s.done).map((s) => s.id);
  const doneNote = done.length
    ? `Stages already complete (their artifacts exist in .sdlc/${ticket}/): ${done.join(', ')}. ` +
      `RESUME from the first incomplete stage — do NOT redo a completed stage unless its inputs changed. `
    : '';

  // Headless `claude -p` does NOT recognize plugin slash commands, so drive the pipeline
  // by telling the agent to follow the orchestrator + stage SKILL.md files directly.
  let prompt, metaLabel;
  if (shipOnly) {
    // Stage 6 only: the human has approved the PR; merge it.
    prompt =
      `Complete stage 6 (ship) for Jira ticket ${ticket} by following plugins/ai-sdlc/skills/merge-gate/SKILL.md. ` +
      `Resolve the repo from plugins/ai-sdlc/config/repos.yaml. Steps: ` +
      `(1) Find the open PR for the feature branch and its CURRENT head SHA. ` +
      `(2) If the required 'ai-sdlc-e2e' commit status is missing or not on the current head, first re-run CI for ` +
      `the branch tip via plugins/ai-sdlc/skills/jenkins-integration/SKILL.md and post the status for that exact SHA. ` +
      `Do NOT modify code or push any commits — only build/test the existing tip. ` +
      `(3) Re-verify the full gate (green + 100% pass + fresh SHA + PR approved + mergeable). ` +
      `(4) If it holds, merge the PR to main, delete the branch, write .sdlc/${ticket}/shipped.md, transition the ticket to Done. ` +
      `If it does not hold (e.g. not approved), STOP and report exactly which check failed. ` +
      `Do NOT re-run stages 1–4. Work autonomously; do not ask questions.`;
    metaLabel = `▶ ship ${ticket} — merge approved PR (stage 6 only)`;
  } else {
    const stageList = `jira-intake, code-generation, app-verification, playwright-automation, jenkins-integration${stopBeforeShip ? '' : ', merge-gate'}`;
    prompt =
      `Run the AI-SDLC pipeline for Jira ticket ${ticket}. ${doneNote}Follow the procedure in ` +
      `plugins/ai-sdlc/skills/sdlc-orchestrator/SKILL.md and each stage skill it references (${stageList}). ` +
      `The ticket is the local file tickets/${ticket}.md; resolve the target repo from ` +
      `plugins/ai-sdlc/config/repos.yaml. ` +
      (stopBeforeShip ? `Stop BEFORE the ship stage — do not open or merge a PR. ` : `Run through ship. `) +
      `Work fully autonomously; do not ask questions. Write each stage's artifact under .sdlc/${ticket}/.`;
    metaLabel = `▶ ${done.length ? 'resume' : 'run'} ${ticket}${stopBeforeShip ? ' (dry run — stop before ship)' : ''}${done.length ? ` · skipping ${done.join(', ')}` : ''}`;
  }

  const runId = `${ticket}-${runs.size + 1}`;
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'bypassPermissions'];
  const proc = spawn(CLAUDE_BIN, args, { cwd: REPO_ROOT, env: loadEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  const run = { ticket, proc, events: [], clients: new Set(), done: false, exitCode: null, startedAt: Date.now(), lastEventAt: Date.now() };
  runs.set(runId, run);
  latestRunByTicket.set(ticket, runId);

  pushEvent(run, { kind: 'meta', text: `${metaLabel} · via headless Claude Code` });

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

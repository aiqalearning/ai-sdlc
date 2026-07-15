#!/usr/bin/env node
'use strict';

/**
 * Repo validator for ai-sdlc. Zero dependencies.
 *
 * Checks:
 *  - .mcp.json parses and every server has a command|url
 *  - .claude-plugin/marketplace.json parses; each plugin.source dir exists and has a plugin.json
 *  - each plugin's .claude-plugin/plugin.json parses and has name + description
 *  - every skills/<name>/SKILL.md has frontmatter with name + description
 *  - every commands/*.md has frontmatter with name + description
 *  - every agents/*.md has frontmatter with name + description
 *
 * Exit 0 = clean, 1 = errors found.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const checks = [];

function ok(msg) { checks.push(msg); }
function err(msg) { errors.push(msg); }

function readJSON(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { err(`missing file: ${rel}`); return null; }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    err(`invalid JSON in ${rel}: ${e.message}`);
    return null;
  }
}

/** Extract a YAML-ish frontmatter block and return the top-level keys present. */
function frontmatterKeys(rel) {
  const p = path.join(ROOT, rel);
  const text = fs.readFileSync(p, 'utf8');
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = text.slice(3, end);
  const keys = new Set();
  for (const line of block.split('\n')) {
    const m = /^([A-Za-z0-9_-]+):/.exec(line); // top-level key (no leading space)
    if (m) keys.add(m[1]);
  }
  return keys;
}

function requireFrontmatter(rel, required) {
  const keys = frontmatterKeys(rel);
  if (!keys) { err(`${rel}: missing or malformed YAML frontmatter`); return; }
  for (const k of required) {
    if (!keys.has(k)) err(`${rel}: frontmatter missing required key "${k}"`);
  }
  if (keys && required.every((k) => keys.has(k))) ok(`frontmatter ok: ${rel}`);
}

function listMd(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f));
}

// 1. .mcp.json
const mcp = readJSON('.mcp.json');
if (mcp) {
  const servers = mcp.mcpServers || {};
  const names = Object.keys(servers);
  if (names.length === 0) err('.mcp.json: no mcpServers defined');
  for (const [name, cfg] of Object.entries(servers)) {
    if (!cfg.command && !cfg.url) err(`.mcp.json: server "${name}" has neither command nor url`);
  }
  ok(`.mcp.json ok (${names.length} servers: ${names.join(', ')})`);
}

// 2. marketplace + plugins
const market = readJSON('.claude-plugin/marketplace.json');
if (market) {
  const plugins = market.plugins || [];
  if (plugins.length === 0) err('marketplace.json: no plugins listed');
  for (const pl of plugins) {
    if (!pl.source) { err(`marketplace.json: plugin "${pl.name}" missing source`); continue; }
    const manifestRel = path.join(pl.source, '.claude-plugin', 'plugin.json');
    const manifest = readJSON(manifestRel);
    if (manifest) {
      if (!manifest.name) err(`${manifestRel}: missing name`);
      if (!manifest.description) err(`${manifestRel}: missing description`);
      ok(`plugin manifest ok: ${manifestRel}`);

      const base = pl.source;
      // 3. skills
      const skillsDir = path.join(base, 'skills');
      const skillsAbs = path.join(ROOT, skillsDir);
      if (fs.existsSync(skillsAbs)) {
        for (const entry of fs.readdirSync(skillsAbs)) {
          const skillMd = path.join(skillsDir, entry, 'SKILL.md');
          if (fs.existsSync(path.join(ROOT, skillMd))) {
            requireFrontmatter(skillMd, ['name', 'description']);
          } else if (fs.statSync(path.join(ROOT, skillsDir, entry)).isDirectory()) {
            err(`${skillsDir}/${entry}: missing SKILL.md`);
          }
        }
      }
      // 4. commands
      for (const cmd of listMd(path.join(base, 'commands'))) requireFrontmatter(cmd, ['name', 'description']);
      // 5. agents
      for (const ag of listMd(path.join(base, 'agents'))) requireFrontmatter(ag, ['name', 'description']);
    }
  }
}

// Report
console.log(`\nai-sdlc validate — ${checks.length} checks passed, ${errors.length} error(s)\n`);
if (errors.length) {
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('');
  process.exit(1);
}
console.log('  ✓ all good\n');
process.exit(0);

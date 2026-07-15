'use strict';

// Minimal task-list app. In-memory store, no DB — just enough surface for the
// AI-SDLC pipeline to generate against, verify, and drive with Playwright.

const path = require('node:path');
const express = require('express');

const app = express();
const PORT = process.env.DEMO_APP_PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

/** @type {{id:number, title:string, done:boolean}[]} */
const tasks = [];
let nextId = 1;

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/tasks', (_req, res) => {
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const title = (req.body && typeof req.body.title === 'string') ? req.body.title.trim() : '';
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const task = { id: nextId++, title, done: false };
  tasks.push(task);
  res.status(201).json(task);
});

app.post('/api/tasks/:id/toggle', (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  task.done = !task.done;
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  tasks.splice(idx, 1);
  res.status(204).end();
});

// Only listen when run directly (tests import nothing, but keep it clean).
if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`demo-app listening on http://localhost:${PORT}`);
  });
}

module.exports = app;

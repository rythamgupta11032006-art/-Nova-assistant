require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || 'claude-sonnet-5';

function loadBranding() {
  const raw = fs.readFileSync(path.join(__dirname, 'config', 'branding.json'), 'utf-8');
  return JSON.parse(raw);
}

// ---------- Branding (white-label config) ----------
app.get('/api/branding', (req, res) => {
  res.json(loadBranding());
});

// ---------- Simple demo "auth": get-or-create a user by name ----------
app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  let user = email ? db.prepare('SELECT * FROM users WHERE email = ?').get(email) : null;
  if (!user) {
    const id = uuidv4();
    db.prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)').run(id, name, email || null);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }
  res.json(user);
});

// ---------- Conversations ----------
app.post('/api/conversations', (req, res) => {
  const { userId, title } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)').run(id, userId, title || 'New chat');
  res.json(db.prepare('SELECT * FROM conversations WHERE id = ?').get(id));
});

app.get('/api/conversations/:userId', (req, res) => {
  const rows = db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC').all(req.params.userId);
  res.json(rows);
});

app.get('/api/messages/:conversationId', (req, res) => {
  const rows = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(req.params.conversationId);
  res.json(rows);
});

// ---------- Chat (calls Claude API) ----------
app.post('/api/chat', async (req, res) => {
  try {
    const { conversationId, userId, message } = req.body;
    if (!conversationId || !message) {
      return res.status(400).json({ error: 'conversationId and message are required' });
    }
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Add it to your .env file.' });
    }

    const branding = loadBranding();

    // Save user message
    db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), conversationId, 'user', message);

    // Pull recent history for context (last 20 messages)
    const history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 20')
      .all(conversationId);

    // Pull user's open tasks/notes so the assistant has context
    const openTasks = userId ? db.prepare('SELECT title, due_date FROM tasks WHERE user_id = ? AND done = 0 ORDER BY due_date ASC LIMIT 10').all(userId) : [];
    const recentNotes = userId ? db.prepare('SELECT title FROM notes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5').all(userId) : [];

    let contextBlock = '';
    if (openTasks.length) {
      contextBlock += `\n\nUser's open tasks:\n${openTasks.map(t => `- ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`).join('\n')}`;
    }
    if (recentNotes.length) {
      contextBlock += `\n\nUser's recent notes:\n${recentNotes.map(n => `- ${n.title}`).join('\n')}`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: branding.systemPrompt + contextBlock,
        messages: history.map(m => ({ role: m.role, content: m.content }))
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'Failed to reach the assistant model.' });
    }

    const data = await response.json();
    const reply = data.content.map(c => c.type === 'text' ? c.text : '').join('\n').trim();

    db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), conversationId, 'assistant', reply);

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Tasks ----------
app.get('/api/tasks/:userId', (req, res) => {
  res.json(db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY done ASC, due_date ASC').all(req.params.userId));
});

app.post('/api/tasks', (req, res) => {
  const { userId, title, dueDate } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO tasks (id, user_id, title, due_date) VALUES (?, ?, ?, ?)').run(id, userId, title, dueDate || null);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

app.patch('/api/tasks/:id', (req, res) => {
  const { done } = req.body;
  db.prepare('UPDATE tasks SET done = ? WHERE id = ?').run(done ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Notes ----------
app.get('/api/notes/:userId', (req, res) => {
  res.json(db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC').all(req.params.userId));
});

app.post('/api/notes', (req, res) => {
  const { userId, title, content } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO notes (id, user_id, title, content) VALUES (?, ?, ?, ?)').run(id, userId, title, content || '');
  res.json(db.prepare('SELECT * FROM notes WHERE id = ?').get(id));
});

app.delete('/api/notes/:id', (req, res) => {
  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Assistant bot server running at http://localhost:${PORT}`);
});

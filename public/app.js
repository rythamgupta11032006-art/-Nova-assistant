const state = {
  user: null,
  conversationId: null,
  branding: null,
};

const el = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

async function init() {
  // Load branding and apply as CSS variables
  state.branding = await api('/branding');
  applyBranding(state.branding);

  // Get-or-create a local demo user (in production, replace with real auth)
  let localName = localStorage.getItem('assistant_user_name');
  if (!localName) {
    localName = 'Guest';
    localStorage.setItem('assistant_user_name', localName);
  }
  state.user = await api('/users', { method: 'POST', body: JSON.stringify({ name: localName }) });

  // Start a fresh conversation
  const convo = await api('/conversations', {
    method: 'POST',
    body: JSON.stringify({ userId: state.user.id, title: 'New chat' }),
  });
  state.conversationId = convo.id;

  showEmptyState();
  await loadTasks();
  await loadNotes();
  wireEvents();
}

function applyBranding(b) {
  document.title = b.botName;
  el('brandName').textContent = b.botName;
  el('brandTagline').textContent = b.tagline;
  const mark = el('brandMark');
  if (b.logoUrl) {
    mark.innerHTML = `<img src="${b.logoUrl}" alt="${b.botName}" />`;
  } else {
    mark.textContent = b.botName.charAt(0).toUpperCase();
  }
  const root = document.documentElement.style;
  root.setProperty('--primary', b.primaryColor);
  root.setProperty('--accent', b.accentColor);
  root.setProperty('--bg', b.backgroundColor);
}

function showEmptyState() {
  el('chatMessages').innerHTML = `
    <div class="empty-state">
      <div class="glyph">✦</div>
      <h2>${state.branding.botName}</h2>
      <p>${state.branding.welcomeMessage}</p>
    </div>`;
}

function addMessage(role, content) {
  const container = el('chatMessages');
  const empty = container.querySelector('.empty-state');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = content;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function wireEvents() {
  el('chatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = el('chatInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    el('sendBtn').disabled = true;

    addMessage('user', text);
    const typingEl = addMessage('assistant typing', 'Thinking…');

    try {
      const { reply } = await api('/chat', {
        method: 'POST',
        body: JSON.stringify({ conversationId: state.conversationId, userId: state.user.id, message: text }),
      });
      typingEl.textContent = reply;
      typingEl.className = 'msg assistant';
      // Refresh tasks/notes in case the model or user mentioned new ones
    } catch (err) {
      typingEl.textContent = `Sorry, something went wrong: ${err.message}`;
      typingEl.className = 'msg assistant';
    } finally {
      el('sendBtn').disabled = false;
    }
  });

  el('newChatBtn').addEventListener('click', async () => {
    const convo = await api('/conversations', {
      method: 'POST',
      body: JSON.stringify({ userId: state.user.id, title: 'New chat' }),
    });
    state.conversationId = convo.id;
    showEmptyState();
  });

  el('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = el('taskInput');
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    await api('/tasks', { method: 'POST', body: JSON.stringify({ userId: state.user.id, title }) });
    await loadTasks();
  });

  el('noteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = el('noteInput');
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    await api('/notes', { method: 'POST', body: JSON.stringify({ userId: state.user.id, title }) });
    await loadNotes();
  });
}

async function loadTasks() {
  const tasks = await api(`/tasks/${state.user.id}`);
  el('taskCount').textContent = tasks.filter(t => !t.done).length;
  const list = el('taskList');
  list.innerHTML = '';
  tasks.forEach(t => {
    const li = document.createElement('li');
    li.className = `task-item ${t.done ? 'done' : ''}`;
    li.innerHTML = `
      <input type="checkbox" ${t.done ? 'checked' : ''} />
      <span>${escapeHtml(t.title)}</span>
      <button class="item-delete" title="Delete">✕</button>
    `;
    li.querySelector('input').addEventListener('change', async (e) => {
      await api(`/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify({ done: e.target.checked }) });
      await loadTasks();
    });
    li.querySelector('.item-delete').addEventListener('click', async () => {
      await api(`/tasks/${t.id}`, { method: 'DELETE' });
      await loadTasks();
    });
    list.appendChild(li);
  });
}

async function loadNotes() {
  const notes = await api(`/notes/${state.user.id}`);
  el('noteCount').textContent = notes.length;
  const list = el('noteList');
  list.innerHTML = '';
  notes.forEach(n => {
    const li = document.createElement('li');
    li.className = 'note-item';
    li.innerHTML = `<span>${escapeHtml(n.title)}</span><button class="item-delete" title="Delete">✕</button>`;
    li.querySelector('.item-delete').addEventListener('click', async () => {
      await api(`/notes/${n.id}`, { method: 'DELETE' });
      await loadNotes();
    });
    list.appendChild(li);
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif">Failed to load: ${err.message}</div>`;
});

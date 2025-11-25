import { requestWithCsrf } from '../../core/authService.js';
import { showToast } from '../../core/uiService.js';

const META = {
  id: 'logs',
  iconClass: 'fa-solid fa-clipboard-list',
  labels: { cs: 'Logy', en: 'Logs' },
};

async function fetchLogs() {
  const res = await fetch('./config/log.php', { credentials: 'same-origin' });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || 'Načtení logů selhalo');
  return data.logs || [];
}

async function createLog(payload) {
  const res = await requestWithCsrf('./config/log.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || 'Zápis logu selhal');
  return true;
}

function renderLogTable(container, logs) {
  const table = document.createElement('table');
  table.className = 'log-table';
  const head = document.createElement('tr');
  head.innerHTML = '<th>ID</th><th>Typ</th><th>Modul</th><th>Uživatel</th><th>Čas</th><th>Zpráva</th>';
  table.appendChild(head);
  logs.forEach((log) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${log.id ?? ''}</td>
      <td>${log.type || ''}</td>
      <td>${log.module || ''}</td>
      <td>${log.username || ''}</td>
      <td>${log.created_at || ''}</td>
      <td>${log.message || ''}</td>
    `;
    table.appendChild(row);
  });
  container.appendChild(table);
}

function renderForm(container, refresh) {
  const form = document.createElement('form');
  form.className = 'log-form';
  form.innerHTML = `
    <label>Typ<select name="type">
      <option value="info">info</option>
      <option value="warn">warn</option>
      <option value="error">error</option>
    </select></label>
    <label>Modul<input name="module" placeholder="modul"></label>
    <label>Zpráva<input name="message" required></label>
    <button type="submit">Zapsat log</button>
  `;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    try {
      await createLog(payload);
      showToast('Log uložen.');
      form.reset();
      refresh();
    } catch (err) {
      showToast(err.message, { type: 'error' });
    }
  });
  container.appendChild(form);
}

export default {
  id: META.id,
  meta: META,
  register({ moduleRegistry }) {
    moduleRegistry.register({ id: META.id, meta: META, render: this.render });
  },
  async render(container) {
    container.innerHTML = '';
    const title = document.createElement('h1');
    title.textContent = META.labels.cs;
    container.appendChild(title);

    const formHolder = document.createElement('div');
    formHolder.className = 'card';
    container.appendChild(formHolder);

    const listHolder = document.createElement('div');
    listHolder.className = 'card';
    container.appendChild(listHolder);

    const refresh = async () => {
      listHolder.innerHTML = 'Načítám logy...';
      try {
        const logs = await fetchLogs();
        listHolder.innerHTML = '';
        if (!logs.length) {
          listHolder.textContent = 'Žádné logy.';
          return;
        }
        renderLogTable(listHolder, logs);
      } catch (err) {
        listHolder.textContent = err.message;
      }
    };

    renderForm(formHolder, refresh);
    refresh();
  },
};

import labels from './lang_cs.js';
import { showToast } from '../../core/uiService.js';
import { requestWithCsrf } from '../../core/authService.js';

const PERMISSION_LEVELS = [
  { value: 'none', label: 'Žádný' },
  { value: 'read', label: 'Čtení' },
  { value: 'manage', label: 'Správa' },
  { value: 'full', label: 'Plný přístup' },
];

function canManage(context) {
  const role = context?.currentUser?.role || 'user';
  return role === 'super-admin' || role === 'admin';
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, { credentials: 'same-origin', ...options });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Operace selhala');
  }
  return data;
}

async function apiPost(url, payload) {
  const res = await requestWithCsrf(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Operace selhala');
  }
  return data;
}

async function apiPut(url, payload) {
  const res = await requestWithCsrf(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Operace selhala');
  }
  return data;
}

async function apiDelete(url) {
  const res = await requestWithCsrf(url, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Operace selhala');
  }
  return data;
}

function renderUserRow(user, onSave, onDelete) {
  const tr = document.createElement('tr');
  const username = document.createElement('td');
  username.textContent = user.username;
  tr.appendChild(username);

  const roleCell = document.createElement('td');
  const roleSelect = document.createElement('select');
  ['user', 'admin', 'super-admin'].forEach((role) => {
    const opt = document.createElement('option');
    opt.value = role;
    opt.textContent = role;
    if (role === user.role) opt.selected = true;
    roleSelect.appendChild(opt);
  });
  roleCell.appendChild(roleSelect);
  tr.appendChild(roleCell);

  const passwordCell = document.createElement('td');
  const passInput = document.createElement('input');
  passInput.type = 'password';
  passInput.placeholder = 'Nové heslo (volitelné)';
  passwordCell.appendChild(passInput);
  tr.appendChild(passwordCell);

  const actions = document.createElement('td');
  actions.className = 'form-actions';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Uložit';
  saveBtn.addEventListener('click', () => {
    onSave({ id: user.id, role: roleSelect.value, password: passInput.value || undefined });
    passInput.value = '';
  });
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'danger';
  delBtn.textContent = 'Smazat';
  delBtn.addEventListener('click', () => onDelete(user));
  actions.appendChild(saveBtn);
  actions.appendChild(delBtn);
  tr.appendChild(actions);

  return tr;
}

function renderUserForm(onSubmit) {
  const card = document.createElement('div');
  card.className = 'card';
  const form = document.createElement('form');
  form.className = 'form-grid';
  form.innerHTML = `
      <label>${labels.username}<input name="username" required placeholder="novy.uzivatel"></label>
      <label>${labels.password}<input name="password" type="password" required placeholder="••••"></label>
      <label>${labels.role}
        <select name="role">
          <option value="user">user</option>
          <option value="admin">admin</option>
          <option value="super-admin">super-admin</option>
        </select>
      </label>
      <div class="form-actions">
        <button type="submit">${labels.addUser}</button>
      </div>
    `;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onSubmit({
      username: fd.get('username'),
      password: fd.get('password'),
      role: fd.get('role'),
    });
  });
  card.appendChild(form);
  return card;
}

async function renderUsersSection(container) {
  const layout = document.createElement('div');
  layout.className = 'form-grid';

  const formCard = renderUserForm(async (payload) => {
    try {
      await apiPost('./config/users.php', payload);
      showToast('Uživatel vytvořen.');
      await renderUsersSection(container);
    } catch (err) {
      console.error(err);
      showToast(err.message, { type: 'error' });
    }
  });
  layout.appendChild(formCard);

  const listCard = document.createElement('div');
  listCard.className = 'card';
  const table = document.createElement('table');
  table.className = 'permissions-table';
  const header = document.createElement('tr');
  header.innerHTML = '<th>Uživatel</th><th>Role</th><th>Heslo</th><th>Akce</th>';
  table.appendChild(header);
  listCard.appendChild(table);
  layout.appendChild(listCard);

  container.innerHTML = '';
  container.appendChild(layout);

  try {
    const data = await apiFetch('./config/users.php');
    const users = data.users || [];
    if (!users.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Žádní uživatelé';
      listCard.appendChild(empty);
      return;
    }
    users.forEach((u) => {
      const row = renderUserRow(
        u,
        async (payload) => {
          try {
            await apiPut('./config/users.php', payload);
            showToast('Uživatel aktualizován.');
          } catch (err) {
            showToast(err.message, { type: 'error' });
          }
        },
        async (user) => {
          if (!confirm('Opravdu chcete smazat uživatele?')) return;
          try {
            await apiDelete(`./config/users.php?id=${user.id}`);
            showToast('Uživatel smazán.');
            await renderUsersSection(container);
          } catch (err) {
            showToast(err.message, { type: 'error' });
          }
        }
      );
      table.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    showToast(err.message, { type: 'error' });
  }
}

async function renderPermissionsSection(container) {
  const card = document.createElement('div');
  card.className = 'card';
  const heading = document.createElement('h2');
  heading.textContent = 'Oprávnění';
  card.appendChild(heading);

  const hint = document.createElement('p');
  hint.className = 'muted';
  hint.textContent = 'Nastavte úrovně přístupu pro jednotlivé role a moduly.';
  card.appendChild(hint);

  const table = document.createElement('table');
  table.className = 'permissions-table';
  card.appendChild(table);

  const actionRow = document.createElement('div');
  actionRow.className = 'form-actions';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Uložit oprávnění';
  actionRow.appendChild(saveBtn);
  card.appendChild(actionRow);

  container.innerHTML = '';
  container.appendChild(card);

  try {
    const data = await apiFetch('./config/permissions.php');
    const roles = new Set(['user', 'admin', 'super-admin']);
    (data.users || []).forEach((u) => roles.add(u.role));
    const modules = data.modules || [];
    const permissions = data.permissions || {};

    const header = document.createElement('tr');
    header.innerHTML = '<th>Role</th>' + modules.map((m) => `<th>${m.name || m.id}</th>`).join('');
    table.appendChild(header);

    roles.forEach((role) => {
      const tr = document.createElement('tr');
      const label = document.createElement('td');
      label.textContent = role;
      tr.appendChild(label);
      modules.forEach((mod) => {
        const td = document.createElement('td');
        const select = document.createElement('select');
        PERMISSION_LEVELS.forEach((level) => {
          const opt = document.createElement('option');
          opt.value = level.value;
          opt.textContent = level.label;
          if ((permissions[role] && permissions[role][mod.id]) === level.value) opt.selected = true;
          select.appendChild(opt);
        });
        td.appendChild(select);
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });

    saveBtn.addEventListener('click', async () => {
      const payload = {};
      const rows = Array.from(table.querySelectorAll('tr')).slice(1);
      rows.forEach((rowEl) => {
        const role = rowEl.querySelector('td')?.textContent || '';
        payload[role] = {};
        const selects = rowEl.querySelectorAll('select');
        modules.forEach((mod, idx) => {
          payload[role][mod.id] = selects[idx].value;
        });
      });
      try {
        const res = await requestWithCsrf('./config/permissions.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: payload }),
        });
        const result = await res.json();
        if (!res.ok || result.success === false) throw new Error(result.message || 'Uložení selhalo');
        showToast('Oprávnění uložena.');
      } catch (err) {
        showToast(err.message, { type: 'error' });
      }
    });
  } catch (err) {
    table.innerHTML = '';
    const error = document.createElement('p');
    error.textContent = err.message;
    card.appendChild(error);
  }
}

export default {
  id: 'admin',
  meta: {
    iconClass: 'fa-solid fa-user-shield',
    labels: { cs: labels.title },
    navItems: [
      { id: 'users', labels: { cs: 'Uživatelé' } },
      { id: 'permissions', labels: { cs: 'Oprávnění' } },
    ],
  },
  async render(container, context = {}) {
    container.innerHTML = '';
    if (!canManage(context)) {
      const denied = document.createElement('p');
      denied.textContent = 'Nemáte oprávnění k zobrazení administrace.';
      container.appendChild(denied);
      return;
    }

    const title = document.createElement('h1');
    title.textContent = labels.title;
    container.appendChild(title);

    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    const body = document.createElement('div');
    let current = context.currentSubId || 'users';

    const buttons = [];
    [
      { id: 'users', label: 'Uživatelé' },
      { id: 'permissions', label: 'Oprávnění' },
    ].forEach((tab) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab';
      if (tab.id === current) btn.classList.add('active');
      btn.dataset.tab = tab.id;
      btn.textContent = tab.label;
      btn.addEventListener('click', () => {
        current = tab.id;
        window.location.hash = `#/admin/${tab.id}`;
        buttons.forEach((b) => b.classList.toggle('active', b.dataset.tab === current));
        rerender();
      });
      buttons.push(btn);
      tabs.appendChild(btn);
    });

    container.appendChild(tabs);
    container.appendChild(body);

    async function rerender() {
      body.innerHTML = '';
      if (current === 'permissions') {
        await renderPermissionsSection(body);
      } else {
        await renderUsersSection(body);
      }
    }

    rerender();
  },
};

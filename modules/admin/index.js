import labels from './lang_cz.js';
import { showToast } from '../../core/uiService.js';
import { requestWithCsrf } from '../../core/authService.js';

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
  const row = document.createElement('div');
  row.className = 'admin-user-row';

  const name = document.createElement('div');
  name.textContent = user.username;
  row.appendChild(name);

  const roleSelect = document.createElement('select');
  ['user', 'admin', 'super-admin'].forEach((role) => {
    const opt = document.createElement('option');
    opt.value = role;
    opt.textContent = role;
    if (role === user.role) opt.selected = true;
    roleSelect.appendChild(opt);
  });
  row.appendChild(roleSelect);

  const passInput = document.createElement('input');
  passInput.type = 'password';
  passInput.placeholder = 'Nové heslo (volitelné)';
  row.appendChild(passInput);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Uložit';
  saveBtn.addEventListener('click', () => {
    onSave({ id: user.id, role: roleSelect.value, password: passInput.value || undefined });
    passInput.value = '';
  });
  row.appendChild(saveBtn);

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'danger';
  delBtn.textContent = 'Smazat';
  delBtn.addEventListener('click', () => onDelete(user));
  row.appendChild(delBtn);

  return row;
}

export default {
  id: 'admin',
  meta: {
    iconClass: 'fa-solid fa-user-shield',
    labels: { cs: labels.title },
  },
  register({ moduleRegistry }) {
    moduleRegistry.register({ id: 'admin', meta: this.meta, render: this.render });
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

    const form = document.createElement('form');
    form.className = 'admin-add-user';
    form.innerHTML = `
      <label>${labels.username}<input name="username" required></label>
      <label>${labels.password}<input name="password" type="password" required></label>
      <label>${labels.role}
        <select name="role">
          <option value="user">user</option>
          <option value="admin">admin</option>
          <option value="super-admin">super-admin</option>
        </select>
      </label>
      <button type="submit">${labels.addUser}</button>
    `;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost('./config/users.php', {
          username: fd.get('username'),
          password: fd.get('password'),
          role: fd.get('role'),
        });
        showToast('Uživatel vytvořen.');
        form.reset();
        renderUsers();
      } catch (err) {
        console.error(err);
        showToast(err.message, { type: 'error' });
      }
    });
    container.appendChild(form);

    const list = document.createElement('div');
    list.className = 'admin-user-list';
    container.appendChild(list);

    const renderUsers = async () => {
      list.innerHTML = '';
      try {
        const data = await apiFetch('./config/users.php');
        const users = data.users || [];
        if (!users.length) {
          list.textContent = 'Žádní uživatelé';
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
                renderUsers();
              } catch (err) {
                showToast(err.message, { type: 'error' });
              }
            }
          );
          list.appendChild(row);
        });
      } catch (err) {
        console.error(err);
        showToast(err.message, { type: 'error' });
      }
    };

    renderUsers();
  },
};

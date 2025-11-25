import labels from './lang_cz.js';
import { showToast } from '../../core/uiService.js';
import { getRuntimeConfig } from '../../core/configManager.js';
import { requestWithCsrf } from '../../core/authService.js';

export default {
  id: 'admin',
  meta: {
    iconClass: 'fa-solid fa-user-shield',
    labels: { cs: labels.title },
  },
  register({ moduleRegistry }) {
    moduleRegistry.register({ id: 'admin', meta: this.meta, render: this.render });
  },
  async fetchUsers() {
    const res = await fetch('./config/users.php', { credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Chyba načítání uživatelů');
    return data.users || [];
  },
  async createUser(payload) {
    const res = await requestWithCsrf('./config/users.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Uložení se nezdařilo');
    return data.user;
  },
  render(container) {
    const runtime = getRuntimeConfig();
    const canSee = (runtime.permissions?.['*'] === 'full') || (runtime.permissions?.admin === 'full');
    container.innerHTML = '';
    if (!canSee) {
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
        await this.createUser({
          username: fd.get('username'),
          password: fd.get('password'),
          role: fd.get('role'),
        });
        showToast('Uživatel vytvořen.');
        await renderUsers();
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
        const users = await this.fetchUsers();
        const ul = document.createElement('ul');
        users.forEach((u) => {
          const li = document.createElement('li');
          li.textContent = `${u.username} (${u.role})`;
          ul.appendChild(li);
        });
        list.appendChild(ul);
      } catch (err) {
        console.error(err);
        showToast(err.message, { type: 'error' });
      }
    };

    renderUsers();
  },
};

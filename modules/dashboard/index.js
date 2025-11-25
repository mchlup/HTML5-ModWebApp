import labels from './lang_cs.js';

export default {
  id: 'dashboard',
  meta: {
    iconClass: 'fa-solid fa-gauge',
    labels: { cs: labels.title },
    order: 0,
  },
  async render(container, context = {}) {
    const user = context.currentUser || {};
    const runtime = context.runtimeConfig || {};
    const wrap = document.createElement('div');
    wrap.className = 'dashboard';

    const title = document.createElement('h1');
    title.textContent = labels.title;
    wrap.appendChild(title);

    const welcome = document.createElement('p');
    welcome.textContent = labels.welcome.replace('{username}', user.username || '');
    wrap.appendChild(welcome);

    const grid = document.createElement('div');
    grid.className = 'dashboard-widgets';

    const dbCard = document.createElement('div');
    dbCard.className = 'card';
    dbCard.innerHTML = `<h3>Databáze</h3><p>${runtime.dbAvailable ? 'Dostupná' : 'Nedostupná / fallback'}</p>`;
    grid.appendChild(dbCard);

    const moduleCard = document.createElement('div');
    moduleCard.className = 'card';
    const enabled = Array.isArray(runtime.enabledModules) ? runtime.enabledModules : [];
    moduleCard.innerHTML = `<h3>${labels.modules}</h3><p>${enabled.join(', ') || 'Žádné moduly nejsou povoleny'}</p>`;
    grid.appendChild(moduleCard);

    const usersCard = document.createElement('div');
    usersCard.className = 'card';
    usersCard.innerHTML = '<h3>Uživatelé</h3><p>Načítám...</p>';
    grid.appendChild(usersCard);

    const logCard = document.createElement('div');
    logCard.className = 'card';
    logCard.innerHTML = '<h3>Poslední log</h3><p>Načítám...</p>';
    grid.appendChild(logCard);

    wrap.appendChild(grid);

    container.innerHTML = '';
    container.appendChild(wrap);

    // doplň data z backendu
    try {
      const res = await fetch('./config/users.php', { credentials: 'same-origin' });
      const data = await res.json();
      if (res.ok && data.success !== false && Array.isArray(data.users)) {
        usersCard.querySelector('p').textContent = `${data.users.length} uživatelů`;
      } else {
        usersCard.querySelector('p').textContent = 'Nelze načíst';
      }
    } catch (err) {
      usersCard.querySelector('p').textContent = 'Nelze načíst';
    }

    try {
      const res = await fetch('./config/log.php', { credentials: 'same-origin' });
      const data = await res.json();
      if (res.ok && data.success !== false && Array.isArray(data.logs) && data.logs.length) {
        const last = data.logs[0];
        logCard.querySelector('p').textContent = `${last.type || ''}: ${last.message || ''}`;
      } else {
        logCard.querySelector('p').textContent = 'Žádné logy.';
      }
    } catch (err) {
      logCard.querySelector('p').textContent = 'Nelze načíst logy';
    }
  },
};

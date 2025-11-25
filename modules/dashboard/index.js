import labels from './lang_cz.js';

export default {
  id: 'dashboard',
  meta: {
    iconClass: 'fa-solid fa-gauge',
    labels: { cs: labels.title },
    order: 0,
  },
  register({ moduleRegistry }) {
    moduleRegistry.register({ id: 'dashboard', meta: this.meta, render: this.render });
  },
  render(container, context = {}) {
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

    const listTitle = document.createElement('h2');
    listTitle.textContent = labels.modules;
    wrap.appendChild(listTitle);

    const list = document.createElement('ul');
    const enabled = Array.isArray(runtime.enabledModules) ? runtime.enabledModules : [];
    enabled.forEach((id) => {
      const item = document.createElement('li');
      item.textContent = id;
      list.appendChild(item);
    });
    if (!enabled.length) {
      const item = document.createElement('li');
      item.textContent = 'Žádné moduly nejsou povoleny';
      list.appendChild(item);
    }
    wrap.appendChild(list);

    const placeholder = document.createElement('div');
    placeholder.className = 'dashboard-widgets';
    placeholder.textContent = labels.widgets;
    wrap.appendChild(placeholder);

    container.innerHTML = '';
    container.appendChild(wrap);
  },
};

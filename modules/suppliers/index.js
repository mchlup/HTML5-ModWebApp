import labels from './lang_cs.js';
import { registerModule } from '../../core/moduleRegistry.js';
import { resolveSupplierBinding } from '../../core/supplierBinding.js';

function createCard(title, text) {
  const card = document.createElement('div');
  card.className = 'card';
  if (title) {
    const h = document.createElement('h3');
    h.textContent = title;
    card.appendChild(h);
  }
  if (text) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = text;
    card.appendChild(p);
  }
  return card;
}

function renderBindingCard(runtimeConfig, moduleRegistry = {}) {
  const binding = resolveSupplierBinding(runtimeConfig);
  const card = createCard(labels.bindingTitle, labels.bindingHelp);

  const list = document.createElement('div');
  list.className = 'list';

  binding.aliases.forEach((moduleId) => {
    const row = document.createElement('div');
    row.className = 'list-row';

    const left = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'strong';
    title.textContent = moduleId;
    left.appendChild(title);

    const status = document.createElement('div');
    status.className = 'pill';
    const loaded = Boolean(moduleRegistry[moduleId]);

    if (moduleId === binding.primaryModuleId) {
      status.classList.add('pill-secondary');
      status.textContent = labels.primary;
    } else if (loaded) {
      status.classList.add('pill-secondary');
      status.textContent = labels.connected;
    } else {
      status.classList.add('pill-danger');
      status.textContent = labels.notLoaded;
    }

    row.appendChild(left);
    row.appendChild(status);
    list.appendChild(row);
  });

  card.appendChild(list);
  return card;
}

function renderTableCard(runtimeConfig) {
  const { tableName } = resolveSupplierBinding(runtimeConfig);
  const card = createCard(labels.tableTitle, labels.tableHelp);

  const label = document.createElement('div');
  label.className = 'strong';
  label.textContent = tableName;
  card.appendChild(label);

  return card;
}

function renderSuppliersModule(container, context = {}) {
  const runtimeConfig = context.runtimeConfig || {};
  const moduleRegistry = context.moduleRegistry || {};

  const wrap = document.createElement('div');
  wrap.className = 'dashboard';

  const title = document.createElement('h1');
  title.textContent = labels.title;
  wrap.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'muted';
  subtitle.textContent = labels.subtitle;
  wrap.appendChild(subtitle);

  const intro = document.createElement('p');
  intro.textContent = labels.intro;
  wrap.appendChild(intro);

  wrap.appendChild(renderBindingCard(runtimeConfig, moduleRegistry));
  wrap.appendChild(renderTableCard(runtimeConfig));

  container.innerHTML = '';
  container.appendChild(wrap);
}

const meta = {
  iconClass: 'fa-solid fa-truck-field',
  labels: { cs: labels.title },
  description: labels.subtitle,
};

const moduleDefinition = {
  id: 'suppliers',
  meta,
  render: renderSuppliersModule,
  register: () => registerModule('suppliers', moduleDefinition),
};

export function register() {
  moduleDefinition.register();
}

export default moduleDefinition;

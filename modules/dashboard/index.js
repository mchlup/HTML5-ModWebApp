import labels from './lang_cs.js';

// klíče, které používá modul "production" v localStorage
const PRODUCTION_STORAGE_KEYS = {
  rawMaterials: 'production_raw_materials',
  intermediates: 'production_intermediates',
  recipes: 'production_recipes',
  orders: 'production_orders',
};

function loadProductionList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getProductionCountsFromStorage() {
  const materials = loadProductionList(PRODUCTION_STORAGE_KEYS.rawMaterials);
  const intermediates = loadProductionList(PRODUCTION_STORAGE_KEYS.intermediates);
  const recipes = loadProductionList(PRODUCTION_STORAGE_KEYS.recipes);
  const orders = loadProductionList(PRODUCTION_STORAGE_KEYS.orders);

  const suppliers = Array.from(
    new Set(
      materials
        .filter((m) => m && m.supplier)
        .map((m) => String(m.supplier).trim())
    )
  );

  return {
    materials: materials.length,
    suppliers: suppliers.length,
    intermediates: intermediates.length,
    recipes: recipes.length,
    orders: orders.length,
  };
}

function buildProductionKpiCards(counts) {
  const wrap = document.createElement('div');
  wrap.className = 'dashboard-widgets';

  const kpiData = [
    { key: 'materials', label: labels.kpiMaterials },
    { key: 'suppliers', label: labels.kpiSuppliers },
    { key: 'intermediates', label: labels.kpiIntermediates },
    { key: 'recipes', label: labels.kpiRecipes },
    { key: 'orders', label: labels.kpiOrders },
  ];

  kpiData.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'card kpi-card';

    const labelEl = document.createElement('div');
    labelEl.className = 'muted';
    labelEl.textContent = item.label;
    card.appendChild(labelEl);

    const valueEl = document.createElement('div');
    valueEl.className = 'kpi-value';
    valueEl.dataset.kpiKey = item.key;
    valueEl.textContent = String(counts[item.key] ?? 0);
    card.appendChild(valueEl);

    wrap.appendChild(card);
  });

  return wrap;
}

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

    // přehled výroby nátěrových hmot (stejné karty jako dřív v modulu "production")
    const prodCounts = getProductionCountsFromStorage();
    const prodKpis = buildProductionKpiCards(prodCounts);
    wrap.appendChild(prodKpis);

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

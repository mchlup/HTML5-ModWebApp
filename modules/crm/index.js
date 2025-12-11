import labels from './lang_cs.js';
import { loadList, STORAGE_KEYS } from './shared.js';
import { renderMaterials } from './materialsPage.js';
import { renderIntermediates } from './intermediatesPage.js';
import { renderRecipes } from './recipesPage.js';
import { renderOrders } from './ordersPage.js';
import { renderSuppliers } from './suppliersPage.js';
import { matchesSupplierModule, resolveSupplierBinding } from '../../core/supplierBinding.js';

let crmStylesLoaded = false;

function ensureCrmStylesLoaded() {
  if (crmStylesLoaded) return;
  crmStylesLoaded = true;

  const href = 'modules/crm/styles.css';

  // Pokud už je CSS připojeno (např. po přepnutí mezi moduly), nic dalšího neděláme
  const existing = document.querySelector(
    `link[data-crm-styles="true"][href="${href}"]`
  );
  if (existing) {
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.crmStyles = 'true';
  document.head.appendChild(link);
}

function buildKpis(counts) {
  const wrap = document.createElement('div');
  wrap.className = 'dashboard-widgets';

  const kpiData = [
    { key: 'materials', label: labels.materials },
    { key: 'suppliers', label: labels.suppliers },
    { key: 'intermediates', label: labels.intermediates },
    { key: 'recipes', label: labels.recipes },
    { key: 'orders', label: labels.orders },
  ];

  kpiData.forEach((kpi) => {
    const card = document.createElement('div');
    card.className = 'card kpi-card';

    const label = document.createElement('div');
    label.className = 'muted';
    label.textContent = kpi.label;
    card.appendChild(label);

    const value = document.createElement('div');
    value.className = 'kpi-value';
    value.dataset.kpiKey = kpi.key;
    value.textContent = String(counts[kpi.key] ?? 0);
    card.appendChild(value);

    wrap.appendChild(card);
  });

  return wrap;
}

function getInitialCounts() {
  const materials = loadList(STORAGE_KEYS.rawMaterials);
  const intermediates = loadList(STORAGE_KEYS.intermediates);
  const recipes = loadList(STORAGE_KEYS.recipes);
  const orders = loadList(STORAGE_KEYS.orders);

  const suppliers = Array.from(
    new Set(materials.filter((m) => m.supplier).map((m) => m.supplier.trim()))
  );

  return {
    materials: materials.length,
    intermediates: intermediates.length,
    recipes: recipes.length,
    orders: orders.length,
    suppliers: suppliers.length,
  };
}

function renderCrm(container, { currentSubId, runtimeConfig } = {}) {
  // zajistí načtení CSS specifického pro modul CRM
  ensureCrmStylesLoaded();
  const wrap = document.createElement('div');
  wrap.className = 'dashboard crm-module';

  const title = document.createElement('h1');
  title.textContent = labels.title;
  wrap.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'muted';
  subtitle.textContent = labels.subtitle;
  wrap.appendChild(subtitle);

  const counts = getInitialCounts();
  const kpis = buildKpis(counts);
  wrap.appendChild(kpis);

  const nav = document.createElement('div');
  nav.className = 'tab-nav';
  const tabs = [
    { id: 'suroviny', label: labels.materials },
    { id: 'dodavatele', label: labels.suppliers, description: labels.suppliersIntro },
    { id: 'polotovary', label: labels.intermediates },
    { id: 'receptury', label: labels.recipes },
    { id: 'zakazky', label: labels.orders },
  ];
  const moduleId = 'crm';
  const tabIds = tabs.map((t) => t.id);
  let activeTab = tabIds.includes(currentSubId) ? currentSubId : 'suroviny';

  tabs.forEach((tab) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = tab.label;
    btn.dataset.tab = tab.id;
    btn.className = tab.id === activeTab ? 'tab active' : 'tab';
    if (tab.description) {
      btn.title = tab.description;
    }
    btn.addEventListener('click', () => {
      if (window.location.hash !== `#/${moduleId}/${tab.id}`) {
        window.location.hash = `#/${moduleId}/${tab.id}`;
      } else {
        activeTab = tab.id;
        nav.querySelectorAll('button').forEach((b) => {
          b.classList.toggle('active', b.dataset.tab === activeTab);
        });
        renderNavVisibility();
        renderActiveTab();
      }
    });
    nav.appendChild(btn);
  });

  const content = document.createElement('div');
  content.className = 'tab-content';
  wrap.appendChild(content);

  const renderNavVisibility = () => {
    const shouldShowNav = activeTab !== 'suroviny';
    if (shouldShowNav && !nav.parentNode) {
      wrap.insertBefore(nav, content);
    } else if (!shouldShowNav && nav.parentNode) {
      nav.parentNode.removeChild(nav);
    }
  };

  function updateKpi(key, value) {
    counts[key] = value;
    const el = wrap.querySelector(`[data-kpi-key="${key}"]`);
    if (el) el.textContent = String(value);
  }

  const renderers = {
    suroviny: () =>
      renderMaterials(content, {
        labels,
        onMaterialCountChange: (count) => {
          updateKpi('materials', count);
          const uniqueSuppliers = new Set(
            loadList(STORAGE_KEYS.rawMaterials)
              .filter((m) => m.supplier)
              .map((m) => m.supplier.trim())
          );
          updateKpi('suppliers', uniqueSuppliers.size);
        },
      }),
    dodavatele: () => {
      const binding = resolveSupplierBinding(runtimeConfig);
      const isCrmAlias = matchesSupplierModule('crm', runtimeConfig);
      if (isCrmAlias && binding.primaryModuleId !== 'crm') {
        const card = document.createElement('div');
        card.className = 'card crm-card';
        const title = document.createElement('h3');
        title.textContent = labels.suppliers;
        card.appendChild(title);

        const info = document.createElement('p');
        info.className = 'muted';
        info.textContent = labels.suppliersRedirect;
        card.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'form-actions';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = labels.openSuppliersModule;
        btn.addEventListener('click', () => {
          window.location.hash = `#/${binding.primaryModuleId}`;
        });
        actions.appendChild(btn);
        card.appendChild(actions);

        content.innerHTML = '';
        content.appendChild(card);
        return;
      }

      return renderSuppliers(content, { labels, runtimeConfig });
    },
    polotovary: () =>
      renderIntermediates(content, {
        labels,
        onCountChange: (count) => updateKpi('intermediates', count),
      }),
    receptury: () =>
      renderRecipes(content, {
        labels,
        onCountChange: (count) => updateKpi('recipes', count),
      }),
    zakazky: () =>
      renderOrders(content, {
        labels,
        onCountChange: (count) => updateKpi('orders', count),
      }),
  };

  async function renderActiveTab() {
    content.innerHTML = '<p class="muted">Načítám…</p>';
    const renderer = renderers[activeTab];
    if (typeof renderer === 'function') {
      await renderer();
    }
  }

  renderNavVisibility();
  renderActiveTab();

  container.innerHTML = '';
  container.appendChild(wrap);
}

export default {
  id: 'crm',
  meta: {
    iconClass: 'fa-solid fa-vial-circle-check',
    description: labels.subtitle,
    labels: { cs: labels.title },
    navItems: [
      { id: 'suroviny', labels: { cs: labels.materials } },
      { id: 'dodavatele', labels: { cs: labels.suppliers }, description: labels.suppliersIntro },
      { id: 'polotovary', labels: { cs: labels.intermediates } },
      { id: 'receptury', labels: { cs: labels.recipes } },
      { id: 'zakazky', labels: { cs: labels.orders } },
    ],
  },
  render: renderCrm,
};

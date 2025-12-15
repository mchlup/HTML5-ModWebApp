import labelsCs from './lang_cs.js';
import labelsEn from './lang_en.js';
import { loadList, STORAGE_KEYS } from './shared.js';
import { renderMaterials } from './materialsPage.js';
import { renderIntermediates } from './intermediatesPage.js';
import { renderRecipes } from './recipesPage.js';
import { renderOrders } from './ordersPage.js';

let productionStylesLoaded = false;

function getActiveLang() {
  try {
    const htmlLang = document.documentElement?.lang?.toLowerCase();
    if (htmlLang) return htmlLang.split('-')[0];
  } catch (_) {}
  try {
    const stored = localStorage.getItem('lang');
    if (stored) return stored.toLowerCase();
  } catch (_) {}
  return 'cs';
}

function getLabels() {
  const lang = getActiveLang();
  if (lang === 'en') return labelsEn;
  return labelsCs;
}


function ensureproductionStylesLoaded() {
  if (productionStylesLoaded) return;
  productionStylesLoaded = true;

  // Cesta k CSS relativně k umístění modulu (ESM), ne k HTML stránce.
  // Výsledkem bude např. "/html5/modules/production/styles.css".
  const href = new URL('./styles.css', import.meta.url).pathname;

  // Pokud už je CSS připojeno (např. po přepnutí mezi moduly), nic dalšího neděláme
  const existing = document.querySelector(
    `link[data-production-styles="true"][href="${href}"]`
  );
  if (existing) {
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.productionStyles = 'true';
  document.head.appendChild(link);
}

function buildKpis(kpiCounts) {
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
    value.textContent = String(kpiCounts[kpi.key] ?? 0);
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

function renderproduction(container, { currentSubId, runtimeConfig } = {}) {
  const labels = getLabels();
  // zajistí načtení CSS specifického pro modul production
  ensureproductionStylesLoaded();
  const wrap = document.createElement('div');
  wrap.className = 'dashboard production-module';

  const title = document.createElement('h1');
  title.textContent = labels.title;
  wrap.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'muted';
  subtitle.textContent = labels.subtitle;
  wrap.appendChild(subtitle);
  
  // počáteční hodnoty počítadel pro updateKpi()
  // (karty s KPI už v tomhle modulu nevykreslujeme, ale počítadla používají stránky Suroviny / Receptury)
  const counts = getInitialCounts();

  const moduleId = 'production';
  const tabIds = ['suroviny', 'polotovary', 'receptury', 'zakazky'];
  let activeTab = tabIds.includes(currentSubId) ? currentSubId : 'suroviny';

  const content = document.createElement('div');
  content.className = 'tab-content';
  wrap.appendChild(content);

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

  renderActiveTab();

  container.innerHTML = '';
  container.appendChild(wrap);
}

export default {
  id: 'production',
  meta: {
    iconClass: 'fa-solid fa-vial-circle-check',
    description: labelsCs.subtitle,
    labels: { cs: labelsCs.title, en: labelsEn.title },
    navItems: [
      { id: 'suroviny', labels: { cs: labelsCs.materials, en: labelsEn.materials } },
      { id: 'polotovary', labels: { cs: labelsCs.intermediates, en: labelsEn.intermediates } },
      { id: 'receptury', labels: { cs: labelsCs.recipes, en: labelsEn.recipes } },
      { id: 'zakazky', labels: { cs: labelsCs.orders, en: labelsEn.orders } },
    ],
  },
  render: renderproduction,
};

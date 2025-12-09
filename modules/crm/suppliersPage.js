import { createCard, loadList, renderEmptyState, truncate, STORAGE_KEYS } from './shared.js';

function buildSupplierStats(materials) {
  const suppliers = new Map();

  materials.forEach((mat) => {
    const key = (mat.supplier || 'Neznámý dodavatel').trim();
    if (!suppliers.has(key)) {
      suppliers.set(key, {
        name: key,
        items: [],
        prices: [],
        okp: new Set(),
      });
    }
    const entry = suppliers.get(key);
    entry.items.push(mat);
    if (typeof mat.price === 'number') entry.prices.push(mat.price);
    if (mat.okp) entry.okp.add(mat.okp);
  });

  return Array.from(suppliers.values()).map((s) => {
    const avgPrice = s.prices.length
      ? s.prices.reduce((acc, v) => acc + v, 0) / s.prices.length
      : null;
    return {
      ...s,
      avgPrice,
      minPrice: s.prices.length ? Math.min(...s.prices) : null,
      maxPrice: s.prices.length ? Math.max(...s.prices) : null,
      okpList: Array.from(s.okp),
    };
  });
}

export function renderSuppliers(container, { labels } = {}) {
  const materials = loadList(STORAGE_KEYS.rawMaterials).filter((m) => m.supplier);
  const suppliers = buildSupplierStats(materials);

  const wrap = document.createElement('div');
  wrap.className = 'form-grid crm-grid';

  const summaryCard = createCard(labels.suppliers, labels.suppliersIntro || 'Rychlý přehled kontaktů a cen od jednotlivých dodavatelů.');

  const toolbar = document.createElement('div');
  toolbar.className = 'table-toolbar';
  toolbar.innerHTML = `
    <div class="materials-toolbar-inner">
      <label class="materials-filter">
        <span class="muted materials-filter-label">Filtrovat dodavatele</span>
        <input type="search" name="supplierFilter" placeholder="Hledat podle názvu dodavatele nebo kódu suroviny" />
      </label>
      <span class="muted">${materials.length} surovin · ${suppliers.length} dodavatelů</span>
    </div>
  `;
  summaryCard.appendChild(toolbar);

  const listCard = document.createElement('div');
  listCard.className = 'crm-card-list';

  const list = document.createElement('div');
  list.className = 'list crm-card-list';

  function renderList(filterTerm = '') {
    list.innerHTML = '';
    const term = filterTerm.trim().toLowerCase();
    const filtered = suppliers.filter((s) => {
      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) ||
        s.items.some((mat) => (mat.code || '').toLowerCase().includes(term))
      );
    });

    if (!filtered.length) {
      renderEmptyState(list, labels.emptySuppliers);
      return;
    }

    filtered
      .sort((a, b) => a.name.localeCompare(b.name, 'cs', { sensitivity: 'base' }))
      .forEach((supplier) => {
        const block = document.createElement('div');
        block.className = 'list-row crm-row';

        const header = document.createElement('div');
        header.className = 'flex-row';
        header.style.justifyContent = 'space-between';
        header.innerHTML = `<div><div class="strong">${supplier.name}</div><div class="muted">${supplier.items.length} položek</div></div>`;

        const tags = document.createElement('div');
        tags.className = 'pill-row';
        if (supplier.avgPrice)
          tags.innerHTML += `<span class="pill">Ø ${supplier.avgPrice.toFixed(2)} Kč/kg</span>`;
        if (supplier.minPrice && supplier.maxPrice)
          tags.innerHTML += `<span class="pill pill-secondary">${supplier.minPrice.toFixed(2)}–${supplier.maxPrice.toFixed(2)} Kč/kg</span>`;
        if (supplier.okpList.length) {
          tags.innerHTML += `<span class="pill pill-secondary">OKP: ${supplier.okpList.join(', ')}</span>`;
        }
        header.appendChild(tags);
        block.appendChild(header);

        const detail = document.createElement('div');
        detail.className = 'muted';
        const materialNames = supplier.items
          .slice(0, 3)
          .map((m) => truncate(m.name || m.code || '', 42))
          .join(' • ');
        detail.textContent = materialNames || labels.emptySuppliers;
        block.appendChild(detail);

        list.appendChild(block);
      });
  }

  const filterInput = toolbar.querySelector('input[name="supplierFilter"]');
  filterInput.addEventListener('input', () => renderList(filterInput.value));

  if (!suppliers.length) {
    renderEmptyState(summaryCard, labels.emptySuppliers);
  } else {
    renderList();
  }

  summaryCard.appendChild(listCard);
  listCard.appendChild(list);

  wrap.appendChild(summaryCard);

  container.innerHTML = '';
  container.appendChild(wrap);
}

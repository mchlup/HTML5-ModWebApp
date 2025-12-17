import { showToast } from '../../core/uiService.js';
import { apiJson } from '../../core/authService.js';
import {
  loadUserColumns,
  saveUserColumns,
  deleteUserColumns,
} from '../../core/columnViewService.js';
import {
  createCard,
  createPill,
  createStandardModal,
  createStandardListCard,
  bindDetailModal,
  loadList,
  renderEmptyState,
  saveList,
  STORAGE_KEYS,
  modulePath,
  normalizeRecipeComposition,
  scaleCompositionToTargetKg,
  resolveRecipeComponentLabel,
  formatKg,
  truncate,
} from './shared.js';

// API (detail receptury kvůli přepočtu složení)
const RECIPES_API = modulePath('./api/recipes.php', import.meta.url);
const CUSTOMERS_API = modulePath('../customers/api/customers.php', import.meta.url);
const ORDERS_API = modulePath('./api/orders.php', import.meta.url);
const recipeDetailCache = new Map();


// ------------------------------
// Orders (DB)
// ------------------------------
async function ordersApiFetch(url, options = {}) {
  return apiJson(url, { method: 'GET', ...options });
}

async function ordersApiPost(url, payload) {
  return apiJson(url, { method: 'POST', body: payload });
}

async function fetchOrdersFromDb() {
  const res = await ordersApiFetch(`${ORDERS_API}?action=list`);
  const items = res?.items || res?.data || res?.orders || [];
  return Array.isArray(items) ? items : [];
}

async function createOrderInDb(payload) {
  const res = await ordersApiPost(`${ORDERS_API}?action=create`, payload);
  if (!res?.success) {
    throw new Error(res?.error || res?.message || 'Uložení zakázky do DB se nezdařilo.');
  }
  return res;
}

const PAGE_SIZE = 20;

// ------------------------------
// Customers (DB přes modul customers)
// ------------------------------
const customersState = {
  items: [],
  loaded: false,
  loading: null,
};

function normalizeCustomersPayload(payload) {
  // Podpora více tvarů odpovědi
  const list =
    payload?.items ||
    payload?.data ||
    payload?.customers ||
    payload?.list ||
    (Array.isArray(payload) ? payload : []);
  if (!Array.isArray(list)) return [];
  return list
    .map((c) => ({
      id: Number(c.id || c.customer_id || c.customerId || 0) || 0,
      name: String(c.name || c.customer_name || c.customerName || '').trim(),
      note: String(c.note || '').trim(),
    }))
    .filter((c) => c.id && c.name);
}

async function ensureCustomersLoaded({ force = false } = {}) {
  if (customersState.loaded && !force) return customersState.items;
  if (customersState.loading) return customersState.loading;

  customersState.loading = (async () => {
    try {
      // Preferujeme API customers modulu
      const url = `${CUSTOMERS_API}?action=list`;
      const payload = await apiJson(url);
      if (payload && payload.success === false) {
        throw new Error(payload.message || payload.error || 'Načtení zákazníků selhalo.');
      }
      const list = normalizeCustomersPayload(payload);
      customersState.items = list;
      customersState.loaded = true;
      return customersState.items;
    } catch (err) {
      console.error('[production/orders] customers list error:', err);
      customersState.items = [];
      customersState.loaded = false;
      // fallback – ať UI nezůstane úplně prázdné, pokud něco ještě používá localStorage
      try {
        const fallback = loadList(STORAGE_KEYS.customers);
        customersState.items = (Array.isArray(fallback) ? fallback : [])
          .map((c) => ({ id: Number(c.id) || 0, name: String(c.name || '').trim(), note: String(c.note || '').trim() }))
          .filter((c) => c.id && c.name);
      } catch (_) {}
      return customersState.items;
    } finally {
      customersState.loading = null;
    }
  })();

  return customersState.loading;
}

async function createCustomerInDb({ name, note } = {}) {
  const nm = String(name || '').trim();
  if (!nm) throw new Error('Název zákazníka je povinný.');
  const payload = await apiJson(`${CUSTOMERS_API}?action=create`, {
    method: 'POST',
    body: { name: nm, note: String(note || '').trim() },
  });
  if (payload && payload.success === false) {
    throw new Error(payload.message || payload.error || 'Uložení zákazníka selhalo.');
  }
  // očekáváme {id: ...} nebo {item:{id:...}}
  const id = Number(payload?.id || payload?.item?.id || payload?.customer?.id || 0) || 0;
  return id;
}

function getYearShortFromDate(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return String(now.getFullYear()).slice(-2);
  }
  return String(d.getFullYear()).slice(-2);
}

function parseOrderCode(code) {
  const m = String(code || '').trim().match(/^Z(\d{2})(\d{4})$/);
  if (!m) return null;
  return { yy: m[1], seq: Number(m[2]) };
}

function formatSeq4(n) {
  const x = Math.max(0, Number(n) || 0);
  return String(x).padStart(4, '0');
}

function generateNextOrderCode(orders, forYearShort = null) {
  const yy = forYearShort || getYearShortFromDate(new Date());
  let maxSeq = 0;

  (orders || []).forEach((o) => {
    const p = parseOrderCode(o?.code);
    if (!p) return;
    if (p.yy !== yy) return;
    if (Number.isFinite(p.seq) && p.seq > maxSeq) maxSeq = p.seq;
  });

  return `Z${yy}${formatSeq4(maxSeq + 1)}`;
}

function migrateMissingCodes(orders) {
  const list = Array.isArray(orders) ? [...orders] : [];
  const missing = list.filter((o) => !String(o?.code || '').trim());
  if (!missing.length) return { changed: false, orders: list };

  // seřadíme chybějící dle vytvoření (stabilní)
  missing.sort((a, b) => {
    const ad = a?.createdAt ? new Date(a.createdAt).getTime() : Number(a?.id) || 0;
    const bd = b?.createdAt ? new Date(b.createdAt).getTime() : Number(b?.id) || 0;
    return ad - bd;
  });

  const byYearMax = new Map();

  // předpočítáme max sekvence pro každé YY z existujících kódů
  list.forEach((o) => {
    const p = parseOrderCode(o?.code);
    if (!p) return;
    const current = byYearMax.get(p.yy) || 0;
    if (Number.isFinite(p.seq) && p.seq > current) byYearMax.set(p.yy, p.seq);
  });

  // doplníme chybějící kódy
  missing.forEach((o) => {
    const yy = getYearShortFromDate(o?.createdAt || o?.id || new Date());
    const maxSeq = byYearMax.get(yy) || 0;
    const next = maxSeq + 1;
    byYearMax.set(yy, next);
    o.code = `Z${yy}${formatSeq4(next)}`;
  });

  return { changed: true, orders: list };
}

function statusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'hotova') return 'Hotová';
  if (s === 'rozpracovana') return 'Rozpracovaná';
  return 'Nová';
}

function statusPill(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'hotova') return createPill('Hotová', 'success');
  if (s === 'rozpracovana') return createPill('Rozpracovaná', 'warning');
  return createPill('Nová', 'secondary');
}

async function fetchRecipeDetail(recipeId) {
  const id = Number(recipeId);
  if (!id) return null;

  if (recipeDetailCache.has(id)) return recipeDetailCache.get(id);

  const url = `${RECIPES_API}?id=${encodeURIComponent(String(id))}`;
  const res = await fetch(url, { credentials: 'include' });
  const payload = await res.json().catch(() => null);

  if (!res.ok || (payload && payload.success === false)) {
    const msg =
      (payload && (payload.message || payload.error)) ||
      `Načtení detailu receptury selhalo (${res.status}).`;
    throw new Error(msg);
  }

  const item = payload?.item || payload?.data || payload?.recipe || payload;
  recipeDetailCache.set(id, item);
  return item;
}

function buildCalcTable(order) {
  const calc = order?.recipeCalc;
  const required = Array.isArray(calc?.required) ? calc.required : [];
  if (!required.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'production-order-calc-table';

  const rows = required
    .map((r) => {
      const label = r.label || '';
      const base = formatKg(r.amount);
      const req = formatKg(r.requiredAmount);
      return `<tr>
        <td>${label}</td>
        <td class="num">${base}</td>
        <td class="num"><strong>${req}</strong></td>
      </tr>`;
    })
    .join('');

  wrap.innerHTML = `
    <div class="production-order-calc-title">Požadované suroviny (kg)</div>
    <div class="production-order-calc-meta">Základní dávka: ${formatKg(calc.baseKg)} kg · Zakázka: ${formatKg(calc.targetKg)} kg</div>
    <table>
      <thead>
        <tr>
          <th>Komponenta</th>
          <th class="num">V receptuře (kg)</th>
          <th class="num">Pro zakázku (kg)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  return wrap;
}

async function deleteOrderInDb(id) {
  const res = await ordersApiPost(`${ORDERS_API}?action=delete`, { id });
  if (!res?.success) {
    throw new Error(res?.error || res?.message || 'Smazání zakázky se nezdařilo.');
  }
  return res;
}

export function renderOrders(container, { labels, onCountChange } = {}) {
  const recipes = loadList(STORAGE_KEYS.recipes);
  const rawMaterials = loadList(STORAGE_KEYS.rawMaterials);
  const intermediates = loadList(STORAGE_KEYS.intermediates);

  let orders = loadList(STORAGE_KEYS.orders);

  // Jednorázová migrace – doplnění kódů zakázek, pokud chybí
  const mig = migrateMissingCodes(orders);
  if (mig.changed) {
    orders = mig.orders;
    saveList(STORAGE_KEYS.orders, orders);
  }

  if (!recipes.length) {
    const card = createCard(labels.orders, labels.emptyOrders || 'Nejsou evidovány žádné receptury.');
    renderEmptyState(
      card,
      labels.emptyOrders ||
        'Nejdříve vytvořte alespoň jednu recepturu, poté můžete zadávat zakázky.'
    );
    container.innerHTML = '';
    container.appendChild(card);
    return;
  }

  const listTpl = createStandardListCard({
    title: labels.ordersListTitle || labels.orders,
    subtitle:
      labels.ordersListSubtitle ||
      labels.ordersIntro ||
      'Zadejte zakázku zákazníka a přiřaďte k ní konkrétní recepturu.',
    filterLabel: labels.filterOrders || 'Filtrovat zakázky',
    filterName: 'ordersFilter',
    filterPlaceholder:
      labels.filterOrdersPlaceholder || 'Hledat podle kódu, zákazníka, receptury nebo poznámky',
    addButtonText: labels.addOrder,
  });

  const {
    grid,
    filterInput,
    addBtn,
    columnSettingsBtn,
    countLabel,
    thead,
    tbody,
    pageInfo,
    prevBtn,
    nextBtn,
  } = listTpl;

  const MODULE_CODE = 'production';
  const VIEW_CODE = 'orders';

  let userColumns = null;

  const state = {
    term: '',
    page: 1,
    sortBy: 'code',
    sortDir: 'asc',
  };

  const columns = [
    {
      id: 'code',
      label: labels.code || 'Kód',
      sortable: true,
      value: (o) => String(o?.code || ''),
      render: (o) => o?.code || '—',
      width: '10%',
    },
    {
      id: 'customer',
      label: labels.customer || 'Zákazník',
      sortable: true,
      value: (o) => String(o?.customer || ''),
      render: (o) => o?.customer || '—',
      width: '18%',
    },
    {
      id: 'recipeName',
      label: labels.recipeLabel || 'Receptura',
      sortable: true,
      value: (o) => String(o?.recipeName || ''),
      render: (o) => o?.recipeName || '—',
      width: '18%',
    },
    {
      id: 'dueDate',
      label: labels.dueDate || 'Termín výroby',
      sortable: true,
      value: (o) => String(o?.dueDate || ''),
      render: (o) => o?.dueDate || '—',
      width: '12%',
    },
    {
      id: 'quantity',
      label: (labels.quantity || 'Množství') + ' (kg)',
      sortable: true,
      value: (o) => (o?.quantity != null ? Number(o.quantity) : -1),
      render: (o) => (o?.quantity != null ? `${o.quantity} kg` : '—'),
      width: '10%',
    },
    {
      id: 'note',
      label: labels.note || 'Poznámka',
      sortable: false,
      value: (o) => String(o?.note || ''),
      render: (o) => truncate(String(o?.note || ''), 80) || '—',
      width: '22%',
    },
    {
      id: 'status',
      label: labels.status || 'Stav',
      sortable: true,
      value: (o) => String(o?.status || ''),
      render: (o) => statusPill(o?.status),
      width: '8%',
    },
    {
      id: 'actions',
      label: '',
      sortable: false,
      value: () => '',
      render: (o) => {
        const wrap = document.createElement('div');
        wrap.className = 'materials-actions';

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'danger production-btn production-btn-danger production-btn-sm';
        del.textContent = labels.delete || 'Smazat';
        del.addEventListener('click', async () => {
          if (!confirm('Opravdu odstranit tuto zakázku?')) return;
          try {
            if (o?.id) await deleteOrderInDb(o.id);
          } catch (err) {
            console.warn('[production/orders] DB delete failed, removing locally.', err);
          }
          orders = orders.filter((x) => x.id !== o.id);
          saveList(STORAGE_KEYS.orders, orders);
          if (typeof onCountChange === 'function') onCountChange(orders.length);
          showToast('Zakázka odstraněna.');
          applyFilter();
        });

        wrap.appendChild(del);
        return wrap;
      },
      width: '1%',
    },
  ];
  
    function getDefaultColumns() {
  // `id` musí odpovídat `id` v definicích sloupců výše.
  // (ponecháváme i `key` kvůli kompatibilitě se staršími uloženými konfiguracemi)
  return columns.map((c, index) => ({
    id: c.id,
    key: c.id,
    label: c.label,
    order: index,
    width: c.width || '',
    required: c.id === 'code' || c.id === 'actions',
    // výchozí viditelnost – poznámku necháme vypnutou, ostatní zapnuté
    defaultVisible: c.id !== 'note',
  }));
}

  function normalizeColumns(cols = []) {
  return (cols || [])
    .map((c, i) => {
      const id = String(c?.id || c?.key || c?.columnId || '').trim();
      if (!id) return null;
      return {
        ...c,
        id,
        key: id,
        order: typeof c.order === 'number' ? c.order : i,
        visible: c.required ? true : (c.visible !== false && c.defaultVisible !== false),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}


function pickColumnConfig(cols = []) {
  return (normalizeColumns(cols) || []).map((c) => ({
    id: c.id,
    visible: c.visible !== false,
    order: typeof c.order === 'number' ? c.order : 0,
    width: c.width || '',
  }));
}

function mergeColumnConfig(baseCols = [], loadedCols = []) {
  const base = normalizeColumns(baseCols);
  const loaded = normalizeColumns(Array.isArray(loadedCols) ? loadedCols : []);
  const map = new Map(loaded.map((c) => [String(c.id), c]));

  const merged = base.map((b) => {
    const s = map.get(String(b.id));
    if (!s) return b;
    return {
      ...b,
      visible: s.visible,
      order: typeof s.order === 'number' ? s.order : b.order,
      width: s.width || b.width || '',
    };
  });

  return normalizeColumns(merged);
}

  function getVisibleColumnDefs() {
  const cfg = normalizeColumns(userColumns || getDefaultColumns());
  const ids = cfg.filter((c) => c.visible !== false).map((c) => c.id);
  return ids
    .map((id) => columns.find((d) => d.id === id))
    .filter(Boolean);
}

  async function loadColumns() {
  try {
    const loaded = await loadUserColumns(MODULE_CODE, VIEW_CODE, getDefaultColumns());
    userColumns = mergeColumnConfig(getDefaultColumns(), loaded);
  } catch (err) {
    console.warn('[production/orders] loadUserColumns failed', err);
    userColumns = getDefaultColumns();
  }
}

  function openColumnsModal() {
    const cfg = normalizeColumns(userColumns || getDefaultColumns());

    const wrap = document.createElement('div');
    wrap.className = 'column-config';

    const list = document.createElement('div');
    list.className = 'column-config-list';

    cfg.forEach((col) => {
      const item = document.createElement('div');
      item.className = 'column-config-item';

      const label = document.createElement('label');
      label.className = 'column-config-label';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = col.visible !== false;
      cb.disabled = !!col.required;
      cb.addEventListener('change', () => {
        col.visible = cb.checked;
      });

      const name = document.createElement('span');
      name.textContent = col.label || col.key;

      label.appendChild(cb);
      label.appendChild(name);

      if (col.required) {
        const badge = document.createElement('span');
        badge.className = 'pill pill-secondary';
        badge.textContent = 'Povinný';
        label.appendChild(badge);
      }

      const widthInput = document.createElement('input');
      widthInput.type = 'text';
      widthInput.className = 'column-config-width';
      widthInput.placeholder = 'Šířka (px/%)';
      widthInput.value = col.width || '';
      widthInput.addEventListener('input', (e) => {
        col.width = String(e.target.value || '').trim();
      });

      item.appendChild(label);
      item.appendChild(widthInput);
      list.appendChild(item);
    });

    const actions = document.createElement('div');
    actions.className = 'column-config-actions';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'production-btn production-btn-secondary';
    resetBtn.textContent = 'Obnovit výchozí';
    resetBtn.addEventListener('click', async () => {
      try {
        await deleteUserColumns(MODULE_CODE, VIEW_CODE);
        userColumns = getDefaultColumns();
        renderHead();
        applyFilter();
        modal.close();
        showToast('Výchozí sloupce byly obnoveny.');
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Obnovení sloupců selhalo.', { type: 'error' });
      }
    });

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'production-btn production-btn-primary';
    saveBtn.textContent = 'Uložit';
    saveBtn.addEventListener('click', async () => {
      try {
        userColumns = normalizeColumns(cfg);
        await saveUserColumns(MODULE_CODE, VIEW_CODE, pickColumnConfig(userColumns));
        renderHead();
        applyFilter();
        modal.close();
        showToast('Sloupce byly uloženy.');
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Uložení sloupců selhalo.', { type: 'error' });
      }
    });

    actions.appendChild(resetBtn);
    actions.appendChild(saveBtn);

    wrap.appendChild(list);
    wrap.appendChild(actions);

    const modal = createStandardModal({
      eyebrow: 'Nastavení',
      title: 'Zobrazené sloupce',
      subtitle: 'Vyberte, které sloupce chcete vidět v tabulce zakázek.',
      overlayClass: 'production-modal-overlay',
      modalClass: 'production-modal column-config-modal',
      bodyContent: wrap,
    });

    modal.open();
  }

  function renderHead() {
    thead.innerHTML = '';
    const tr = document.createElement('tr');

    const visibleCols = getVisibleColumnDefs();
    visibleCols.forEach((c) => {
      const th = document.createElement('th');
      th.textContent = c.label || '';
      const cfg = (userColumns || []).find((x) => x.key === c.id);
      const w = (cfg && cfg.width) ? cfg.width : c.width;
      if (w) th.style.width = w;

      if (c.sortable) {
        th.classList.add('sortable');
        if (state.sortBy === c.id) {
          th.classList.add(state.sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }
        th.addEventListener('click', () => {
          if (state.sortBy === c.id) {
            state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            state.sortBy = c.id;
            state.sortDir = 'asc';
          }
          renderHead();
          applyFilter();
        });
      }

      tr.appendChild(th);
    });

    thead.appendChild(tr);
  }

  function matches(o) {
    const t = state.term;
    if (!t) return true;
    const hay = `${o.code || ''} ${o.customer || ''} ${o.recipeName || ''} ${o.note || ''} ${o.status || ''}`.toLowerCase();
    return hay.includes(t);
  }

  function applyFilter() {
    const filtered = (orders || []).filter(matches);
    const total = filtered.length;
    countLabel.textContent = `${total} položek`;

    // řazení
    const col = columns.find((c) => c.id === state.sortBy);
    if (col && col.sortable) {
      const dir = state.sortDir === 'desc' ? -1 : 1;
      filtered.sort((a, b) => {
        const va = col.value(a);
        const vb = col.value(b);
        if (va === vb) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return va > vb ? dir : -dir;
      });
    }

    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pageCount) state.page = pageCount;

    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    // render
    tbody.innerHTML = '';
    if (!pageItems.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = columns.length;
      td.textContent = labels.emptyOrders || 'Žádné zakázky.';
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      pageItems.forEach((o) => {
        const tr = document.createElement('tr');

        const visibleCols = getVisibleColumnDefs();
    visibleCols.forEach((c) => {
          const td = document.createElement('td');
          const content = c.render ? c.render(o) : '';
          if (content instanceof Node) td.appendChild(content);
          else td.textContent = content != null && content !== '' ? String(content) : '—';
          tr.appendChild(td);
        });

        // Detail zakázky
        bindDetailModal(tr, {
          item: o,
          eyebrow: 'DETAIL ZAKÁZKY',
          title: `${o.code ? `${o.code} · ` : ''}${o.customer || 'Zakázka'} — ${o.recipeName || ''}`.trim(),
          subtitle: o.dueDate ? `Termín: ${o.dueDate}` : '',
          overlayClass: 'production-detail-modal-overlay',
          modalClass: 'production-detail-modal',
          fields: [
            { label: 'Kód', value: (x) => x?.code },
            { label: 'Zákazník', value: (x) => x?.customer },
            { label: 'Receptura', value: (x) => x?.recipeName },
            { label: 'Termín výroby', value: (x) => x?.dueDate },
            { label: 'Množství (kg)', value: (x) => x?.quantity },
            { label: 'Kontakt', value: (x) => x?.contact },
            { label: 'Stav', value: (x) => statusLabel(x?.status) },
            { label: 'Poznámka', value: (x) => x?.note },
            {
              label: 'Požadované suroviny',
              value: (x) => buildCalcTable(x) || '—',
            },
          ],
        });

        tbody.appendChild(tr);
      });
    }

    pageInfo.textContent = pageCount > 1 ? `Stránka ${state.page} / ${pageCount}` : '';
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= pageCount;
  }

  function buildFormCard() {
    const formCard = createCard(
      labels.addOrder,
      labels.ordersIntro || 'Zadejte zakázku zákazníka a přiřaďte k ní konkrétní recepturu.'
    );

    const suggestedCode = generateNextOrderCode(orders);

    const form = document.createElement('form');
    form.className = 'production-form';
    form.innerHTML = `
      <div class="form-grid two-col">
        <label>${labels.code || 'Kód'}
          <input name="code" value="${suggestedCode}" disabled />
        </label>
        <label>${labels.customer || 'Zákazník'}
          <div class="materials-supplier-inline">
            <select name="customerId" required>
              <option value="">—</option>
            </select>
            <button type="button" class="production-btn production-btn-secondary production-btn-sm" data-role="add-customer">+ Nový zákazník</button>
          </div>
        </label>

        <label>${labels.recipeLabel || 'Receptura'}
          <select name="recipeId" required>
            <option value="">—</option>
            ${recipes
              .map((r) => `<option value="${String(r.id)}">${String(r.name || 'Receptura')}</option>`)
              .join('')}
          </select>
        </label>

        <label>${(labels.quantity || 'Množství') + ' (kg)'}
          <input name="quantity" type="number" min="1" step="1" placeholder="250" />
        </label>

        <label>${labels.dueDate || 'Termín výroby'}
          <input name="dueDate" type="date" />
        </label>

        <div class="production-unit-hint production-field-full">
          Množství zakázky i množství složek receptury zadávejte v kilogramech (kg).
        </div>

        <label>${labels.contact || 'Kontakt'}
          <input name="contact" placeholder="Jméno, telefon, e-mail…" />
        </label>

        <label>${labels.status || 'Stav'}
          <select name="status">
            <option value="nova">Nová</option>
            <option value="rozpracovana">Rozpracovaná</option>
            <option value="hotova">Hotová</option>
          </select>
        </label>

        <label class="production-field-full">Poznámka
          <textarea name="note" rows="2" placeholder="Dodat na stavbu v týdnu 32, balení 25 kg."></textarea>
        </label>

        <div class="production-order-calc">
          <div class="production-order-calc-title">${labels.materialsCalcTitle || 'Přepočet surovin'}</div>
          <div class="production-order-calc-meta"></div>
          <div class="production-order-calc-table"></div>
        </div>
      </div>
    `;

    const customerSelect = form.querySelector('select[name="customerId"]');
    const addCustomerBtn = form.querySelector('[data-role="add-customer"]');
    const recipeSelect = form.querySelector('select[name="recipeId"]');
    const qtyInput = form.querySelector('input[name="quantity"]');
    const calcMeta = form.querySelector('.production-order-calc-meta');
    const calcTable = form.querySelector('.production-order-calc-table');

    let modal = null;
    let customerModal = null;
    let currentRecipeDetail = null;

    function refreshCustomerOptions(selectedId = null) {
      if (!customerSelect) return;
      const current = (selectedId ?? Number(customerSelect.value || 0)) || 0;
      const customers = Array.isArray(customersState.items) ? customersState.items : [];
      customerSelect.innerHTML = `
        <option value="">—</option>
        ${customers
          .map((c) => `<option value="${String(c.id)}">${String(c.name || '')}</option>`)
          .join('')}
      `;
      if (current) customerSelect.value = String(current);
    }

    function buildCustomerModal() {
      if (customerModal) return customerModal;

      const wrap = document.createElement('div');
      const f = document.createElement('form');
      f.className = 'production-form';
      f.innerHTML = `
        <div class="form-grid two-col">
          <label>${labels.customer || 'Zákazník'}
            <input name="customerName" required placeholder="${labels.customerPlaceholder || 'Např. Stavby a.s.'}" />
          </label>
          <label>${labels.note || 'Poznámka'}
            <input name="note" placeholder="${labels.customerNotePlaceholder || ''}" />
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="production-btn production-btn-primary">${labels.save || 'Uložit'}</button>
          <button type="button" class="production-btn production-btn-secondary" data-role="close">${labels.close || 'Zavřít'}</button>
        </div>
      `;
      wrap.appendChild(f);

      customerModal = createStandardModal({
        eyebrow: labels.newCustomerEyebrow || 'NOVÝ ZÁKAZNÍK',
        title: labels.newCustomerTitle || (labels.customer || 'Zákazník'),
        subtitle: labels.newCustomerSubtitle || 'Zadejte údaje zákazníka a uložte jej.',
        overlayClass: 'production-customer-modal-overlay',
        modalClass: 'production-customer-modal',
        bodyContent: wrap,
        onClose: () => {
          customerModal = null;
        },
      });

      const closeBtn = f.querySelector('[data-role="close"]');
      closeBtn?.addEventListener('click', () => customerModal?.close());

      f.addEventListener('submit', (e) => {
        e.preventDefault();
        (async () => {
          try {
            const fd2 = new FormData(f);
            const name = String(fd2.get('customerName') || '').trim();
            const note2 = String(fd2.get('note') || '').trim();
            if (!name) return;

            const newId = await createCustomerInDb({ name, note: note2 });
            await ensureCustomersLoaded({ force: true });
            refreshCustomerOptions(newId || null);

            showToast(labels.customerSaved || 'Zákazník uložen.');
            customerModal?.close();
          } catch (err) {
            console.error(err);
            showToast(err?.message || 'Uložení zákazníka selhalo.', { type: 'error' });
          }
        })();
      });

      return customerModal;
    }

    function openCustomerModal() {
      const m = buildCustomerModal();
      m.open();
      setTimeout(() => {
        const el = m.body.querySelector('input, textarea, select, button');
        el?.focus?.();
      }, 50);
    }

    addCustomerBtn?.addEventListener('click', openCustomerModal);

    // Načti zákazníky z DB po otevření formuláře (ať dropdown nezůstane prázdný)
    ensureCustomersLoaded()
      .then(() => refreshCustomerOptions())
      .catch(() => refreshCustomerOptions());

    function renderCalc() {
      if (!calcMeta || !calcTable) return;

      const qty = Number(qtyInput?.value || 0);
      const composition = normalizeRecipeComposition(currentRecipeDetail);
      const { baseKg, targetKg, factor, scaled } = scaleCompositionToTargetKg(composition, qty);

      if (!currentRecipeDetail || !Number(currentRecipeDetail?.id) || !composition.length) {
        calcMeta.textContent = recipeSelect?.value
          ? 'Receptura neobsahuje žádné komponenty.'
          : 'Vyberte recepturu a zadejte množství.';
        calcTable.innerHTML = '';
        return;
      }

      if (!targetKg || targetKg <= 0) {
        calcMeta.textContent = `Základní dávka receptury: ${formatKg(baseKg)} kg. Zadejte množství zakázky pro přepočet.`;
        calcTable.innerHTML = '';
        return;
      }

      calcMeta.textContent = `Základní dávka receptury: ${formatKg(baseKg)} kg → Zakázka: ${formatKg(targetKg)} kg (koeficient ${formatKg(factor, { decimals: 4 })}).`;

      const rows = scaled
        .map((c) => {
          const label = resolveRecipeComponentLabel(c, { rawMaterials, intermediates });
          const base = formatKg(c.amount);
          const req = formatKg(c.requiredAmount);
          return `<tr>
            <td>${label}</td>
            <td class="num">${base}</td>
            <td class="num"><strong>${req}</strong></td>
          </tr>`;
        })
        .join('');

      calcTable.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Komponenta</th>
              <th class="num">V receptuře (kg)</th>
              <th class="num">Pro zakázku (kg)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    async function handleRecipeOrQtyChange() {
      try {
        const rid = Number(recipeSelect?.value || 0);
        if (!rid) {
          currentRecipeDetail = null;
          renderCalc();
          return;
        }
        currentRecipeDetail = await fetchRecipeDetail(rid);
        renderCalc();
      } catch (err) {
        console.error(err);
        showToast(err?.message || 'Nepodařilo se načíst detail receptury.', { type: 'error' });
        currentRecipeDetail = null;
        renderCalc();
      }
    }

    recipeSelect?.addEventListener('change', handleRecipeOrQtyChange);
    qtyInput?.addEventListener('input', renderCalc);
    handleRecipeOrQtyChange();

    const actions = document.createElement('div');
    actions.className = 'form-actions';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'production-btn production-btn-primary';
    submit.textContent = labels.saveOrder || 'Uložit zakázku';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'production-btn production-btn-secondary';
    closeBtn.textContent = labels.close || 'Zavřít';
    closeBtn.addEventListener('click', () => modal?.close());

    actions.appendChild(submit);
    actions.appendChild(closeBtn);
    form.appendChild(actions);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);

      const customerId = Number(fd.get('customerId') || 0);
      const recipeId = Number(fd.get('recipeId') || 0);
      if (!customerId || !recipeId) return;

      const customerObj = (customersState.items || []).find((c) => Number(c.id) === customerId);
      const customer = String(customerObj?.name || '').trim();
      if (!customer) return;

      const quantity = Number(fd.get('quantity') || 0) || null;
      const dueDate = String(fd.get('dueDate') || '').trim();
      const note = String(fd.get('note') || '').trim();
      const contact = String(fd.get('contact') || '').trim();
      const status = String(fd.get('status') || 'nova').trim() || 'nova';

      const recipe = recipes.find((r) => Number(r.id) === recipeId);

      const recipeDetail =
        currentRecipeDetail && Number(currentRecipeDetail?.id) === recipeId ? currentRecipeDetail : null;
      const composition = normalizeRecipeComposition(recipeDetail);
      const calc = recipeDetail && composition.length && quantity
        ? scaleCompositionToTargetKg(composition, quantity)
        : null;

      const localCode = generateNextOrderCode(orders);

      let dbId = 0;
      let finalCode = localCode;

      try {
        const saved = await createOrderInDb({
          code: localCode,
          customer_id: customerId,
          customerId,
          customer_name: customer,
          customer: customer,
          recipe_id: recipeId,
          recipeId,
          quantity,
          due_date: dueDate || null,
          dueDate: dueDate || null,
          contact,
          status,
          note,
        });

        dbId = Number(saved?.id || 0) || 0;
        if (saved?.code) finalCode = String(saved.code).trim();
      } catch (err) {
        console.warn('[production/orders] DB create failed, using localStorage.', err);
      }

      const next = [
        ...orders,
        {
          id: dbId || Date.now(),
          code: finalCode,
          customerId,
          customer,
          recipeId,
          recipeName: recipe?.name || '',
          quantity,
          dueDate,
          contact,
          status,
          note,
          createdAt: new Date().toISOString(),
          recipeCalc: calc
            ? {
                baseKg: calc.baseKg,
                factor: calc.factor,
                targetKg: calc.targetKg,
                required: calc.scaled.map((c) => ({
                  componentType: c.componentType,
                  componentId: c.componentId,
                  amount: c.amount,
                  requiredAmount: c.requiredAmount,
                  label: resolveRecipeComponentLabel(c, { rawMaterials, intermediates }),
                })),
              }
            : null,
        },
      ];

      orders = next;
      saveList(STORAGE_KEYS.orders, next);
      if (typeof onCountChange === 'function') onCountChange(next.length);
      showToast('Zakázka uložena.');
      modal?.close();
      applyFilter();
    });

    formCard.appendChild(form);

    return {
      card: formCard,
      bindModal: (m) => {
        modal = m;
      },
    };
  }

  let modal = null;
  function openModal() {
    if (modal) {
      modal.open();
      return;
    }

    const built = buildFormCard();
    modal = createStandardModal({
      eyebrow: labels.newOrderEyebrow || 'Nová zakázka',
      title: labels.addOrder,
      subtitle:
        labels.ordersIntro || 'Zadejte zakázku zákazníka a přiřaďte k ní konkrétní recepturu.',
      overlayClass: 'production-orders-modal-overlay',
      modalClass: 'production-orders-modal',
      bodyContent: built.card,
      onClose: () => {
        modal = null;
      },
    });

    built.bindModal(modal);
    modal.open();
  }

  addBtn.addEventListener('click', openModal);
  if (columnSettingsBtn) columnSettingsBtn.addEventListener('click', openColumnsModal);

  filterInput.addEventListener('input', () => {
    state.term = String(filterInput.value || '').trim().toLowerCase();
    state.page = 1;
    applyFilter();
  });

  prevBtn.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      applyFilter();
    }
  });

  nextBtn.addEventListener('click', () => {
    const total = (orders || []).filter(matches).length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page < pageCount) {
      state.page += 1;
      applyFilter();
    }
  });

  container.innerHTML = '';
  container.appendChild(grid);

  // Inicializace: sloupce + první render + následné načtení zakázek z DB
  (async () => {
    await loadColumns();
    renderHead();
    applyFilter();
    try {
      const dbItems = await fetchOrdersFromDb();
      if (dbItems && dbItems.length) {
        orders = dbItems.map((o) => ({
          ...o,
          // sjednocení názvů polí pro UI
          recipeId: Number(o.recipeId || o.recipe_id || 0),
          customerId: Number(o.customerId || o.customer_id || 0),
          customer: String(o.customer || o.customer_name || o.customerName || '').trim(),
          dueDate: o.dueDate || o.due_date || o.production_date || null,
          note: o.note ?? '',
          contact: o.contact ?? '',
          status: o.status ?? 'nova',
          quantity: (o.quantity ?? o.quantityKg ?? o.quantity_kg ?? o.qty) != null && (o.quantity ?? o.quantityKg ?? o.quantity_kg ?? o.qty) !== ''
            ? Number(o.quantity ?? o.quantityKg ?? o.quantity_kg ?? o.qty)
            : null,
          code: o.code || o.Code || o.CODE || '',
          createdAt: o.createdAt || o.created_at || null,
        }));
        saveList(STORAGE_KEYS.orders, orders);
        applyFilter();
        if (typeof onCountChange === 'function') onCountChange(orders.length || 0);
      }
    } catch (err) {
      console.warn('[production/orders] DB list failed, using localStorage.', err);
    }
  })();

  if (typeof onCountChange === 'function') onCountChange(orders.length || 0);
}

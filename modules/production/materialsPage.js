import { showToast } from '../../core/uiService.js';
import { apiJson } from '../../core/authService.js';
import {
  deleteUserColumns,
  loadUserColumns,
  saveUserColumns,
} from '../../core/columnViewService.js';
import {
  createCard,
  createStandardListCard,
  createStandardModal,
  modulePath,
  STORAGE_KEYS,
  saveList,
  truncate,
} from './shared.js';

// Cesty generujeme z import.meta.url, aby nebyl potřeba hardcode názvu modulu
const MATERIALS_API = modulePath('./api/materials.php', import.meta.url);
const SUPPLIERS_API = modulePath('../suppliers/api/suppliers.php', import.meta.url);
const MODULE_CODE = 'production';
const VIEW_CODE = 'materials';

async function apiFetch(url, options = {}) {
  return apiJson(url, { method: 'GET', ...options });
}

async function apiPost(url, payload) {
  return apiJson(url, {
    method: 'POST',
    body: payload,
  });
}

async function apiDelete(url) {
  return apiJson(url, { method: 'DELETE' });
}

function generateMaterialCode(materials) {
  const now = new Date();
  const yearShort = String(now.getFullYear()).slice(-2);
  const prefix = yearShort;

  let maxSeq = 0;
  materials.forEach((m) => {
    if (!m.code) return;
    const code = String(m.code);
    if (!code.startsWith(prefix)) return;

    const tailRaw = code.slice(prefix.length);
    if (!tailRaw) return;
    const tail = tailRaw.replace(/^0+/, '') || '0';
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n) && n > maxSeq) {
      maxSeq = n;
    }
  });

  const next = maxSeq + 1;
  const seqStr = String(next).padStart(4, '0');
  return prefix + seqStr;
}

export async function renderMaterials(container, { labels, onMaterialCountChange } = {}) {
  const PAGE_SIZE = 20;

  // --- Sjednocená šablona listovací části (toolbar + tabulka + stránkování) ---
  const listTpl = createStandardListCard({
    title: 'Evidence surovin',
    subtitle:
      'Přehled surovin, které lze dále použít v polotovarech, recepturách a zakázkách.',
    filterLabel: 'Filtrovat suroviny',
    filterName: 'materialsFilter',
    filterPlaceholder: 'Hledat podle kódu, názvu nebo dodavatele',
    addButtonText: 'Přidat surovinu',
  });

  const {
    grid,
    listCard,
    toolbar,
    filterInput,
    addBtn: addBtnTop,
    columnSettingsBtn,
    countLabel,
    table,
    thead: head,
    tbody,
    pagination,
    pageInfo,
    prevBtn,
    nextBtn,
  } = listTpl;

  // zachováme původní layout (form vlevo, tabulka vpravo)
  grid.className = 'form-grid materials-layout';

  const formCard = createCard(
    labels.addMaterial,
    'Zadejte parametry suroviny a uložte ji – bez uložených surovin nelze pokračovat v polotovarech a recepturách.'
  );
  formCard.innerHTML = '';

  const form = document.createElement('form');
  form.className = 'form-grid materials-form';
  form.style.display = 'grid';
  form.style.gridTemplateColumns = '1fr';
  form.style.rowGap = '0.75rem';
  form.style.columnGap = '0.75rem';

  const rowStyle =
    'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;align-items:flex-end;';

  form.innerHTML = `
    <div class="form-grid" style="${rowStyle}">
      <label>
        Název suroviny
        <input name="name" required placeholder="Disperze akrylátu" />
      </label>
      <label>
        Kód / Dodací číslo
        <input name="code" placeholder="(bude doplněn automaticky, případně zadejte vlastní)" />
      </label>
    </div>

    <div class="form-grid" style="${rowStyle}">
      <label>
        Dodavatel
        <div class="materials-supplier-inline">
          <select name="supplier">
            <option value="">(vyberte dodavatele)</option>
          </select>
          <button type="button" class="production-btn production-btn-secondary production-btn-sm" data-role="add-supplier">+ Nový dodavatel</button>
        </div>
      </label>
      <label>
        Cena / kg
        <input name="price" type="number" min="0" step="0.01" placeholder="120" />
      </label>
      <div>
        <button type="button" data-role="add-supplier" class="secondary">
          + Nový dodavatel
        </button>
      </div>
    </div>

    <div class="form-grid" style="${rowStyle}">
      <label>
        Hustota (g/cm³)
        <input name="density" type="number" min="0" step="0.01" placeholder="1.05" />
      </label>
      <label>
        Sušina (%)
        <input name="solids" type="number" min="0" max="100" step="0.1" placeholder="55" />
      </label>
    </div>

    <div class="form-grid" style="${rowStyle}">
      <label>
        OKP / kategorie
        <input name="okp" placeholder="např. A(i), B(e), VOC kat." />
      </label>
      <label>
        Olej / olejová fáze
        <input name="oil" placeholder="lněný, sójový, alkydový..." />
      </label>
    </div>

    <div class="form-grid" style="${rowStyle}">
      <label>
        VOC (g/l)
        <input name="voc" type="number" min="0" step="0.1" placeholder="15" />
      </label>
      <label>
        Nebezpečnost / SDS
        <input name="safety" placeholder="H315, H319" />
      </label>
    </div>

    <label>
      Poznámka
      <textarea name="note" rows="2" placeholder="Stabilní do 25 °C, sklad ve stínu."></textarea>
    </label>

    <div class="form-actions">
      <button type="submit" data-role="save">Uložit surovinu</button>
      <button type="button" data-role="cancel-edit" class="secondary" style="display:none">Zrušit úpravy</button>
    </div>
  `;
  formCard.appendChild(form);
  formCard.classList.add('materials-modal-card');

  const nameDatalist = document.createElement('datalist');
  nameDatalist.id = 'production-material-name-list';
  formCard.appendChild(nameDatalist);

  // tabulková hlavička v šabloně
  head.innerHTML = `
    <tr>
      <th data-sort="code" class="sortable">Kód</th>
      <th data-sort="name" class="sortable">Název</th>
      <th data-sort="supplier" class="sortable">Dodavatel</th>
      <th>Cena</th>
      <th>Poznámka</th>
      <th>Parametry</th>
      <th style="width:1%;white-space:nowrap;"></th>
    </tr>
  `;

  // Formulář je pouze v modálu (openMaterialModal), na stránce se nezobrazuje inline

  container.innerHTML = '';
  container.appendChild(grid);

  let materials = [];
  let filtered = [];
  let totalCount = 0;
  let pageSize = PAGE_SIZE;
  let currentSearchTerm = '';
  let editingId = null;
  let currentPage = 1;
  let sortBy = 'code';
  let sortDir = 'asc';
  const defaultColumns = getDefaultColumns();
  let columns = normalizeColumns(defaultColumns);
  let supplierOptionsCache = null;
  let supplierLoadErrorShown = false;
  let columnModal = null;
  let materialModal = null;
  let supplierModal = null;

  const submitBtn = form.querySelector('button[data-role="save"]');
  const cancelEditBtn = form.querySelector('button[data-role="cancel-edit"]');
  
  // filterInput / columnSettingsBtn / countLabel / pageInfo / prevBtn / nextBtn dodává šablona

  submitBtn.classList.add('production-btn', 'production-btn-primary');
  cancelEditBtn.classList.add('production-btn', 'production-btn-secondary');
  prevBtn.classList.add('production-btn', 'production-btn-secondary', 'production-btn-sm');
  nextBtn.classList.add('production-btn', 'production-btn-secondary', 'production-btn-sm');

  const nameInput = form.elements.namedItem('name');
  const codeInput = form.elements.namedItem('code');
  const supplierInput = form.elements.namedItem('supplier');
  const priceInput = form.elements.namedItem('price');
  const densityInput = form.elements.namedItem('density');
  const solidsInput = form.elements.namedItem('solids');
  const okpInput = form.elements.namedItem('okp');
  const oilInput = form.elements.namedItem('oil');
  const vocInput = form.elements.namedItem('voc');
  const safetyInput = form.elements.namedItem('safety');
  const noteInput = form.elements.namedItem('note');

  const addSupplierButton = form.querySelector('[data-role="add-supplier"]');

  if (addSupplierButton) {
    addSupplierButton.addEventListener('click', () => {
      openSupplierModal();
    });
  }

  function buildMaterialModal() {
    if (materialModal) return materialModal;

    const wrapper = document.createElement('div');
    wrapper.className = 'production-modal-card materials-modal-card';
    wrapper.appendChild(formCard);

    materialModal = createStandardModal({
      eyebrow: labels.newMaterialEyebrow || 'Nová surovina',
      title: labels.addMaterial,
      subtitle: 'Zadejte parametry suroviny a uložte ji.',
      overlayClass: 'materials-modal-overlay',
      modalClass: 'materials-modal',
      bodyContent: wrapper,
      onClose: () => {
        materialModal = null;
      },
    });

    return materialModal;
  }

  function openMaterialModal() {
    const modalObj = buildMaterialModal();
    if (!modalObj.overlay.isConnected) {
      document.body.appendChild(modalObj.overlay);
    }
    document.body.classList.add('modal-open');
    setTimeout(() => {
      nameInput?.focus();
    }, 50);
  }

  function closeMaterialModal() {
    if (materialModal) {
      materialModal.handleClose();
    }
  }
  
  function buildSupplierModal() {
    if (supplierModal) return supplierModal;

    const form = document.createElement('form');
    form.className = 'supplier-inline-form';
    form.innerHTML = `
      <label>Název dodavatele<input name="name" required placeholder="Např. Acme s.r.o." /></label>
      <label>IČO<input name="ico" placeholder="12345678" /></label>
      <label>Poznámka<textarea name="note" rows="2" placeholder="Kontaktní osoba, telefon, ..."></textarea></label>
    `;

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'production-btn production-btn-primary';
    submit.textContent = 'Uložit dodavatele';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'production-btn production-btn-secondary';
    cancel.textContent = labels.close || 'Zavřít';
    cancel.addEventListener('click', () => supplierModal?.close());
    actions.appendChild(submit);
    actions.appendChild(cancel);
    form.appendChild(actions);

    const wrapper = document.createElement('div');
    wrapper.className = 'production-modal-card materials-modal-card';
    wrapper.appendChild(form);

    supplierModal = createStandardModal({
      eyebrow: 'Nový dodavatel',
      title: 'Dodavatel',
      subtitle: 'Zadejte údaje dodavatele a uložte jej.',
      overlayClass: 'materials-supplier-modal-overlay',
      modalClass: 'materials-supplier-modal',
      bodyContent: wrapper,
      onClose: () => {
        supplierModal = null;
      },
    });
    
    // Helpery pro komfortní použití z modálu „Přidat surovinu“
    supplierModal.reset = () => {
      try { form.reset(); } catch (_) {}
    };
    supplierModal.focusFirst = () => {
      const el = form.querySelector('input, textarea, select, button');
      el?.focus?.();
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = Object.fromEntries(new FormData(form).entries());
        const qs = new URLSearchParams({ action: 'create', ...data });
        const res = await apiFetch(`${SUPPLIERS_API}?${qs.toString()}`);
        await loadSuppliers();
        supplierSelect.value = res?.id || supplierSelect.value;
        showToast('Dodavatel uložen.');
        supplierModal.close();
      } catch (err) {
        showToast(err?.message || 'Uložení dodavatele se nezdařilo.', 'error');
      }
    });

    return supplierModal;
  }

  function openSupplierModal() {
    const modalObj = buildSupplierModal();
    if (typeof modalObj.reset === 'function') modalObj.reset();

    // Preferujeme sjednocený open() z createStandardModal (řeší ESC i znovu-připojení overlay navrch)
    if (typeof modalObj.open === 'function') {
      modalObj.open();
    } else {
      if (!modalObj.overlay.isConnected) document.body.appendChild(modalObj.overlay);
      document.body.classList.add('modal-open');
    }

    setTimeout(() => {
      if (typeof modalObj.focusFirst === 'function') modalObj.focusFirst();
    }, 50);
  }


  nameInput.setAttribute('list', nameDatalist.id);
  
  function formatPriceText(material) {
    if (typeof material.price === 'number') {
      return `${material.price.toFixed(2)} Kč/kg`;
    }
    if (material.price) return material.price;
    return '—';
  }

  function formatParamsHtml(material) {
    const densityText = material.density != null ? material.density : '–';
    const solidsText = material.solids != null ? `${material.solids} %` : '–';
    const vocText = material.voc != null ? `${material.voc} g/l` : '–';
    const parts = [];
    parts.push(`Hustota: ${densityText}`);
    parts.push(`Sušina: ${solidsText}`);
    parts.push(`VOC: ${vocText}`);
    if (material.okp) parts.push(`OKP: ${material.okp}`);
    if (material.oil) parts.push(`Olej: ${material.oil}`);
    if (material.safety) parts.push(`SDS: ${material.safety}`);
    return `<span class="materials-params-text">${parts.join(' | ')}</span>`;
  }

  function renderActionsCell(material) {
    const wrap = document.createElement('div');
    wrap.className = 'materials-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'secondary production-btn production-btn-secondary production-btn-sm';
    editBtn.textContent = 'Upravit';
    editBtn.addEventListener('click', () => {
      fillFormFromMaterial(material);
      openMaterialModal();
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'danger production-btn production-btn-danger production-btn-sm';
    delBtn.textContent = labels.delete;
    delBtn.addEventListener('click', async () => {
      if (!confirm('Opravdu odstranit tuto surovinu?')) return;
      try {
        await apiDelete(`${MATERIALS_API}?id=${encodeURIComponent(material.id)}`);
        showToast('Surovina odstraněna.');
        if (editingId === material.id) {
          resetFormState();
        }
        await reload();
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Odstranění suroviny selhalo.', { type: 'error' });
      }
    });

    wrap.appendChild(editBtn);
    wrap.appendChild(delBtn);
    return wrap;
  }

  function getDefaultColumns() {
    return [
      {
        id: 'code',
        label: 'Kód',
        sortable: true,
        defaultVisible: true,
        sortValue: (m) => (m.code || '').toString().toLowerCase(),
        render: (m) => m.code || '-',
      },
      {
        id: 'name',
        label: 'Název',
        sortable: true,
        defaultVisible: true,
        sortValue: (m) => (m.name || '').toString().toLowerCase(),
        render: (m) => m.name || '-',
      },
      {
        id: 'supplier',
        label: 'Dodavatel',
        sortable: true,
        defaultVisible: true,
        sortValue: (m) => (m.supplier || '').toString().toLowerCase(),
        render: (m) => m.supplier || '-',
      },
      {
        id: 'price',
        label: 'Cena',
        sortable: true,
        defaultVisible: true,
        sortValue: (m) => (typeof m.price === 'number' ? m.price : Number.MAX_SAFE_INTEGER),
        render: (m) => formatPriceText(m),
      },
      {
        id: 'note',
        label: 'Poznámka',
        sortable: true,
        defaultVisible: true,
        sortValue: (m) => (m.note || '').toString().toLowerCase(),
        render: (m) => (m.note ? truncate(m.note, 80) : '—'),
        cellClass: 'cell-note',
      },
      {
        id: 'params',
        label: 'Parametry',
        sortable: false,
        defaultVisible: true,
        render: (m) => formatParamsHtml(m),
        allowHtml: true,
      },
      {
        id: 'actions',
        label: '',
        sortable: false,
        defaultVisible: true,
        required: true,
        width: '1%',
        cellClass: 'form-actions',
        render: (m) => renderActionsCell(m),
      },
    ];
  }

  function resetFormState() {
    form.reset();
    editingId = null;
    submitBtn.textContent = 'Uložit surovinu';
    cancelEditBtn.style.display = 'none';
  }

  addBtnTop.addEventListener('click', () => {
    resetFormState();
    openMaterialModal();
  });

  function fillFormFromMaterial(material) {
    if (!material) return;

    nameInput.value = material.name || '';
    codeInput.value = material.code || '';
    supplierInput.value = material.supplier || '';
    priceInput.value = material.price != null ? material.price : '';
    densityInput.value = material.density != null ? material.density : '';
    solidsInput.value = material.solids != null ? material.solids : '';
    okpInput.value = material.okp || '';
    oilInput.value = material.oil || '';
    vocInput.value = material.voc != null ? material.voc : '';
    safetyInput.value = material.safety || '';
    noteInput.value = material.note || '';

    editingId = material.id;
    submitBtn.textContent = 'Uložit změny';
    cancelEditBtn.style.display = '';
  }
  
    async function loadSupplierOptions() {
    if (Array.isArray(supplierOptionsCache) && supplierOptionsCache.length > 0) {
      return supplierOptionsCache;
    }

    try {
      const response = await apiFetch(`${SUPPLIERS_API}?action=list`);
      const rows = Array.isArray(response.data) ? response.data : [];
      const names = Array.from(
        new Set(
          rows
            .map((row) => (row && row.name ? String(row.name).trim() : ''))
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, 'cs', { sensitivity: 'base' }));

      supplierOptionsCache = names;
      return names;
    } catch (err) {
      console.error(err);
      if (!supplierLoadErrorShown) {
        supplierLoadErrorShown = true;
        showToast(err.message || 'Načtení seznamu dodavatelů selhalo.', {
          type: 'error',
        });
      }

      // Fallback: pokud API spadne, vezmeme dodavatele z existujících surovin
      const supplierSet = new Set();
      materials.forEach((m) => {
        if (m.supplier) supplierSet.add(m.supplier.trim());
      });

      return Array.from(supplierSet).sort((a, b) =>
        a.localeCompare(b, 'cs', { sensitivity: 'base' })
      );
    }
  }

  async function updateSuggestionLists() {
    const nameSet = new Set();

    materials.forEach((m) => {
      if (m.name) nameSet.add(m.name.trim());
    });

    const names = Array.from(nameSet).sort((a, b) =>
      a.localeCompare(b, 'cs', { sensitivity: 'base' })
    );

    nameDatalist.innerHTML = names.map((n) => `<option value="${n}"></option>`).join('');

    const currentSupplierValue = supplierInput.value || '';
    const suppliers = await loadSupplierOptions();

    supplierInput.innerHTML =
      '<option value="">(vyberte dodavatele)</option>' +
      suppliers.map((s) => `<option value="${s}">${s}</option>`).join('');

    if (currentSupplierValue) {
      supplierInput.value = currentSupplierValue;
      if (supplierInput.value !== currentSupplierValue) {
        const opt = document.createElement('option');
        opt.value = currentSupplierValue;
        opt.textContent = currentSupplierValue;
        supplierInput.appendChild(opt);
        supplierInput.value = currentSupplierValue;
      }
    }
  }

  function sortList(list) {
    const column = columns.find((c) => c.id === sortBy);
    if (!column || column.sortable === false) {
      return [...list];
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const getValue = (item) => {
      if (typeof column.sortValue === 'function') {
        return column.sortValue(item);
      }
      const raw = item[column.id];
      return raw == null ? '' : raw;
    };
    return [...list].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * dir;
      }
      return String(va)
        .toString()
        .localeCompare(String(vb), 'cs', { sensitivity: 'base' }) * dir;
    });
  }

  function getVisibleColumns() {
    return columns.filter((c) => c.visible !== false);
  }

  function ensureSortColumn() {
    const current = columns.find((c) => c.id === sortBy && c.sortable !== false);
    if (current && current.visible !== false) return;
    const fallback = columns.find((c) => c.visible !== false && c.sortable !== false);
    if (fallback) {
      sortBy = fallback.id;
      sortDir = 'asc';
    }
  }

  function renderTableHead() {
    ensureSortColumn();
    head.innerHTML = '';
    const tr = document.createElement('tr');
    getVisibleColumns().forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col.label || '';
      if (col.width) {
        th.style.width = col.width;
      }
      if (col.sortable !== false) {
        th.dataset.sort = col.id;
        th.classList.add('sortable');
        if (sortBy === col.id) {
          th.classList.add(sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }
        th.addEventListener('click', () => {
          if (sortBy === col.id) {
            sortDir = sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            sortBy = col.id;
            sortDir = 'asc';
          }
          renderTableHead();
          applyFilter();
        });
      }
      tr.appendChild(th);
    });
    head.appendChild(tr);
  }

  function renderRows(pageItems, total, pageCount) {
    const visibleColumns = getVisibleColumns();
    const colCount = Math.max(1, visibleColumns.length || 1);

    if (!Array.isArray(pageItems) || total === 0) {
      tbody.innerHTML = `<tr><td colspan="${colCount}">${labels.emptyMaterials}</td></tr>`;
      countLabel.textContent = '0 položek';
      pageInfo.textContent = '';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    tbody.innerHTML = '';

    pageItems.forEach((material) => {
      const tr = document.createElement('tr');

      visibleColumns.forEach((col) => {
        const td = document.createElement('td');
        if (col.cellClass) td.className = col.cellClass;
        if (col.width) td.style.width = col.width;

        const content = col.render ? col.render(material) : material[col.id];
        if (content instanceof Node) {
          td.appendChild(content);
        } else if (col.allowHtml) {
          td.innerHTML = content != null ? content : '—';
        } else {
          td.textContent = content != null && content !== '' ? content : '—';
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    const effectivePageSize = pageSize || PAGE_SIZE;
    const startIndex = (currentPage - 1) * effectivePageSize + 1;
    const endIndex = Math.min(currentPage * effectivePageSize, total);
    countLabel.textContent = `${total} položek`;
    pageInfo.textContent = `${startIndex}–${endIndex} z ${total} (strana ${currentPage}/${pageCount})`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= pageCount;
  }

  function renderTable() {
    const total = typeof totalCount === 'number' ? totalCount : materials.length;
    if (!total || materials.length === 0) {
      renderRows([], 0, 0);
      return;
    }
    const effectivePageSize = pageSize || PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));
    if (currentPage > pageCount) currentPage = pageCount;
    renderRows(materials, total, pageCount);
  }

  function applyFilter() {
    const term = (filterInput.value || '').trim().toLowerCase();
    currentSearchTerm = term;
    currentPage = 1;
    reload();
  }

  function normalizeColumns(list) {
    return (list || []).map((col, index) => {
      const visible =
        col.visible !== undefined ? col.visible !== false : col.defaultVisible !== false;
      return {
        ...col,
        order: typeof col.order === 'number' ? col.order : index,
        visible: col.required ? true : visible,
      };
    });
  }

  function refreshColumnOrder() {
    columns = normalizeColumns(columns);
  }

  function moveColumn(id, delta, list = columns) {
    const currentIndex = list.findIndex((c) => c.id === id);
    if (currentIndex < 0) return list;
    const targetIndex = currentIndex + delta;
    if (targetIndex < 0 || targetIndex >= list.length) return list;
    const updated = [...list];
    const [moved] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, moved);
    const normalized = normalizeColumns(updated);
    if (list === columns) {
      columns = normalized;
    }
    return normalized;
  }

  function closeColumnModal() {
    if (columnModal) {
      columnModal.remove();
      if (!document.querySelector('.modal-overlay')) {
        document.body.classList.remove('modal-open');
      }
      columnModal = null;
    }
  }

  async function handleResetColumns() {
    try {
      await deleteUserColumns(MODULE_CODE, VIEW_CODE);
      columns = normalizeColumns(getDefaultColumns());
      renderTableHead();
      applyFilter();
      closeColumnModal();
      showToast('Výchozí sloupce byly obnoveny.');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Obnovení sloupců selhalo.', { type: 'error' });
    }
  }

  async function handleSaveColumns(nextColumns = columns) {
    columns = normalizeColumns(nextColumns);
    try {
      await saveUserColumns(MODULE_CODE, VIEW_CODE, columns);
      renderTableHead();
      applyFilter();
      closeColumnModal();
      showToast('Nastavení sloupců bylo uloženo.');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Uložení nastavení sloupců selhalo.', { type: 'error' });
    }
  }

  function openColumnsModal() {
    closeColumnModal();
    columnModal = document.createElement('div');
    columnModal.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    columnModal.appendChild(modal);

    const header = document.createElement('div');
    header.className = 'modal-header';
    const title = document.createElement('h3');
    title.textContent = 'Nastavení sloupců';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', closeColumnModal);
    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const intro = document.createElement('p');
    intro.className = 'muted';
    intro.textContent = 'Vyberte, které sloupce chcete zobrazit, a upravte jejich pořadí.';
    modal.appendChild(intro);

    const list = document.createElement('ul');
    list.className = 'column-config-list';
    let draftColumns = normalizeColumns(columns);

    const renderList = () => {
      list.innerHTML = '';
      draftColumns.forEach((col, index) => {
        const item = document.createElement('li');
        item.className = 'column-config-item';

        const label = document.createElement('label');
        label.className = 'column-config-label';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = col.visible !== false;
        checkbox.disabled = col.required === true;
        checkbox.addEventListener('change', () => {
          col.visible = col.required ? true : checkbox.checked;
        });
        label.appendChild(checkbox);
        const text = document.createElement('span');
        text.textContent = col.label || col.id;
        label.appendChild(text);
        if (col.required) {
          const badge = document.createElement('span');
          badge.className = 'pill pill-secondary';
          badge.textContent = 'Povinný';
          label.appendChild(badge);
        }
        item.appendChild(label);

        const widthInput = document.createElement('input');
        widthInput.type = 'text';
        widthInput.className = 'column-config-width';
        widthInput.placeholder = 'Šířka (px/%)';
        widthInput.value = col.width || '';
        widthInput.addEventListener('input', (e) => {
          const val = (e.target.value || '').trim();
          col.width = val || null;
        });
        item.appendChild(widthInput);

        const actions = document.createElement('div');
        actions.className = 'column-config-actions';

        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'production-btn production-btn-secondary production-btn-sm';
        upBtn.textContent = '▲';
        upBtn.disabled = index === 0;
        upBtn.addEventListener('click', () => {
          draftColumns = moveColumn(col.id, -1, draftColumns);
          renderList();
        });

        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'production-btn production-btn-secondary production-btn-sm';
        downBtn.textContent = '▼';
        downBtn.disabled = index === draftColumns.length - 1;
        downBtn.addEventListener('click', () => {
          draftColumns = moveColumn(col.id, 1, draftColumns);
          renderList();
        });

        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        item.appendChild(actions);

        list.appendChild(item);
      });
    };

    renderList();

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'modal-actions';
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'production-btn production-btn-secondary';
    resetBtn.textContent = 'Obnovit výchozí';
    resetBtn.addEventListener('click', handleResetColumns);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'production-btn production-btn-secondary';
    cancelBtn.textContent = 'Zrušit';
    cancelBtn.addEventListener('click', closeColumnModal);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'production-btn production-btn-primary';
    saveBtn.textContent = 'Uložit';
    saveBtn.addEventListener('click', () => handleSaveColumns(draftColumns));

    actionsWrap.appendChild(resetBtn);
    actionsWrap.appendChild(cancelBtn);
    actionsWrap.appendChild(saveBtn);

    modal.appendChild(list);
    modal.appendChild(actionsWrap);

    document.body.appendChild(columnModal);
    document.body.classList.add('modal-open');
  }

  async function loadColumnsConfig() {
    const loaded = await loadUserColumns(MODULE_CODE, VIEW_CODE, getDefaultColumns());
    columns = normalizeColumns(loaded);
    renderTableHead();
  }

  async function reload() {
    const loadingColspan = Math.max(1, getVisibleColumns().length || 1);
    tbody.innerHTML = `<tr><td colspan="${loadingColspan}">Načítám…</td></tr>`;
    countLabel.textContent = '';
    pageInfo.textContent = '';
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(pageSize),
        search: currentSearchTerm || '',
        sortBy,
        sortDir,
      });

      const data = await apiFetch(`${MATERIALS_API}?${params.toString()}`);
      const payload = data.data || {};
      materials = payload.items || data.materials || [];
      totalCount =
        typeof payload.totalCount === 'number' ? payload.totalCount : materials.length;
      currentPage = typeof payload.page === 'number' ? payload.page : currentPage;
      pageSize = typeof payload.pageSize === 'number' ? payload.pageSize : pageSize;

      saveList(STORAGE_KEYS.rawMaterials, materials);
      await updateSuggestionLists();
      renderTable();

      if (typeof onMaterialCountChange === 'function') {
        onMaterialCountChange(totalCount);
      }
    } catch (err) {
      console.error(err);
      const errorColspan = Math.max(1, getVisibleColumns().length || 1);
      tbody.innerHTML = `<tr><td colspan="${errorColspan}">Chyba při načítání surovin.</td></tr>`;
      countLabel.textContent = '';
      pageInfo.textContent = '';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      showToast(err.message || 'Chyba při načítání surovin.', { type: 'error' });
    }
  }

  filterInput.addEventListener('input', () => {
    applyFilter();
  });

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      reload();
    }
  });

  nextBtn.addEventListener('click', () => {
    const total = typeof totalCount === 'number' ? totalCount : materials.length;
    const effectivePageSize = pageSize || PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));
    if (currentPage < pageCount) {
      currentPage += 1;
      reload();
    }
  });

  if (columnSettingsBtn) {
    columnSettingsBtn.addEventListener('click', openColumnsModal);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);

    const payload = {
      id: editingId || null,
      name: (fd.get('name') || '').trim(),
      code: (fd.get('code') || '').trim(),
      supplier: (fd.get('supplier') || '').trim(),
      price: fd.get('price') ? Number(fd.get('price')) : null,
      density: fd.get('density') ? Number(fd.get('density')) : null,
      solids: fd.get('solids') ? Number(fd.get('solids')) : null,
      okp: (fd.get('okp') || '').trim(),
      oil: (fd.get('oil') || '').trim(),
      voc: fd.get('voc') ? Number(fd.get('voc')) : null,
      safety: (fd.get('safety') || '').trim(),
      note: (fd.get('note') || '').trim(),
    };

    if (!payload.name) {
      showToast('Zadejte název suroviny.', { type: 'error' });
      return;
    }

    if (!payload.code) {
      payload.code = generateMaterialCode(materials);
    }

    const lowerName = payload.name.toLowerCase();
    const lowerSupplier = payload.supplier.toLowerCase();

    const duplicateName = materials.find(
      (m) => m.name && m.name.toLowerCase() === lowerName && m.id !== editingId
    );
    if (duplicateName) {
      showToast('Surovina s tímto názvem už existuje.', { type: 'error' });
      return;
    }

    try {
      await apiPost(MATERIALS_API, payload);
      showToast(editingId ? 'Změny suroviny byly uloženy.' : 'Surovina uložena.');
      resetFormState();
      closeMaterialModal();
      await reload();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Uložení suroviny selhalo.', { type: 'error' });
    }
  });

  cancelEditBtn.addEventListener('click', () => {
    resetFormState();
    closeMaterialModal();
  });

  await loadColumnsConfig();
  await reload();
}

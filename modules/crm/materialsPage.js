import { showToast } from '../../core/uiService.js';
import { requestWithCsrf } from '../../core/authService.js';
import { createCard, STORAGE_KEYS, saveList, truncate } from './shared.js';

const MATERIALS_API = './modules/crm/api/materials.php';

async function apiFetch(url, options = {}) {
  const res = await fetch(url, { credentials: 'same-origin', ...options });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Operace selhala');
  }
  return data;
}

async function apiPost(url, payload) {
  const res = await requestWithCsrf(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Operace selhala');
  }
  return data;
}

async function apiDelete(url) {
  const res = await requestWithCsrf(url, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Operace selhala');
  }
  return data;
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

  const grid = document.createElement('div');
  grid.className = 'form-grid materials-layout';

  const formCard = createCard(
    labels.addMaterial,
    'Zadejte parametry suroviny a uložte ji – bez uložených surovin nelze pokračovat v polotovarech a recepturách.'
  );

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
        <input name="supplier" placeholder="ABC Pigments" />
      </label>
      <label>
        Cena / kg
        <input name="price" type="number" min="0" step="0.01" placeholder="120" />
      </label>
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
  formCard.style.display = 'none';

  const nameDatalist = document.createElement('datalist');
  nameDatalist.id = 'crm-material-name-list';
  const supplierDatalist = document.createElement('datalist');
  supplierDatalist.id = 'crm-material-supplier-list';
  formCard.appendChild(nameDatalist);
  formCard.appendChild(supplierDatalist);

  const listCard = createCard(
    'Evidence surovin',
    'Přehled surovin, které lze dále použít v polotovarech, recepturách a zakázkách.'
  );

  const toolbar = document.createElement('div');
  toolbar.className = 'table-toolbar';
  toolbar.innerHTML = `
    <div class="materials-toolbar-inner">
      <label class="materials-filter">
        <span class="muted materials-filter-label">Filtrovat suroviny</span>
        <input type="search" name="materialsFilter" placeholder="Hledat podle kódu, názvu nebo dodavatele" />
      </label>
      <span class="muted materials-count"></span>
    </div>
  `;
  listCard.appendChild(toolbar);

  const table = document.createElement('table');
  table.className = 'striped materials-table';
  const head = document.createElement('thead');
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
  const tbody = document.createElement('tbody');
  table.appendChild(head);
  table.appendChild(tbody);

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-scroll';
  tableWrapper.appendChild(table);

  listCard.appendChild(tableWrapper);

  const pagination = document.createElement('div');
  pagination.className = 'materials-pagination';
  pagination.innerHTML = `
    <button type="button" data-page="prev">‹ Předchozí</button>
    <span class="materials-page-info"></span>
    <button type="button" data-page="next">Další ›</button>
  `;
  listCard.appendChild(pagination);

  const toggleWrap = document.createElement('div');
  toggleWrap.className = 'form-actions materials-toggle';
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.textContent = 'Přidat surovinu';
  toggleBtn.className = 'crm-btn crm-btn-primary';
  toggleWrap.appendChild(toggleBtn);

  grid.appendChild(formCard);
  grid.appendChild(listCard);

  container.innerHTML = '';
  container.appendChild(toggleWrap);
  container.appendChild(grid);

  let materials = [];
  let filtered = [];
  let editingId = null;
  let currentPage = 1;
  let sortBy = 'code';
  let sortDir = 'asc';

  const submitBtn = form.querySelector('button[data-role="save"]');
  const cancelEditBtn = form.querySelector('button[data-role="cancel-edit"]');
  const filterInput = toolbar.querySelector('input[name="materialsFilter"]');
  const countLabel = toolbar.querySelector('.materials-count');

  const pageInfo = pagination.querySelector('.materials-page-info');
  const prevBtn = pagination.querySelector('[data-page="prev"]');
  const nextBtn = pagination.querySelector('[data-page="next"]');

  submitBtn.classList.add('crm-btn', 'crm-btn-primary');
  cancelEditBtn.classList.add('crm-btn', 'crm-btn-secondary');
  prevBtn.classList.add('crm-btn', 'crm-btn-secondary', 'crm-btn-sm');
  nextBtn.classList.add('crm-btn', 'crm-btn-secondary', 'crm-btn-sm');

  const sortHeaders = head.querySelectorAll('th[data-sort]');
  const defaultSortHeader = head.querySelector('th[data-sort="code"]');
  if (defaultSortHeader) {
    defaultSortHeader.classList.add('sorted-asc');
  }

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

  nameInput.setAttribute('list', nameDatalist.id);
  supplierInput.setAttribute('list', supplierDatalist.id);

  function showForm() {
    formCard.style.display = '';
    toggleBtn.textContent = 'Skrýt formulář';
  }

  function hideForm() {
    formCard.style.display = 'none';
    toggleBtn.textContent = 'Přidat surovinu';
  }

  toggleBtn.addEventListener('click', () => {
    const hidden = formCard.style.display === 'none';
    if (hidden) {
      resetFormState();
      showForm();
      formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      hideForm();
    }
  });

  function resetFormState() {
    form.reset();
    editingId = null;
    submitBtn.textContent = 'Uložit surovinu';
    cancelEditBtn.style.display = 'none';
  }

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

  function updateSuggestionLists() {
    const nameSet = new Set();
    const supplierSet = new Set();

    materials.forEach((m) => {
      if (m.name) nameSet.add(m.name.trim());
      if (m.supplier) supplierSet.add(m.supplier.trim());
    });

    const names = Array.from(nameSet).sort((a, b) =>
      a.localeCompare(b, 'cs', { sensitivity: 'base' })
    );
    const suppliers = Array.from(supplierSet).sort((a, b) =>
      a.localeCompare(b, 'cs', { sensitivity: 'base' })
    );

    nameDatalist.innerHTML = names.map((n) => `<option value="${n}"></option>`).join('');
    supplierDatalist.innerHTML = suppliers
      .map((s) => `<option value="${s}"></option>`)
      .join('');
  }

  function sortList(list) {
    const key = sortBy;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = (a[key] || '').toString().toLowerCase();
      const vb = (b[key] || '').toString().toLowerCase();
      return va.localeCompare(vb, 'cs', { sensitivity: 'base' }) * dir;
    });
  }

  function renderRows(pageItems, total, pageCount) {
    if (!Array.isArray(pageItems) || total === 0) {
      tbody.innerHTML = `<tr><td colspan="7">${labels.emptyMaterials}</td></tr>`;
      countLabel.textContent = '0 položek';
      pageInfo.textContent = '';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    tbody.innerHTML = '';

    pageItems.forEach((m) => {
      const tr = document.createElement('tr');
      const priceText =
        typeof m.price === 'number'
          ? `${m.price.toFixed(2)} Kč/kg`
          : m.price
          ? m.price
          : '—';
      const densityText = m.density != null ? m.density : '–';
      const solidsText = m.solids != null ? `${m.solids} %` : '–';
      const vocText = m.voc != null ? `${m.voc} g/l` : '–';
      const noteText = m.note ? truncate(m.note, 80) : '—';

      const parts = [];
      parts.push(`Hustota: ${densityText}`);
      parts.push(`Sušina: ${solidsText}`);
      parts.push(`VOC: ${vocText}`);
      if (m.okp) parts.push(`OKP: ${m.okp}`);
      if (m.oil) parts.push(`Olej: ${m.oil}`);
      if (m.safety) parts.push(`SDS: ${m.safety}`);
      const paramsHtml = `<span class="materials-params-text">${parts.join(' | ')}</span>`;

      tr.innerHTML = `
        <td>${m.code || '-'}</td>
        <td>${m.name}</td>
        <td>${m.supplier || '-'}</td>
        <td>${priceText}</td>
        <td>${noteText}</td>
        <td>${paramsHtml}</td>
        <td class="form-actions" style="white-space:nowrap;"></td>
      `;

      const actionsCell = tr.querySelector('td.form-actions');

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'secondary crm-btn crm-btn-secondary crm-btn-sm';
      editBtn.textContent = 'Upravit';
      editBtn.addEventListener('click', () => {
        fillFormFromMaterial(m);
        showForm();
        formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'danger crm-btn crm-btn-danger crm-btn-sm';
      delBtn.textContent = labels.delete;
      delBtn.addEventListener('click', async () => {
        if (!confirm('Opravdu odstranit tuto surovinu?')) return;
        try {
          await apiDelete(`${MATERIALS_API}?id=${encodeURIComponent(m.id)}`);
          showToast('Surovina odstraněna.');
          if (editingId === m.id) {
            resetFormState();
          }
          await reload();
        } catch (err) {
          console.error(err);
          showToast(err.message || 'Odstranění suroviny selhalo.', { type: 'error' });
        }
      });

      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(delBtn);

      tbody.appendChild(tr);
    });

    const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
    const endIndex = Math.min(currentPage * PAGE_SIZE, total);
    countLabel.textContent = `${total} položek`;
    pageInfo.textContent = `${startIndex}–${endIndex} z ${total} (strana ${currentPage}/${pageCount})`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= pageCount;
  }

  function renderTable() {
    const total = filtered.length;
    if (!total) {
      renderRows([], 0, 0);
      return;
    }
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > pageCount) currentPage = pageCount;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);
    renderRows(pageItems, total, pageCount);
  }

  function applyFilter() {
    const term = (filterInput.value || '').trim().toLowerCase();
    let base = materials;

    if (term) {
      base = materials.filter((m) => {
        const code = (m.code || '').toLowerCase();
        const name = (m.name || '').toLowerCase();
        const supplier = (m.supplier || '').toLowerCase();
        const note = (m.note || '').toLowerCase();
        return (
          code.includes(term) ||
          name.includes(term) ||
          supplier.includes(term) ||
          note.includes(term)
        );
      });
    }

    filtered = sortList(base);
    currentPage = 1;
    renderTable();
  }

  async function reload() {
    tbody.innerHTML = '<tr><td colspan="7">Načítám…</td></tr>';
    countLabel.textContent = '';
    pageInfo.textContent = '';
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    try {
      const data = await apiFetch(MATERIALS_API);
      materials = data.materials || data.data || [];
      saveList(STORAGE_KEYS.rawMaterials, materials);

      updateSuggestionLists();
      applyFilter();

      if (typeof onMaterialCountChange === 'function') {
        onMaterialCountChange(materials.length);
      }
    } catch (err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="7">Chyba při načítání surovin.</td></tr>';
      countLabel.textContent = '';
      pageInfo.textContent = '';
      showToast(err.message || 'Chyba při načítání surovin.', { type: 'error' });
    }
  }

  filterInput.addEventListener('input', () => {
    applyFilter();
  });

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderTable();
    }
  });

  nextBtn.addEventListener('click', () => {
    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage < pageCount) {
      currentPage += 1;
      renderTable();
    }
  });

  sortHeaders.forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (!col) return;
      if (sortBy === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortBy = col;
        sortDir = 'asc';
      }

      sortHeaders.forEach((h) => {
        h.classList.remove('sorted-asc', 'sorted-desc');
      });
      th.classList.add(sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');

      applyFilter();
    });
  });

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

    if (payload.supplier) {
      const duplicateSupplier = materials.find(
        (m) =>
          m.supplier &&
          m.supplier.toLowerCase() === lowerSupplier &&
          m.id !== editingId
      );
      if (duplicateSupplier) {
        showToast('Tento dodavatel je již evidován u jiné suroviny.', {
          type: 'error',
        });
        return;
      }
    }

    try {
      await apiPost(MATERIALS_API, payload);
      showToast(editingId ? 'Změny suroviny byly uloženy.' : 'Surovina uložena.');
      resetFormState();
      await reload();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Uložení suroviny selhalo.', { type: 'error' });
    }
  });

  cancelEditBtn.addEventListener('click', () => {
    resetFormState();
  });

  await reload();
}

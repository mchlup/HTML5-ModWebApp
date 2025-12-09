import labels from './lang_cs.js';
import { showToast } from '../../core/uiService.js';
import { requestWithCsrf } from '../../core/authService.js';

const STORAGE_KEYS = {
  rawMaterials: 'crm_raw_materials',
  intermediates: 'crm_intermediates',
  recipes: 'crm_recipes',
  orders: 'crm_orders',
};

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

function loadList(key) {
  try {
    const raw = localStorage.getItem(key);
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function createCard(titleText, subtitleText) {
  const card = document.createElement('div');
  card.className = 'card';
  if (titleText) {
    const title = document.createElement('h3');
    title.textContent = titleText;
    card.appendChild(title);
  }
  if (subtitleText) {
    const subtitle = document.createElement('p');
    subtitle.className = 'muted';
    subtitle.textContent = subtitleText;
    card.appendChild(subtitle);
  }
  return card;
}

function createPill(text, type = 'default') {
  const span = document.createElement('span');
  span.className = `pill pill-${type}`;
  span.textContent = text;
  return span;
}

function createBadge(text, type = 'default') {
  const span = document.createElement('span');
  span.className = `badge badge-${type}`;
  span.textContent = text;
  return span;
}

function renderEmptyState(card, message) {
  const empty = document.createElement('p');
  empty.className = 'muted';
  empty.textContent = message;
  card.appendChild(empty);
}

/**
 * SUROVINY – DB přes MATERIALS_API
 * - responzivní rozložení polí
 * - CRUD včetně editace
 * - filtrování a scrollovatelný seznam pro větší počet záznamů
 */
function renderMaterials(container) {
  const grid = document.createElement('div');
  grid.className = 'form-grid materials-layout';

  const formCard = createCard(
    labels.addMaterial,
    'Zadejte parametry suroviny a uložte ji – bez uložených surovin nelze pokračovat v polotovarech a recepturách.'
  );

  const form = document.createElement('form');
  form.className = 'form-grid materials-form';

  // základní grid formuláře (jeden sloupec, hezké mezery)
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
        <input name="code" required placeholder="ACR-245" />
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
  grid.appendChild(formCard);

  const listCard = createCard(
    'Evidence surovin',
    'Přehled surovin, které lze dále použít v polotovarech, recepturách a zakázkách.'
  );

  // toolbar nad tabulkou – filtr + počet záznamů
  const toolbar = document.createElement('div');
  toolbar.className = 'table-toolbar';
  toolbar.style.marginBottom = '0.75rem';
  toolbar.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;justify-content:space-between;">
      <label style="flex:1 1 220px;max-width:420px;">
        <span class="muted" style="display:block;font-size:0.85rem;margin-bottom:0.15rem;">Filtrovat suroviny</span>
        <input type="search" name="materialsFilter" placeholder="Hledat podle kódu, názvu nebo dodavatele" />
      </label>
      <span class="muted materials-count" style="white-space:nowrap;"></span>
    </div>
  `;
  listCard.appendChild(toolbar);

  const table = document.createElement('table');
  table.className = 'striped materials-table';
  const head = document.createElement('thead');
  head.innerHTML = `
    <tr>
      <th>Kód</th>
      <th>Název</th>
      <th>Dodavatel</th>
      <th>Cena</th>
      <th>Parametry</th>
      <th style="width: 1%; white-space: nowrap;"></th>
    </tr>
  `;
  const tbody = document.createElement('tbody');
  table.appendChild(head);
  table.appendChild(tbody);

  // scrollovatelný wrapper pro tabulku
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-scroll';
  tableWrapper.style.maxHeight = '380px';
  tableWrapper.style.overflowY = 'auto';
  tableWrapper.style.overflowX = 'hidden';
  tableWrapper.appendChild(table);

  listCard.appendChild(tableWrapper);
  grid.appendChild(listCard);

  container.innerHTML = '';
  container.appendChild(grid);

  // --- stav pro editaci & filtrování ---
  let materials = [];
  let editingId = null;

  const submitBtn = form.querySelector('button[data-role="save"]');
  const cancelEditBtn = form.querySelector('button[data-role="cancel-edit"]');
  const filterInput = toolbar.querySelector('input[name="materialsFilter"]');
  const countLabel = toolbar.querySelector('.materials-count');

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

  function renderRows(source) {
    if (!Array.isArray(source) || source.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">${labels.emptyMaterials}</td></tr>`;
      countLabel.textContent = materials.length
        ? `0 z ${materials.length} položek`
        : '0 položek';
      return;
    }

    tbody.innerHTML = '';

    source.forEach((m) => {
      const tr = document.createElement('tr');
      const priceText =
        typeof m.price === 'number'
          ? `${m.price.toFixed(2)} Kč/kg`
          : m.price
          ? m.price
          : '—';
      const densityText = m.density != null ? m.density : '–';
      const solidsText = m.solids != null ? `${m.solids} %` : '–';
      const vocText = m.voc != null ? m.voc : '–';

      let paramsHtml = '<div class="materials-params" style="display:flex;flex-direction:column;gap:0.15rem;font-size:0.9em;">';
      paramsHtml += `<div>Hustota: ${densityText}</div>`;
      paramsHtml += `<div>Sušina: ${solidsText}</div>`;
      paramsHtml += `<div>VOC: ${vocText} g/l</div>`;
      if (m.okp) {
        paramsHtml += `<div>OKP / kategorie: ${m.okp}</div>`;
      }
      if (m.oil) {
        paramsHtml += `<div>Olej / olejová fáze: ${m.oil}</div>`;
      }
      if (m.safety) {
        paramsHtml += `<div>Nebezpečnost / SDS: ${m.safety}</div>`;
      }
      paramsHtml += '</div>';

      tr.innerHTML = `
        <td>${m.code || '-'}</td>
        <td>${m.name}</td>
        <td>${m.supplier || '-'}</td>
        <td>${priceText}</td>
        <td>${paramsHtml}</td>
        <td class="form-actions" style="white-space: nowrap;"></td>
      `;

      const actionsCell = tr.querySelector('td.form-actions');

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'secondary';
      editBtn.textContent = 'Upravit';
      editBtn.addEventListener('click', () => {
        fillFormFromMaterial(m);
        formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'danger';
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

    if (source.length === materials.length) {
      countLabel.textContent = `${materials.length} položek`;
    } else {
      countLabel.textContent = `${source.length} z ${materials.length} položek`;
    }
  }

  function applyFilter() {
    const term = (filterInput.value || '').trim().toLowerCase();
    if (!term) {
      renderRows(materials);
      return;
    }
    const filtered = materials.filter((m) => {
      const code = (m.code || '').toLowerCase();
      const name = (m.name || '').toLowerCase();
      const supplier = (m.supplier || '').toLowerCase();
      return (
        code.includes(term) ||
        name.includes(term) ||
        supplier.includes(term)
      );
    });
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">Žádná surovina neodpovídá filtru.</td></tr>';
      countLabel.textContent = `0 z ${materials.length} položek`;
      return;
    }
    renderRows(filtered);
  }

  async function reload() {
    tbody.innerHTML = '<tr><td colspan="6">Načítám…</td></tr>';
    countLabel.textContent = '';
    try {
      const data = await apiFetch(MATERIALS_API);
      materials = data.materials || data.data || [];
      if (!materials.length) {
        renderRows([]);
        return;
      }
      applyFilter(); // použij aktuální filtr nad čerstvě načtenými daty
    } catch (err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="6">Chyba při načítání surovin.</td></tr>';
      countLabel.textContent = '';
      showToast(err.message || 'Chyba při načítání surovin.', { type: 'error' });
    }
  }

  filterInput.addEventListener('input', () => {
    applyFilter();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      id: editingId || undefined,
      code: (fd.get('code') || '').trim(),
      name: (fd.get('name') || '').trim(),
      supplier: (fd.get('supplier') || '').trim(),
      price: fd.get('price') !== '' ? Number(fd.get('price')) : null,
      density: fd.get('density') !== '' ? Number(fd.get('density')) : null,
      solids: fd.get('solids') !== '' ? Number(fd.get('solids')) : null,
      okp: (fd.get('okp') || '').trim(),
      oil: (fd.get('oil') || '').trim(),
      voc: fd.get('voc') !== '' ? Number(fd.get('voc')) : null,
      safety: (fd.get('safety') || '').trim(),
      note: (fd.get('note') || '').trim(),
    };

    if (!payload.code || !payload.name) {
      showToast('Kód a název suroviny jsou povinné.', { type: 'error' });
      return;
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

  reload();
}

/**
 * POLOTOVARY – zatím localStorage, navážeme na DB v dalším kroku
 */
function renderIntermediates(container) {
  const materials = loadList(STORAGE_KEYS.rawMaterials);
  const intermediates = loadList(STORAGE_KEYS.intermediates);

  const grid = document.createElement('div');
  grid.className = 'form-grid';

  const formCard = createCard(
    labels.addIntermediate,
    'Vytvořte polotovary z již evidovaných surovin.'
  );
  if (!materials.length) {
    renderEmptyState(formCard, labels.emptyIntermediates);
  } else {
    const form = document.createElement('form');
    form.className = 'form-grid';
    form.innerHTML = `
      <label>Název polotovaru<input name="name" required placeholder="Pigmentová pasta" /></label>
      <label>Kód / dávka<input name="code" placeholder="PIG-01" /></label>
      <label>Základ
        <select name="base">
          <option value="">(nezadán)</option>
          <option value="water">Vodou ředitelný</option>
          <option value="solvent">Rozpouštědlový</option>
        </select>
      </label>
      <label>Sušina (%)<input name="solids" type="number" step="0.1" min="0" max="100" placeholder="55" /></label>
      <label>Viskozita (mPa·s)<input name="viscosity" type="number" step="1" min="0" placeholder="750" /></label>
    `;

    const compositionWrap = document.createElement('div');
    compositionWrap.className = 'form-field';
    const header = document.createElement('div');
    header.className = 'flex-row';
    header.style.justifyContent = 'space-between';
    const label = document.createElement('label');
    label.textContent = 'Složení z evidovaných surovin';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Přidat surovinu';
    header.appendChild(label);
    header.appendChild(addBtn);
    compositionWrap.appendChild(header);

    const list = document.createElement('div');
    list.className = 'form-grid';
    compositionWrap.appendChild(list);

    function addRow(prefill = {}) {
      const row = document.createElement('div');
      row.className = 'composition-row';
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '2fr 1fr auto';
      row.style.gap = '0.5rem';

      const select = document.createElement('select');
      materials.forEach((mat) => {
        const opt = document.createElement('option');
        opt.value = mat.id;
        opt.textContent = `${mat.code || mat.name} — ${mat.name}`;
        if (prefill.materialId && prefill.materialId === mat.id) opt.selected = true;
        select.appendChild(opt);
      });

      const share = document.createElement('input');
      share.type = 'number';
      share.min = '0';
      share.max = '100';
      share.step = '0.1';
      share.placeholder = 'Podíl (%)';
      if (prefill.share) share.value = prefill.share;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger';
      remove.textContent = '✕';
      remove.addEventListener('click', () => row.remove());

      row.appendChild(select);
      row.appendChild(share);
      row.appendChild(remove);
      list.appendChild(row);
    }

    addBtn.addEventListener('click', () => addRow());
    addRow();

    const actionRow = document.createElement('div');
    actionRow.className = 'form-actions';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Uložit polotovar';
    actionRow.appendChild(submitBtn);

    form.appendChild(compositionWrap);
    form.appendChild(actionRow);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const composition = Array.from(list.querySelectorAll('.composition-row'))
        .map((row) => ({
          materialId: row.querySelector('select')?.value,
          share: parseFloat(row.querySelector('input')?.value) || 0,
        }))
        .filter((c) => c.materialId);

      if (!composition.length) {
        showToast('Přidejte alespoň jednu surovinu do složení.', { type: 'error' });
        return;
      }

      const entry = {
        id: crypto.randomUUID(),
        name: fd.get('name'),
        code: fd.get('code'),
        base: fd.get('base'),
        solids: parseFloat(fd.get('solids')) || null,
        viscosity: parseFloat(fd.get('viscosity')) || null,
        composition,
        createdAt: new Date().toISOString(),
      };

      saveList(STORAGE_KEYS.intermediates, [...intermediates, entry]);
      showToast('Polotovar uložen.');
      renderIntermediates(container);
    });

    formCard.appendChild(form);
  }
  grid.appendChild(formCard);

  const listCard = createCard('Přehled polotovarů', 'Receptury, které využívají uložené suroviny.');
  if (!intermediates.length) {
    renderEmptyState(listCard, 'Zatím nejsou evidovány žádné polotovary.');
  } else {
    const list = document.createElement('div');
    list.className = 'list';

    intermediates.forEach((i) => {
      const block = document.createElement('div');
      block.className = 'list-row';

      const header = document.createElement('div');
      header.className = 'flex-row';
      header.style.justifyContent = 'space-between';
      header.innerHTML = `<div><div class="strong">${i.name}</div><div class="muted">${i.code || ''}</div></div>`;
      const tags = document.createElement('div');
      tags.className = 'pill-row';
      if (i.base === 'water') tags.appendChild(createPill('Vodou ředitelný'));
      if (i.base === 'solvent') tags.appendChild(createPill('Rozpouštědlový'));
      if (i.solids) tags.appendChild(createPill(`Sušina ${i.solids}%`));
      if (i.viscosity) tags.appendChild(createPill(`Viskozita ${i.viscosity} mPa·s`));
      header.appendChild(tags);
      block.appendChild(header);

      if (i.composition?.length) {
        const comp = document.createElement('div');
        comp.className = 'muted';
        comp.textContent = `${i.composition.length}× surovina ve složení`;
        block.appendChild(comp);
      }

      const actions = document.createElement('div');
      actions.className = 'form-actions';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger';
      del.textContent = labels.delete;
      del.addEventListener('click', () => {
        const next = intermediates.filter((item) => item.id !== i.id);
        saveList(STORAGE_KEYS.intermediates, next);
        showToast('Polotovar odstraněn.');
        renderIntermediates(container);
      });
      actions.appendChild(del);
      block.appendChild(actions);

      list.appendChild(block);
    });

    listCard.appendChild(list);
  }
  grid.appendChild(listCard);

  container.innerHTML = '';
  container.appendChild(grid);
}

/**
 * RECEPTURY – zatím localStorage
 */
function renderRecipes(container) {
  const materials = loadList(STORAGE_KEYS.rawMaterials);
  const intermediates = loadList(STORAGE_KEYS.intermediates);
  const recipes = loadList(STORAGE_KEYS.recipes);

  const grid = document.createElement('div');
  grid.className = 'form-grid';

  const formCard = createCard(
    labels.addRecipe,
    'Spojte polotovary a suroviny do finální receptury.'
  );
  if (!materials.length && !intermediates.length) {
    renderEmptyState(formCard, labels.emptyRecipes);
  } else {
    const options = [
      ...intermediates.map((i) => ({
        value: `intermediate:${i.id}`,
        label: `Polotovar • ${i.name}`,
        type: 'intermediate',
      })),
      ...materials.map((m) => ({
        value: `material:${m.id}`,
        label: `Surovina • ${m.name}`,
        type: 'material',
      })),
    ];

    const form = document.createElement('form');
    form.className = 'form-grid';
    form.innerHTML = `
      <label>Název receptury<input name="name" required placeholder="Fasádní barva akrylátová" /></label>
      <label>Odstín<input name="shade" placeholder="RAL 9010" /></label>
      <label>Lesk<input name="gloss" placeholder="mat / polomat / lesk" /></label>
      <label>Velikost dávky (kg)<input name="batchSize" type="number" min="1" step="1" placeholder="100" /></label>
      <label>Specifikace použití<textarea name="note" rows="2" placeholder="Exteriérový akrylát, vysoká odolnost UV."></textarea></label>
    `;

    const compositionWrap = document.createElement('div');
    compositionWrap.className = 'form-field';
    const header = document.createElement('div');
    header.className = 'flex-row';
    header.style.justifyContent = 'space-between';
    const label = document.createElement('label');
    label.textContent = 'Složení receptury';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Přidat položku';
    header.appendChild(label);
    header.appendChild(addBtn);
    compositionWrap.appendChild(header);

    const list = document.createElement('div');
    list.className = 'form-grid';
    compositionWrap.appendChild(list);

    function addRow(prefill = {}) {
      const row = document.createElement('div');
      row.className = 'composition-row';
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '2fr 1fr auto';
      row.style.gap = '0.5rem';

      const select = document.createElement('select');
      options.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (prefill.value && prefill.value === opt.value) o.selected = true;
        select.appendChild(o);
      });

      const amount = document.createElement('input');
      amount.type = 'number';
      amount.min = '0';
      amount.step = '0.1';
      amount.placeholder = 'Množství';
      if (prefill.amount) amount.value = prefill.amount;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger';
      remove.textContent = '✕';
      remove.addEventListener('click', () => row.remove());

      row.appendChild(select);
      row.appendChild(amount);
      row.appendChild(remove);
      list.appendChild(row);
    }

    addBtn.addEventListener('click', () => addRow());
    addRow();

    const actionRow = document.createElement('div');
    actionRow.className = 'form-actions';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Uložit recepturu';
    actionRow.appendChild(submitBtn);

    form.appendChild(compositionWrap);
    form.appendChild(actionRow);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const composition = Array.from(list.querySelectorAll('.composition-row'))
        .map((row) => ({
          value: row.querySelector('select')?.value,
          amount: parseFloat(row.querySelector('input')?.value) || 0,
        }))
        .filter((c) => c.value);

      if (!composition.length) {
        showToast('Přidejte alespoň jednu položku složení.', { type: 'error' });
        return;
      }

      const entry = {
        id: crypto.randomUUID(),
        name: fd.get('name'),
        shade: fd.get('shade'),
        gloss: fd.get('gloss'),
        batchSize: parseFloat(fd.get('batchSize')) || null,
        note: fd.get('note'),
        composition,
        createdAt: new Date().toISOString(),
      };

      saveList(STORAGE_KEYS.recipes, [...recipes, entry]);
      showToast('Receptura uložena.');
      renderRecipes(container);
    });

    formCard.appendChild(form);
  }
  grid.appendChild(formCard);

  const listCard = createCard('Receptury', 'Finální kombinace surovin a polotovarů.');
  if (!recipes.length) {
    renderEmptyState(listCard, 'Zatím nejsou evidovány žádné receptury.');
  } else {
    const list = document.createElement('div');
    list.className = 'list';

    recipes.forEach((rec) => {
      const block = document.createElement('div');
      block.className = 'list-row';

      const header = document.createElement('div');
      header.className = 'flex-row';
      header.style.justifyContent = 'space-between';
      header.innerHTML = `<div><div class="strong">${rec.name}</div><div class="muted">${rec.shade || ''}</div></div>`;
      const tags = document.createElement('div');
      tags.className = 'pill-row';
      if (rec.gloss) tags.appendChild(createPill(`Lesk ${rec.gloss}`));
      if (rec.batchSize) tags.appendChild(createPill(`Dávka ${rec.batchSize} kg`));
      header.appendChild(tags);
      block.appendChild(header);

      const compWrap = document.createElement('div');
      compWrap.className = 'muted';
      compWrap.textContent = `Složení: ${rec.composition.length} položek`;
      block.appendChild(compWrap);

      if (rec.note) {
        const note = document.createElement('div');
        note.className = 'muted';
        note.textContent = rec.note;
        block.appendChild(note);
      }

      const actions = document.createElement('div');
      actions.className = 'form-actions';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger';
      del.textContent = labels.delete;
      del.addEventListener('click', () => {
        const next = recipes.filter((item) => item.id !== rec.id);
        saveList(STORAGE_KEYS.recipes, next);
        showToast('Receptura odstraněna.');
        renderRecipes(container);
      });
      actions.appendChild(del);
      block.appendChild(actions);

      list.appendChild(block);
    });

    listCard.appendChild(list);
  }
  grid.appendChild(listCard);

  container.innerHTML = '';
  container.appendChild(grid);
}

/**
 * ZAKÁZKY – zatím localStorage
 */
function renderOrders(container) {
  const recipes = loadList(STORAGE_KEYS.recipes);
  const orders = loadList(STORAGE_KEYS.orders);

  const grid = document.createElement('div');
  grid.className = 'form-grid';

  const formCard = createCard(
    labels.addOrder,
    'Zadejte zakázku zákazníka a přiřaďte k ní konkrétní recepturu.'
  );
  if (!recipes.length) {
    renderEmptyState(formCard, 'Pro založení zakázky vytvořte nejdříve recepturu.');
  } else {
    const form = document.createElement('form');
    form.className = 'form-grid';
    form.innerHTML = `
      <label>Zákazník<input name="customer" required placeholder="Malířství Novák" /></label>
      <label>Kontaktní osoba<input name="contact" placeholder="jan.novak@example.com" /></label>
      <label>Receptura
        <select name="recipeId" required>
          ${recipes
            .map((r) => `<option value="${r.id}">${r.name}${r.shade ? ` — ${r.shade}` : ''}</option>`)
            .join('')}
        </select>
      </label>
      <label>Množství (kg)<input name="quantity" type="number" min="1" step="1" placeholder="250" /></label>
      <label>Termín výroby<input name="dueDate" type="date" /></label>
      <label>Poznámka k zakázce<textarea name="note" rows="2" placeholder="Dodat na stavbu v týdnu 32, balení 25 kg."></textarea></label>
    `;

    const actionRow = document.createElement('div');
    actionRow.className = 'form-actions';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Uložit zakázku';
    actionRow.appendChild(submitBtn);

    form.appendChild(actionRow);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);

      const entry = {
        id: crypto.randomUUID(),
        customer: fd.get('customer'),
        contact: fd.get('contact'),
        recipeId: fd.get('recipeId'),
        quantity: parseFloat(fd.get('quantity')) || null,
        dueDate: fd.get('dueDate'),
        status: 'Nová',
        note: fd.get('note'),
        createdAt: new Date().toISOString(),
      };

      saveList(STORAGE_KEYS.orders, [...orders, entry]);
      showToast('Zakázka uložena.');
      renderOrders(container);
    });

    formCard.appendChild(form);
  }
  grid.appendChild(formCard);

  const listCard = createCard('Zakázky', 'Rozpracované a dokončené zákaznické receptury.');
  if (!orders.length) {
    renderEmptyState(listCard, labels.emptyOrders);
  } else {
    const table = document.createElement('table');
    table.className = 'striped';
    const head = document.createElement('thead');
    head.innerHTML = `
      <tr>
        <th>Zákazník</th>
        <th>Receptura</th>
        <th>Množství</th>
        <th>Termín</th>
        <th>Stav</th>
        <th></th>
      </tr>
    `;
    table.appendChild(head);

    const tbody = document.createElement('tbody');

    orders.forEach((order) => {
      const recipe = recipes.find((r) => r.id === order.recipeId);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${order.customer}</td>
        <td>${recipe ? recipe.name : 'Receptura nenalezena'}</td>
        <td>${order.quantity ? `${order.quantity} kg` : '—'}</td>
        <td>${order.dueDate || '—'}</td>
        <td>${order.status}</td>
        <td class="form-actions"><button type="button" class="danger">${labels.delete}</button></td>
      `;
      row.querySelector('button')?.addEventListener('click', () => {
        const next = orders.filter((o) => o.id !== order.id);
        saveList(STORAGE_KEYS.orders, next);
        showToast('Zakázka odstraněna.');
        renderOrders(container);
      });
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    listCard.appendChild(table);
  }
  grid.appendChild(listCard);

  container.innerHTML = '';
  container.appendChild(grid);
}

/**
 * KPI + hlavní render
 */
function createBadgeRow(labelText, valueText) {
  const row = document.createElement('div');
  row.className = 'flex-row';
  row.style.justifyContent = 'space-between';

  const label = document.createElement('span');
  label.className = 'muted';
  label.textContent = labelText;

  const value = document.createElement('span');
  value.className = 'strong';
  value.textContent = valueText;

  row.appendChild(label);
  row.appendChild(value);
  return row;
}

function buildKpis(materials, intermediates, recipes, orders) {
  const wrap = document.createElement('div');
  wrap.className = 'dashboard-widgets';

  const kpiData = [
    { label: 'Suroviny', value: materials.length },
    { label: 'Polotovary', value: intermediates.length },
    { label: 'Receptury', value: recipes.length },
    { label: 'Zakázky', value: orders.length },
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
    value.textContent = kpi.value.toString();
    card.appendChild(value);

    wrap.appendChild(card);
  });

  return wrap;
}

function renderCrm(container, context = {}) {
  const materials = loadList(STORAGE_KEYS.rawMaterials);
  const intermediates = loadList(STORAGE_KEYS.intermediates);
  const recipes = loadList(STORAGE_KEYS.recipes);
  const orders = loadList(STORAGE_KEYS.orders);

  const wrap = document.createElement('div');
  wrap.className = 'dashboard';

  const title = document.createElement('h1');
  title.textContent = labels.title;
  wrap.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'muted';
  subtitle.textContent = labels.subtitle;
  wrap.appendChild(subtitle);

  const kpis = buildKpis(materials, intermediates, recipes, orders);
  wrap.appendChild(kpis);

  const nav = document.createElement('div');
  nav.className = 'tab-nav';
  const tabs = [
    { id: 'suroviny', label: labels.materials },
    { id: 'polotovary', label: labels.intermediates },
    { id: 'receptury', label: labels.recipes },
    { id: 'zakazky', label: labels.orders },
  ];
  let activeTab = 'suroviny';

  tabs.forEach((tab) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = tab.label;
    btn.dataset.tab = tab.id;
    btn.className = tab.id === activeTab ? 'tab active' : 'tab';
    btn.addEventListener('click', () => {
      activeTab = tab.id;
      nav.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === activeTab);
      });
      renderActiveTab();
    });
    nav.appendChild(btn);
  });

  wrap.appendChild(nav);

  const content = document.createElement('div');
  content.className = 'tab-content';

  function renderActiveTab() {
    if (activeTab === 'suroviny') renderMaterials(content);
    else if (activeTab === 'polotovary') renderIntermediates(content);
    else if (activeTab === 'receptury') renderRecipes(content);
    else if (activeTab === 'zakazky') renderOrders(content);
  }

  renderActiveTab();
  wrap.appendChild(content);

  container.innerHTML = '';
  container.appendChild(wrap);
}

export default {
  id: 'crm',
  meta: {
    iconClass: 'fa-solid fa-vial-circle-check',
    labels: { cs: labels.title },
    navItems: [
      { id: 'suroviny', labels: { cs: labels.materials } },
      { id: 'polotovary', labels: { cs: labels.intermediates } },
      { id: 'receptury', labels: { cs: labels.recipes } },
      { id: 'zakazky', labels: { cs: labels.orders } },
    ],
  },
  render: renderCrm,
};


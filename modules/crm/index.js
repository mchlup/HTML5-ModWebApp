import labels from './lang_cs.js';
import { showToast } from '../../core/uiService.js';

const STORAGE_KEYS = {
  rawMaterials: 'crm_raw_materials',
  intermediates: 'crm_intermediates',
  recipes: 'crm_recipes',
  orders: 'crm_orders',
};

function loadList(key) {
  try {
    const raw = localStorage.getItem(key);
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveList(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('Uložení do localStorage selhalo', err);
    return false;
  }
}

function createCard(titleText, description) {
  const card = document.createElement('div');
  card.className = 'card';
  if (titleText) {
    const title = document.createElement('h3');
    title.textContent = titleText;
    card.appendChild(title);
  }
  if (description) {
    const desc = document.createElement('p');
    desc.className = 'muted';
    desc.textContent = description;
    card.appendChild(desc);
  }
  return card;
}

function createBadge(text, tone = 'info') {
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.style.background = tone === 'success' ? '#065f46' : tone === 'danger' ? '#7f1d1d' : '#1f2937';
  badge.style.color = '#f8fafc';
  badge.textContent = text;
  return badge;
}

function createPill(text) {
  const pill = document.createElement('span');
  pill.className = 'pill';
  pill.textContent = text;
  return pill;
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
    card.className = 'card';
    card.innerHTML = `<div class="muted">${kpi.label}</div><div class="strong" style="font-size:2rem;">${kpi.value}</div>`;
    wrap.appendChild(card);
  });

  return wrap;
}

function renderEmptyState(card, message) {
  const empty = document.createElement('p');
  empty.className = 'muted';
  empty.textContent = message;
  card.appendChild(empty);
}

function renderMaterials(container) {
  const materials = loadList(STORAGE_KEYS.rawMaterials);

  const grid = document.createElement('div');
  grid.className = 'form-grid';

  const formCard = createCard(labels.addMaterial, 'Zadejte parametry suroviny a uložte je pro další použití.');
  const form = document.createElement('form');
  form.className = 'form-grid';
  form.innerHTML = `
    <label>Název suroviny<input name="name" required placeholder="Disperze akrylátu" /></label>
    <label>Kód/Dodací číslo<input name="code" required placeholder="ACR-245" /></label>
    <label>Dodavatel<input name="supplier" placeholder="ABC Pigments" /></label>
    <label>Cena / kg<input name="price" type="number" min="0" step="0.01" placeholder="120" /></label>
    <label>Hustota (g/cm³)<input name="density" type="number" min="0" step="0.01" placeholder="1.05" /></label>
    <label>VOC (g/l)<input name="voc" type="number" min="0" step="0.1" placeholder="15" /></label>
    <label>Nebezpečnost / SDS<input name="safety" placeholder="H315, H319" /></label>
    <label>Poznámka<textarea name="note" rows="2" placeholder="Stabilní do 25 °C, sklad ve stínu."></textarea></label>
    <div class="form-actions">
      <button type="submit">Uložit surovinu</button>
    </div>
  `;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const entry = {
      id: crypto.randomUUID(),
      name: fd.get('name'),
      code: fd.get('code'),
      supplier: fd.get('supplier'),
      price: parseFloat(fd.get('price')) || null,
      density: parseFloat(fd.get('density')) || null,
      voc: parseFloat(fd.get('voc')) || null,
      safety: fd.get('safety'),
      note: fd.get('note'),
      createdAt: new Date().toISOString(),
    };
    const next = [...materials, entry];
    saveList(STORAGE_KEYS.rawMaterials, next);
    showToast('Surovina uložena.');
    renderMaterials(container);
  });
  formCard.appendChild(form);
  grid.appendChild(formCard);

  const listCard = createCard('Evidence surovin', 'Přehled uložených surovin a jejich parametrů.');
  if (!materials.length) {
    renderEmptyState(listCard, labels.emptyMaterials);
  } else {
    const table = document.createElement('table');
    table.className = 'striped';
    const head = document.createElement('tr');
    head.innerHTML = '<th>Kód</th><th>Název</th><th>Dodavatel</th><th>Cena</th><th>Parametry</th><th></th>';
    table.appendChild(head);

    materials.forEach((m) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${m.code || '-'}</td>
        <td>${m.name}</td>
        <td>${m.supplier || '-'}</td>
        <td>${m.price ? `${m.price.toFixed(2)} Kč/kg` : '—'}</td>
        <td>
          <div class="pill">Hustota: ${m.density || '–'}</div>
          <div class="pill">VOC: ${m.voc || '–'} g/l</div>
          ${m.safety ? `<div class="pill warning">${m.safety}</div>` : ''}
        </td>
        <td class="form-actions">
          <button type="button" class="danger" data-id="${m.id}">${labels.delete}</button>
        </td>
      `;
      row.querySelector('button')?.addEventListener('click', () => {
        const next = materials.filter((item) => item.id !== m.id);
        saveList(STORAGE_KEYS.rawMaterials, next);
        showToast('Surovina odstraněna.');
        renderMaterials(container);
      });
      table.appendChild(row);
    });

    listCard.appendChild(table);
  }
  grid.appendChild(listCard);

  container.innerHTML = '';
  container.appendChild(grid);
}

function renderIntermediates(container) {
  const materials = loadList(STORAGE_KEYS.rawMaterials);
  const intermediates = loadList(STORAGE_KEYS.intermediates);

  const grid = document.createElement('div');
  grid.className = 'form-grid';

  const formCard = createCard(labels.addIntermediate, 'Vytvořte polotovary z již evidovaných surovin.');
  if (!materials.length) {
    renderEmptyState(formCard, labels.emptyIntermediates);
  } else {
    const form = document.createElement('form');
    form.className = 'form-grid';
    form.innerHTML = `
      <label>Název polotovaru<input name="name" required placeholder="Pigmentová pasta" /></label>
      <label>Kód / dávka<input name="code" placeholder="PIG-01" /></label>
      <label>Účel použití<input name="purpose" placeholder="Báze pro tónování" /></label>
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
      share.step = '0.1';
      share.placeholder = 'Podíl %';
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
        showToast('Přidejte alespoň jednu surovinu.', { type: 'error' });
        return;
      }

      const entry = {
        id: crypto.randomUUID(),
        name: fd.get('name'),
        code: fd.get('code'),
        purpose: fd.get('purpose'),
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
    renderEmptyState(listCard, 'Zatím nejsou žádné polotovary.');
  } else {
    intermediates.forEach((item) => {
      const block = document.createElement('div');
      block.className = 'list-row';

      const header = document.createElement('div');
      header.className = 'flex-row';
      header.style.justifyContent = 'space-between';
      header.innerHTML = `<div><div class="strong">${item.name}</div><div class="muted">${item.code || ''}</div></div>`;
      const tagRow = document.createElement('div');
      tagRow.className = 'pill-row';
      if (item.solids) tagRow.appendChild(createPill(`Sušina ${item.solids}%`));
      if (item.viscosity) tagRow.appendChild(createPill(`Viskozita ${item.viscosity} mPa·s`));
      if (item.purpose) tagRow.appendChild(createBadge(item.purpose));
      header.appendChild(tagRow);
      block.appendChild(header);

      const compList = document.createElement('div');
      compList.className = 'muted';
      compList.style.display = 'flex';
      compList.style.flexWrap = 'wrap';
      compList.style.gap = '0.5rem';
      item.composition.forEach((c) => {
        const mat = materials.find((m) => m.id === c.materialId);
        compList.appendChild(createPill(`${mat ? mat.name : 'Surovina'} (${c.share}%)`));
      });
      block.appendChild(compList);

      const actions = document.createElement('div');
      actions.className = 'form-actions';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger';
      del.textContent = labels.delete;
      del.addEventListener('click', () => {
        const next = intermediates.filter((entry) => entry.id !== item.id);
        saveList(STORAGE_KEYS.intermediates, next);
        showToast('Polotovar odstraněn.');
        renderIntermediates(container);
      });
      actions.appendChild(del);
      block.appendChild(actions);

      listCard.appendChild(block);
    });
  }
  grid.appendChild(listCard);

  container.innerHTML = '';
  container.appendChild(grid);
}

function renderRecipes(container) {
  const materials = loadList(STORAGE_KEYS.rawMaterials);
  const intermediates = loadList(STORAGE_KEYS.intermediates);
  const recipes = loadList(STORAGE_KEYS.recipes);

  const grid = document.createElement('div');
  grid.className = 'form-grid';

  const formCard = createCard(labels.addRecipe, 'Spojte polotovary a suroviny do finální receptury.');
  if (!materials.length && !intermediates.length) {
    renderEmptyState(formCard, labels.emptyRecipes);
  } else {
    const options = [
      ...intermediates.map((i) => ({ value: `intermediate:${i.id}`, label: `Polotovar • ${i.name}`, type: 'intermediate' })),
      ...materials.map((m) => ({ value: `material:${m.id}`, label: `Surovina • ${m.name}`, type: 'material' })),
    ];

    const form = document.createElement('form');
    form.className = 'form-grid';
    form.innerHTML = `
      <label>Název receptury<input name="name" required placeholder="Fasádní barva PREMIUM" /></label>
      <label>Odstín / kód<input name="shade" placeholder="RAL 9016" /></label>
      <label>Požadovaný lesk<input name="gloss" placeholder="20–30 GU" /></label>
      <label>Cílové množství (kg)<input name="batchSize" type="number" min="1" step="1" placeholder="100" /></label>
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

  const listCard = createCard('Receptury', 'Přehled finálních receptur určených pro zákazníky.');
  if (!recipes.length) {
    renderEmptyState(listCard, 'Zatím nejsou žádné receptury.');
  } else {
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
      compWrap.style.display = 'flex';
      compWrap.style.flexWrap = 'wrap';
      compWrap.style.gap = '0.5rem';

      rec.composition.forEach((c) => {
        const [type, id] = c.value.split(':');
        if (type === 'intermediate') {
          const match = intermediates.find((i) => i.id === id);
          compWrap.appendChild(createPill(`${match ? match.name : 'Polotovar'} (${c.amount} kg)`));
        } else {
          const mat = materials.find((m) => m.id === id);
          compWrap.appendChild(createPill(`${mat ? mat.name : 'Surovina'} (${c.amount} kg)`));
        }
      });
      block.appendChild(compWrap);

      if (rec.note) {
        const note = document.createElement('p');
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

      listCard.appendChild(block);
    });
  }
  grid.appendChild(listCard);

  container.innerHTML = '';
  container.appendChild(grid);
}

function renderOrders(container) {
  const recipes = loadList(STORAGE_KEYS.recipes);
  const orders = loadList(STORAGE_KEYS.orders);

  const grid = document.createElement('div');
  grid.className = 'form-grid';

  const formCard = createCard(labels.addOrder, 'Zadejte zakázku zákazníka a přiřaďte k ní konkrétní recepturu.');
  if (!recipes.length) {
    renderEmptyState(formCard, 'Pro založení zakázky vytvořte nejdříve recepturu.');
  } else {
    const form = document.createElement('form');
    form.className = 'form-grid';
    form.innerHTML = `
      <label>Zákazník<input name="customer" required placeholder="Malířství Novák" /></label>
      <label>Kontaktní osoba<input name="contact" placeholder="jan.novak@example.com" /></label>
      <label>Receptura<select name="recipe" required>${recipes
        .map((r) => `<option value="${r.id}">${r.name}</option>`) 
        .join('')}</select></label>
      <label>Požadované množství (kg)<input name="quantity" type="number" min="1" step="1" placeholder="500" /></label>
      <label>Termín výroby<input name="dueDate" type="date" /></label>
      <label>Stav zakázky<select name="status">
        <option value="nová">Nová</option>
        <option value="ve výrobě">Ve výrobě</option>
        <option value="expedováno">Expedováno</option>
      </select></label>
      <label>Poznámka<textarea name="note" rows="2" placeholder="Barvit dle RAL 7040, plnit do IBC."></textarea></label>
      <div class="form-actions"><button type="submit">Uložit zakázku</button></div>
    `;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const entry = {
        id: crypto.randomUUID(),
        customer: fd.get('customer'),
        contact: fd.get('contact'),
        recipeId: fd.get('recipe'),
        quantity: parseFloat(fd.get('quantity')) || null,
        dueDate: fd.get('dueDate'),
        status: fd.get('status') || 'nová',
        note: fd.get('note'),
        createdAt: new Date().toISOString(),
      };
      saveList(STORAGE_KEYS.orders, [...orders, entry]);
      showToast('Zakázka založena.');
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
    const head = document.createElement('tr');
    head.innerHTML = '<th>Zákazník</th><th>Receptura</th><th>Množství</th><th>Termín</th><th>Stav</th><th></th>';
    table.appendChild(head);

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
      table.appendChild(row);
    });

    listCard.appendChild(table);
  }
  grid.appendChild(listCard);

  container.innerHTML = '';
  container.appendChild(grid);
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

  wrap.appendChild(buildKpis(materials, intermediates, recipes, orders));

  const content = document.createElement('div');
  content.className = 'section-spacer';

  const subId = context.currentSubId || 'suroviny';
  if (subId === 'suroviny') renderMaterials(content);
  else if (subId === 'polotovary') renderIntermediates(content);
  else if (subId === 'receptury') renderRecipes(content);
  else if (subId === 'zakazky') renderOrders(content);

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

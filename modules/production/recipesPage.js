import { showToast } from '../../core/uiService.js';
import { createCard, createPill, loadList, renderEmptyState, saveList, STORAGE_KEYS } from './shared.js';

export function renderRecipes(container, { labels, onCountChange } = {}) {
  const materials = loadList(STORAGE_KEYS.rawMaterials);
  const intermediates = loadList(STORAGE_KEYS.intermediates);
  const recipes = loadList(STORAGE_KEYS.recipes);

  const grid = document.createElement('div');
  grid.className = 'form-grid production-grid';

  const formCard = createCard(
    labels.addRecipe,
    'Spojte polotovary a suroviny do finální receptury.'
  );
  if (!materials.length && !intermediates.length) {
    renderEmptyState(formCard, labels.emptyRecipes);
  } else {
    const options = [
      ...materials.map((m) => ({ id: m.id, label: `${m.code || m.name} — ${m.name}`, type: 'material' })),
      ...intermediates.map((i) => ({ id: i.id, label: `${i.code || i.name} — ${i.name}`, type: 'intermediate' })),
    ];

    const form = document.createElement('form');
    form.className = 'form-grid production-two-col';
    form.innerHTML = `
      <label>Název receptury<input name="name" required placeholder="Fasádní barva" /></label>
      <label>Odstín / kód<input name="shade" placeholder="RAL 9010" /></label>
      <label>Základ
        <select name="base">
          <option value="">(nezadán)</option>
          <option value="interior">Interiér</option>
          <option value="exterior">Exteriér</option>
        </select>
      </label>
      <label>Suchý zbytek (%)<input name="solids" type="number" min="0" max="100" step="0.1" placeholder="48" /></label>
      <label>VOC (g/l)<input name="voc" type="number" min="0" step="0.1" placeholder="30" /></label>
    `;

    const compositionWrap = document.createElement('div');
    compositionWrap.className = 'form-field composition-card';
    const header = document.createElement('div');
    header.className = 'flex-row';
    header.style.justifyContent = 'space-between';
    const label = document.createElement('label');
    label.textContent = 'Složení receptury';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Přidat komponentu';
    addBtn.className = 'production-btn production-btn-secondary production-btn-sm';
    header.appendChild(label);
    header.appendChild(addBtn);
    compositionWrap.appendChild(header);

    const list = document.createElement('div');
    list.className = 'form-grid composition-list';
    compositionWrap.appendChild(list);

    function addRow(prefill = {}) {
      const row = document.createElement('div');
      row.className = 'composition-row';
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '2fr 1fr auto';
      row.style.gap = '0.5rem';

      const select = document.createElement('select');
      options.forEach((o) => {
        const opt = document.createElement('option');
        opt.value = `${o.type}:${o.id}`;
        opt.textContent = o.label;
        if (prefill.component && prefill.component === opt.value) opt.selected = true;
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
      remove.className = 'danger production-btn production-btn-danger production-btn-sm';
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
    submitBtn.textContent = 'Uložit recepturu';
    submitBtn.classList.add('production-btn', 'production-btn-primary');
    actionRow.appendChild(submitBtn);

    form.appendChild(compositionWrap);
    form.appendChild(actionRow);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const composition = Array.from(list.querySelectorAll('.composition-row'))
        .map((row) => ({
          component: row.querySelector('select')?.value,
          share: parseFloat(row.querySelector('input')?.value) || 0,
        }))
        .filter((c) => c.component);

      if (!composition.length) {
        showToast('Přidejte alespoň jednu surovinu či polotovar.', { type: 'error' });
        return;
      }

      const totalShare = composition.reduce(
        (sum, c) => sum + (Number.isFinite(c.share) ? c.share : 0),
        0
      );
      if (totalShare <= 0) {
        showToast('Zadejte podíl alespoň u jedné složky receptury.', { type: 'error' });
        return;
      }

      const entry = {
        id: crypto.randomUUID(),
        name: fd.get('name'),
        shade: fd.get('shade'),
        base: fd.get('base'),
        solids: parseFloat(fd.get('solids')) || null,
        voc: parseFloat(fd.get('voc')) || null,
        composition,
        createdAt: new Date().toISOString(),
      };

      const next = [...recipes, entry];
      saveList(STORAGE_KEYS.recipes, next);
      if (typeof onCountChange === 'function') onCountChange(next.length);
      showToast('Receptura uložena.');
      renderRecipes(container, { labels, onCountChange });
    });

    formCard.appendChild(form);
  }
  grid.appendChild(formCard);

  const listCard = createCard(
    labels.recipesListTitle || 'Receptury',
    labels.recipesListSubtitle || 'Aktuální finální produkty a jejich složení.'
  );

  if (!recipes.length) {
    renderEmptyState(listCard, labels.emptyRecipes);
  } else {
    const list = document.createElement('div');
    list.className = 'list production-card-list';

    recipes.forEach((rec) => {
      const block = document.createElement('div');
      block.className = 'list-row production-row';

      const header = document.createElement('div');
      header.className = 'flex-row';
      header.style.justifyContent = 'space-between';
      header.innerHTML = `<div><div class="strong">${rec.name}</div><div class="muted">${rec.shade || ''}</div></div>`;
      const tags = document.createElement('div');
      tags.className = 'pill-row';
      if (rec.base === 'interior') tags.appendChild(createPill('Interiér'));
      if (rec.base === 'exterior') tags.appendChild(createPill('Exteriér'));
      if (rec.solids) tags.appendChild(createPill(`Sušina ${rec.solids}%`));
      if (rec.voc) tags.appendChild(createPill(`VOC ${rec.voc} g/l`));
      header.appendChild(tags);
      block.appendChild(header);

      if (rec.composition?.length) {
        const comp = document.createElement('div');
        comp.className = 'muted';
        comp.textContent = `${rec.composition.length} komponent`; 
        block.appendChild(comp);
      }

      const actions = document.createElement('div');
      actions.className = 'form-actions';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger production-btn production-btn-danger production-btn-sm';
      del.textContent = labels.delete;
      del.addEventListener('click', () => {
        const next = recipes.filter((item) => item.id !== rec.id);
        saveList(STORAGE_KEYS.recipes, next);
        if (typeof onCountChange === 'function') onCountChange(next.length);
        showToast('Receptura odstraněna.');
        renderRecipes(container, { labels, onCountChange });
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

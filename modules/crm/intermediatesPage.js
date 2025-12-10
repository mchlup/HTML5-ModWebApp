import { showToast } from '../../core/uiService.js';
import { createCard, createPill, loadList, renderEmptyState, saveList, STORAGE_KEYS } from './shared.js';

export function renderIntermediates(container, { labels, onCountChange } = {}) {
  const materials = loadList(STORAGE_KEYS.rawMaterials);
  const intermediates = loadList(STORAGE_KEYS.intermediates);

  const grid = document.createElement('div');
  grid.className = 'form-grid crm-grid';

  const formCard = createCard(
    labels.addIntermediate,
    labels.intermediatesIntro || 'Vytvořte polotovary z již evidovaných surovin.'
  );
  
  if (!materials.length) {
    const emptyText =
      labels.emptyIntermediates ||
      'Nejprve uložte alespoň jednu surovinu, aby bylo možné vytvářet polotovary.';
    renderEmptyState(formCard, emptyText);
  } else {
    const form = document.createElement('form');
    form.className = 'form-grid crm-two-col';
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
    compositionWrap.className = 'form-field composition-card';
    const header = document.createElement('div');
    header.className = 'flex-row';
    header.style.justifyContent = 'space-between';
    const label = document.createElement('label');
    label.textContent = 'Složení z evidovaných surovin';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Přidat surovinu';
    addBtn.className = 'crm-btn crm-btn-secondary crm-btn-sm';
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
      remove.className = 'danger crm-btn crm-btn-danger crm-btn-sm';
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
    submitBtn.classList.add('crm-btn', 'crm-btn-primary');
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

      const totalShare = composition.reduce(
        (sum, c) => sum + (Number.isFinite(c.share) ? c.share : 0),
        0
      );
      if (totalShare <= 0) {
        showToast('Zadejte podíl alespoň u jedné suroviny.', { type: 'error' });
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

      const nextList = [...intermediates, entry];
      saveList(STORAGE_KEYS.intermediates, nextList);
      if (typeof onCountChange === 'function') onCountChange(nextList.length);
      showToast('Polotovar uložen.');
      renderIntermediates(container, { labels, onCountChange });
    });

    formCard.appendChild(form);
  }
  grid.appendChild(formCard);

  // Přehled uložených polotovarů
  const listCard = createCard(
    labels.intermediatesListTitle || 'Přehled polotovarů',
    labels.intermediatesListSubtitle || 'Receptury, které využívají uložené suroviny.'
  );

  if (!intermediates.length) {
    const emptyText =
      labels.emptyIntermediates || 'Zatím nejsou evidovány žádné polotovary.';
    renderEmptyState(listCard, emptyText);
  } else {
    const list = document.createElement('div');
    list.className = 'list crm-card-list';

    intermediates.forEach((i) => {
      const block = document.createElement('div');
      block.className = 'list-row crm-row';

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
      del.className = 'danger crm-btn crm-btn-danger crm-btn-sm';
      del.textContent = labels.delete;
      del.addEventListener('click', () => {
        const next = intermediates.filter((item) => item.id !== i.id);
        saveList(STORAGE_KEYS.intermediates, next);
        if (typeof onCountChange === 'function') onCountChange(next.length);
        showToast('Polotovar odstraněn.');
        renderIntermediates(container, { labels, onCountChange });
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

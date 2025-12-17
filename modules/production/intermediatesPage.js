import { showToast } from '../../core/uiService.js';
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
} from './shared.js';

export function renderIntermediates(container, { labels, onCountChange } = {}) {
  const materials = loadList(STORAGE_KEYS.rawMaterials);
  const intermediates = loadList(STORAGE_KEYS.intermediates);

  // Pokud nejsou suroviny, nelze vytvořit polotovar
  if (!materials.length) {
    const card = createCard(labels.intermediates, labels.emptyIntermediates || 'Nejsou evidovány žádné suroviny.');
    card.appendChild(
      renderEmptyState(
        labels.emptyIntermediates ||
          'Nejdříve založte alespoň jednu surovinu, poté můžete vytvořit polotovary.'
      )
    );
    container.innerHTML = '';
    container.appendChild(card);
    return;
  }

  // --- List část (sjednocený toolbar) ---
  const listTpl = createStandardListCard({
    title: labels.intermediatesListTitle || labels.intermediates,
    subtitle:
      labels.intermediatesListSubtitle ||
      labels.intermediatesIntro ||
      'Vytvořte polotovary z již evidovaných surovin.',
    filterLabel: labels.filterIntermediates || 'Filtrovat polotovary',
    filterName: 'intermediatesFilter',
    filterPlaceholder: labels.filterIntermediatesPlaceholder || 'Hledat podle názvu nebo poznámky',
    addButtonText: labels.addIntermediate,
  });

  const {
    grid,
    listCard,
    filterInput,
    addBtn,
    tbody,
    thead,
    table,
    countLabel,
  } = listTpl;

  // Polotovary nejsou tabulkový výpis jako suroviny – použijeme vlastní blok listu
  // Tabulku v šabloně schováme.
  table.style.display = 'none';

  const listWrap = document.createElement('div');
  listWrap.className = 'intermediates-list';
  listCard.querySelector('.materials-results-block')?.appendChild(listWrap);

  const state = {
    term: '',
  };

  // --- Modal (sjednocená šablona) ---
  let modal = null;

  function buildFormCard() {
    const formCard = createCard(
      labels.addIntermediate,
      labels.intermediatesIntro || 'Vytvořte polotovary z již evidovaných surovin.'
    );

    const form = document.createElement('form');
    form.className = 'production-form';
    form.innerHTML = `
      <div class="form-grid two-col">
        <label>Název polotovaru<input name="name" required placeholder="Např. Bílá báze A" /></label>
        <label>Typ
          <select name="base">
            <option value="">—</option>
            <option value="water">Vodou ředitelný</option>
            <option value="solvent">Rozpouštědlový</option>
          </select>
        </label>
        <label>Hustota (g/cm³)<input name="density" type="number" step="0.01" placeholder="1.15" /></label>
        <label>Poznámka<textarea name="note" rows="2" placeholder="Např. skladovat do 25 °C"></textarea></label>
      </div>
    `;

    const compositionWrap = document.createElement('div');
    compositionWrap.className = 'materials-composition';
    const header = document.createElement('div');
    header.className = 'materials-composition-header';
    const label = document.createElement('span');
    label.className = 'muted';
    label.textContent = labels.composition || 'Složení z evidovaných surovin';

    const addRowBtn = document.createElement('button');
    addRowBtn.type = 'button';
    addRowBtn.textContent = labels.addMaterial || 'Přidat surovinu';
    addRowBtn.className = 'production-btn production-btn-secondary production-btn-sm';

    header.appendChild(label);
    header.appendChild(addRowBtn);
    compositionWrap.appendChild(header);

    const unitHint = document.createElement('div');
    unitHint.className = 'production-unit-hint';
    unitHint.textContent = 'Množství složek zadávejte v kilogramech (kg).';
    compositionWrap.appendChild(unitHint);

    const rowsWrap = document.createElement('div');
    rowsWrap.className = 'form-grid composition-list';
    compositionWrap.appendChild(rowsWrap);

    function addRow(prefill = {}) {
      const row = document.createElement('div');
      row.className = 'composition-row';

      const select = document.createElement('select');
      select.name = 'materialId';
      materials.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = String(m.id);
        opt.textContent = `${m.code || ''} ${m.name || ''}`.trim();
        select.appendChild(opt);
      });
      if (prefill.materialId != null) select.value = String(prefill.materialId);

      const qty = document.createElement('input');
      qty.type = 'number';
      qty.step = '0.01';
      qty.min = '0';
      qty.placeholder = 'kg';
      qty.value = prefill.quantity != null ? String(prefill.quantity) : '';

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger production-btn production-btn-danger production-btn-sm';
      del.textContent = labels.delete || 'Smazat';
      del.addEventListener('click', () => row.remove());

      row.appendChild(select);
      row.appendChild(qty);
      row.appendChild(del);
      rowsWrap.appendChild(row);
    }

    addRowBtn.addEventListener('click', () => addRow());
    addRow(); // vždy alespoň 1 řádek

    form.appendChild(compositionWrap);

    const actions = document.createElement('div');
    actions.className = 'form-actions';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'production-btn production-btn-primary';
    submitBtn.textContent = labels.saveIntermediate || 'Uložit polotovar';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'production-btn production-btn-secondary';
    closeBtn.textContent = labels.close || 'Zavřít';
    closeBtn.addEventListener('click', () => modal?.close());

    actions.appendChild(submitBtn);
    actions.appendChild(closeBtn);
    form.appendChild(actions);

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const fd = new FormData(form);
      const name = String(fd.get('name') || '').trim();
      if (!name) return;

      const base = String(fd.get('base') || '');
      const density = Number(fd.get('density') || 0) || null;
      const note = String(fd.get('note') || '').trim();

      const composition = [];
      rowsWrap.querySelectorAll('.composition-row').forEach((row) => {
        const s = row.querySelector('select');
        const q = row.querySelector('input[type="number"]');
        const materialId = s ? Number(s.value) : null;
        const quantity = q ? Number(q.value) : null;
        if (materialId && quantity && quantity > 0) {
          composition.push({ materialId, quantity });
        }
      });

      const next = [
        ...intermediates,
        {
          id: Date.now(),
          name,
          base,
          density,
          note,
          composition,
          createdAt: new Date().toISOString(),
        },
      ];
      saveList(STORAGE_KEYS.intermediates, next);
      if (typeof onCountChange === 'function') onCountChange(next.length);
      showToast('Polotovar uložen.');
      modal?.close();
      renderIntermediates(container, { labels, onCountChange });
    });

    formCard.appendChild(form);
    return formCard;
  }

  function openModal() {
    if (modal) {
      modal.open();
      return;
    }
    const formCard = buildFormCard();
    modal = createStandardModal({
      eyebrow: labels.newIntermediateEyebrow || 'Nový polotovar',
      title: labels.addIntermediate,
      subtitle: labels.intermediatesIntro || 'Vytvořte polotovary z již evidovaných surovin.',
      overlayClass: 'production-intermediates-modal-overlay',
      modalClass: 'production-intermediates-modal',
      bodyContent: formCard,
      onClose: () => {
        modal = null;
      },
    });
    modal.open();
  }

  addBtn.addEventListener('click', openModal);

  // --- Render list ---
  function matches(item) {
    const t = state.term;
    if (!t) return true;
    const hay = `${item.name || ''} ${item.note || ''}`.toLowerCase();
    return hay.includes(t);
  }

  function renderList() {
    listWrap.innerHTML = '';
    const filtered = intermediates.filter(matches);

    countLabel.textContent = `${filtered.length} položek`;

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = labels.emptyIntermediates || 'Žádné polotovary.';
      listWrap.appendChild(empty);
      return;
    }

    filtered.forEach((i) => {
      const block = document.createElement('div');
      block.className = 'materials-item';

      const title = document.createElement('div');
      title.className = 'materials-item-title';
      title.textContent = i.name || 'Polotovar';

      const tags = document.createElement('div');
      tags.className = 'materials-tags';
      if (i.base === 'water') tags.appendChild(createPill('Vodou ředitelný'));
      if (i.base === 'solvent') tags.appendChild(createPill('Rozpouštědlový'));
      if (i.density) tags.appendChild(createPill(`Hustota: ${i.density}`));

      const note = document.createElement('div');
      note.className = 'materials-note';
      note.textContent = i.note || '—';

      const actions = document.createElement('div');
      actions.className = 'materials-actions';

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger production-btn production-btn-danger production-btn-sm';
      del.textContent = labels.delete || 'Smazat';
      del.addEventListener('click', () => {
        const next = intermediates.filter((item) => item.id !== i.id);
        saveList(STORAGE_KEYS.intermediates, next);
        if (typeof onCountChange === 'function') onCountChange(next.length);
        showToast('Polotovar odstraněn.');
        renderIntermediates(container, { labels, onCountChange });
      });

      actions.appendChild(del);

      block.appendChild(title);
      block.appendChild(tags);
      block.appendChild(note);
      block.appendChild(actions);

      // Klik na blok -> detail polotovaru
      bindDetailModal(block, {
        item: i,
        eyebrow: 'DETAIL POLOTOVARU',
        title: i?.name || 'Polotovar',
        subtitle: i?.base === 'water' ? 'Vodou ředitelný' : i?.base === 'solvent' ? 'Rozpouštědlový' : '',
        overlayClass: 'production-detail-modal-overlay',
        modalClass: 'production-detail-modal',
        fields: [
          { label: 'Název', value: (x) => x?.name },
          {
            label: 'Typ',
            value: (x) =>
              x?.base === 'water'
                ? 'Vodou ředitelný'
                : x?.base === 'solvent'
                ? 'Rozpouštědlový'
                : null,
          },
          { label: 'Hustota (g/cm³)', value: (x) => x?.density },
          { label: 'Poznámka', value: (x) => x?.note },
          {
            label: 'Složení',
            value: (x) => {
              const comp = Array.isArray(x?.composition) ? x.composition : [];
              if (!comp.length) return '—';
              const ul = document.createElement('ul');
              ul.className = 'production-detail-ul';
              comp.forEach((c) => {
                const li = document.createElement('li');
                const m = materials.find((mm) => Number(mm.id) === Number(c.materialId));
                const qtyText = c.quantity != null ? ` – ${c.quantity} kg` : '';
                li.textContent = `${m?.name || 'Surovina'}${qtyText}`;
                ul.appendChild(li);
              });
              return ul;
            },
          },
        ],
      });

      listWrap.appendChild(block);
    });
  }

  filterInput.addEventListener('input', () => {
    state.term = String(filterInput.value || '').trim().toLowerCase();
    renderList();
  });

  container.innerHTML = '';
  container.appendChild(grid);

  renderList();
}

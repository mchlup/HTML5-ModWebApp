import { showToast } from '../../core/uiService.js';
import { apiJson } from '../../core/authService.js';
import {
  deleteUserColumns,
  loadUserColumns,
  saveUserColumns,
} from '../../core/columnViewService.js';
import {
  createStandardListCard,
  createStandardModal,
  buildDetailList,
  modulePath,
  loadList,
  saveList,
  STORAGE_KEYS,
  normalizeRecipeComposition,
  sumCompositionWeightKg,
  formatKg,
  resolveRecipeComponentLabel,
} from './shared.js';

// Cesty generujeme z import.meta.url, aby nebyl potřeba hardcode názvu modulu
const MATERIALS_API = modulePath('./api/materials.php', import.meta.url);
const RECIPES_API = modulePath('./api/recipes.php', import.meta.url);

const MODULE_CODE = 'production';
const VIEW_CODE = 'recipes';
const PAGE_SIZE = 20;

async function apiGet(url, options = {}) {
  return apiJson(url, { method: 'GET', ...options });
}

async function apiPost(url, payload) {
  return apiJson(url, {
    method: 'POST',
    body: payload,
  });
}

async function apiDelete(url) {
  return apiJson(url, {
    method: 'DELETE',
  });
}

export async function renderRecipes(container, { labels, onCountChange } = {}) {
  let recipes = [];
  let intermediates = loadList(STORAGE_KEYS.intermediates) || [];
  let materials = [];

  // --- Načtení surovin pro select ve složení -------------------------------

  async function loadMaterials() {
    try {
      const payload = await apiGet(
        `${MATERIALS_API}?action=list&page=1&pageSize=1000`,
      );
      const items =
        payload && (payload.items || payload.materials || payload.data);
      if (Array.isArray(items)) {
        materials = items;
        saveList(STORAGE_KEYS.rawMaterials, materials);
      } else {
        materials = loadList(STORAGE_KEYS.rawMaterials) || [];
      }
    } catch (err) {
      console.error('Chyba při načítání surovin pro receptury:', err);
      const fallback = loadList(STORAGE_KEYS.rawMaterials);
      if (Array.isArray(fallback) && fallback.length) {
        materials = fallback;
      } else {
        materials = [];
        showToast('Nepodařilo se načíst seznam surovin pro receptury.', {
          type: 'error',
        });
      }
    }
  }

  // --- Načtení receptur z databáze -----------------------------------------

  function mapRecipeRow(row) {
    if (!row || typeof row !== 'object') return null;
    const composition =
      Array.isArray(row.composition) && row.composition.length
        ? row.composition
        : null;

    const componentsCount =
      row.componentsCount != null
        ? Number(row.componentsCount)
        : row.components_count != null
        ? Number(row.components_count)
        : composition
        ? composition.length
        : 0;

    return {
      id:
        row.id != null
          ? row.id
          : row.recipe_id != null
          ? row.recipe_id
          : null,
      name: row.name || row.title || '',
      shade: row.shade || row.color || '',
      gloss: row.gloss || '',
      batchSize:
        row.batchSize != null
          ? Number(row.batchSize)
          : row.batch_size != null
          ? Number(row.batch_size)
          : null,
      note: row.note || '',
      componentsCount,
      composition,
      createdAt: row.createdAt || row.created_at || null,
      updatedAt: row.updatedAt || row.updated_at || null,
    };
  }

  async function loadRecipesFromDb() {
    try {
      const payload = await apiGet(`${RECIPES_API}?action=list`);
      const items =
        payload && (payload.items || payload.data || payload.recipes);
      if (payload && payload.success === false) {
        throw new Error(payload.message || 'Načtení receptur selhalo.');
      }
      if (Array.isArray(items)) {
        recipes = items
          .map(mapRecipeRow)
          .filter((r) => r && r.id != null);
        // cache do localStorage kvůli jiným částem modulu
        saveList(STORAGE_KEYS.recipes, recipes);
      } else {
        // fallback: co je v localStorage
        recipes = loadList(STORAGE_KEYS.recipes) || [];
      }
    } catch (err) {
      console.error('Chyba při načítání receptur z DB:', err);
      const fallback = loadList(STORAGE_KEYS.recipes);
      if (Array.isArray(fallback)) {
        recipes = fallback;
      } else {
        recipes = [];
      }
      showToast('Nepodařilo se načíst seznam receptur z databáze.', {
        type: 'error',
      });
    }
  }

  await Promise.all([loadMaterials(), loadRecipesFromDb()]);

  // --- UI skeleton sjednocený se Surovinami --------------------------------

  const canCreateRecipes =
    (materials && materials.length) || (intermediates && intermediates.length);

  const listTpl = createStandardListCard({
    title: labels.recipesListTitle || 'Receptury',
    subtitle:
      labels.recipesListSubtitle ||
      'Přehled receptur, které lze použít v zakázkách.',
    filterLabel: 'Filtrovat receptury',
    filterName: 'recipesFilter',
    filterPlaceholder: 'Hledat podle názvu, odstínu nebo poznámky',
    addButtonText: 'Přidat recepturu',
    addButtonDisabled: !canCreateRecipes,
  });

  const {
    grid,
    toolbar,
    filterInput,
    addBtn: addRecipeBtn,
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

  container.innerHTML = '';
  container.appendChild(grid);

  // --- Stav & sloupce ------------------------------------------------------

  let totalCount = Array.isArray(recipes) ? recipes.length : 0;
  let currentPage = 1;
  let currentSearchTerm = '';
  let sortBy = 'name';
  let sortDir = 'asc';

  // filterInput / columnSettingsBtn / countLabel / pageInfo / prevBtn / nextBtn dodává šablona

  let columns = normalizeColumns(getDefaultColumns());
  let columnModal = null;

  function getDefaultColumns() {
    return [
      {
        id: 'name',
        label: 'Název',
        sortable: true,
        defaultVisible: true,
        sortValue: (r) => (r.name || '').toString().toLowerCase(),
        render: (r) => r.name || '-',
      },
      {
        id: 'shade',
        label: 'Odstín / kód',
        sortable: true,
        defaultVisible: true,
        sortValue: (r) => (r.shade || '').toString().toLowerCase(),
        render: (r) => r.shade || '',
      },
      {
        id: 'gloss',
        label: 'Lesk',
        sortable: true,
        defaultVisible: true,
        sortValue: (r) => (r.gloss || '').toString().toLowerCase(),
        render: (r) => r.gloss || '',
      },
      {
        id: 'batchSize',
        label: 'Dávka (kg)',
        sortable: true,
        defaultVisible: true,
        sortValue: (r) => (r.batchSize != null && !Number.isNaN(r.batchSize) ? Number(r.batchSize) : -1),
        render: (r) => (r.batchSize != null && !Number.isNaN(r.batchSize) ? formatKg(r.batchSize, { decimals: 2 }) : ''),
        width: '10%',
      },
      {
        id: 'note',
        label: 'Poznámka',
        sortable: true,
        defaultVisible: true,
        sortValue: (r) => (r.note || '').toString().toLowerCase(),
        render: (r) => r.note || '',
        width: '20%',
      },
      {
        id: 'components',
        label: 'Komponenty',
        sortable: false,
        defaultVisible: true,
        render: (r) => {
          const count =
            r.componentsCount != null
              ? r.componentsCount
              : Array.isArray(r.composition)
              ? r.composition.length
              : 0;
          return count ? `${count} komponent` : '—';
        },
        width: '12%',
      },
      {
        id: 'actions',
        label: '',
        sortable: false,
        defaultVisible: true,
        required: true,
        width: '1%',
        cellClass: 'form-actions',
        render: (r) => renderActionsCell(r),
      },
    ];
  }

  function normalizeColumns(list) {
    return (list || []).map((col, index) => {
      const visible =
        col.visible !== undefined
          ? col.visible !== false
          : col.defaultVisible !== false;
      return {
        ...col,
        order: typeof col.order === 'number' ? col.order : index,
        visible: col.required ? true : visible,
      };
    });
  }

  function getVisibleColumns() {
    return columns
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .filter((c) => c.visible !== false);
  }

  function ensureSortColumn() {
    const current = columns.find(
      (c) => c.id === sortBy && c.sortable !== false,
    );
    if (current && current.visible !== false) return;
    const fallback = columns.find(
      (c) => c.visible !== false && c.sortable !== false,
    );
    if (fallback) {
      sortBy = fallback.id;
      sortDir = 'asc';
    }
  }

  function moveColumn(id, delta, list = columns) {
    const currentIndex = list.findIndex((c) => c.id === id);
    if (currentIndex < 0) return list;
    const targetIndex = currentIndex + delta;
    if (targetIndex < 0 || targetIndex >= list.length) return list;
    const updated = [...list];
    const [moved] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, moved);
    return updated.map((col, index) => ({ ...col, order: index }));
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
          th.classList.add(
            sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc',
          );
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
      tbody.innerHTML = `<tr><td colspan="${colCount}">${
        labels.emptyRecipes || 'Žádné receptury nejsou uložené.'
      }</td></tr>`;
      countLabel.textContent = '0 receptur';
      pageInfo.textContent = '';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    tbody.innerHTML = '';

    pageItems.forEach((recipe) => {
      const tr = document.createElement('tr');

      visibleColumns.forEach((col) => {
        const td = document.createElement('td');
        if (col.cellClass) td.className = col.cellClass;
        if (col.width) td.style.width = col.width;

        const content = col.render ? col.render(recipe) : recipe[col.id];
        if (content instanceof Node) {
          td.appendChild(content);
        } else {
          td.textContent =
            content != null && content !== '' ? String(content) : '—';
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);

      // Klik na řádek -> detail receptury (načítá se až při otevření, aby obsahoval i složení)
      const isInteractive = (target) => {
        if (!(target instanceof Element)) return false;
        return !!target.closest('button, a, input, select, textarea, label, [data-no-row-click], .form-actions, .materials-actions');
      };

      const openDetail = async () => {
        try {
          const detail = await apiGet(`${RECIPES_API}?id=${encodeURIComponent(String(recipe.id))}`);
          const item = detail && (detail.item || detail.data || detail.recipe);
          const full = item ? mapRecipeRow(item) : recipe;
          if (item && Array.isArray(item.composition)) {
            full.composition = item.composition;
            full.componentsCount = item.composition.length;
          }

          const comp = normalizeRecipeComposition(full);
          const totalKg = sumCompositionWeightKg(comp);

          const bodyContent = buildDetailList(
            [
              { label: 'Název', value: (r) => r?.name },
              { label: 'Odstín / kód', value: (r) => r?.shade },
              { label: 'Lesk', value: (r) => r?.gloss },
              {
                label: 'Dávka (kg)',
                value: (r) =>
                  r?.batchSize != null && !Number.isNaN(r.batchSize)
                    ? `${formatKg(r.batchSize, { decimals: 2 })} kg`
                    : '—',
              },
              { label: 'Počet složek', value: (r) => r?.componentsCount },
              {
                label: 'Celková hmotnost složení',
                value: () => (comp.length ? `${formatKg(totalKg)} kg` : '—'),
              },
              { label: 'Poznámka', value: (r) => r?.note },
              {
                label: 'Složení',
                value: () => {
                  if (!comp.length) return '—';
                  const wrap = document.createElement('div');
                  const ul = document.createElement('ul');
                  ul.className = 'production-detail-ul';
                  comp.forEach((c) => {
                    const li = document.createElement('li');
                    const name = resolveRecipeComponentLabel(c, {
                      rawMaterials: materials,
                      intermediates,
                    });
                    li.textContent = `${name} – ${formatKg(c.amount)} kg`;
                    ul.appendChild(li);
                  });
                  const total = document.createElement('div');
                  total.className = 'production-detail-total';
                  total.textContent = `Celkem: ${formatKg(totalKg)} kg`;
                  wrap.appendChild(ul);
                  wrap.appendChild(total);
                  return wrap;
                },
              },
            ],
            full,
          );

          const modal = createStandardModal({
            eyebrow: 'DETAIL RECEPTURY',
            title: full?.name || 'Receptura',
            subtitle: full?.shade ? `Odstín: ${full.shade}` : '',
            overlayClass: 'production-detail-modal-overlay',
            modalClass: 'production-detail-modal',
            bodyContent,
          });
          modal.open();
        } catch (err) {
          console.error(err);
          showToast('Nepodařilo se načíst detail receptury.', { type: 'error' });
        }
      };

      tr.addEventListener('click', (e) => {
        if (isInteractive(e.target)) return;
        openDetail();
      });

      tr.addEventListener('keydown', (e) => {
        if (isInteractive(e.target)) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail();
        }
      });
    });

    countLabel.textContent = `${total} receptur`;

    if (pageCount <= 1) {
      pageInfo.textContent = '';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
    } else {
      pageInfo.textContent = `Stránka ${currentPage} / ${pageCount}`;
      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= pageCount;
    }
  }

  function applyFilter() {
    const term = currentSearchTerm.trim().toLowerCase();
    let filtered = Array.isArray(recipes) ? [...recipes] : [];

    if (term) {
      filtered = filtered.filter((r) => {
        const haystack = [
          r.name,
          r.shade,
          r.gloss,
          r.note,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      });
    }

    const sortCol = columns.find((c) => c.id === sortBy);
    if (sortCol && sortCol.sortable !== false) {
      const sortFn =
        typeof sortCol.sortValue === 'function'
          ? sortCol.sortValue
          : (r) => (r[sortCol.id] != null ? r[sortCol.id] : '');
      filtered.sort((a, b) => {
        const va = sortFn(a);
        const vb = sortFn(b);
        if (va === vb) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        return sortDir === 'asc' ? 1 : -1;
      });
    }

    totalCount = filtered.length;
    const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    if (currentPage > pageCount) currentPage = pageCount;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    renderRows(pageItems, totalCount, pageCount);
  }

  // --- Modal pro nastavení sloupců -----------------------------------------

  function closeColumnModal() {
    if (columnModal && columnModal.parentNode) {
      columnModal.parentNode.removeChild(columnModal);
      columnModal = null;
      if (!document.querySelector('.modal-overlay')) {
        document.body.classList.remove('modal-open');
      }
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
      showToast(err.message || 'Obnovení sloupců selhalo.', {
        type: 'error',
      });
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
      showToast(err.message || 'Uložení nastavení sloupců selhalo.', {
        type: 'error',
      });
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
    intro.textContent =
      'Vyberte, které sloupce chcete zobrazit, a upravte jejich pořadí.';
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
          if (col.required) return;
          col.visible = checkbox.checked;
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
        upBtn.className =
          'production-btn production-btn-secondary production-btn-sm';
        upBtn.textContent = '▲';
        upBtn.disabled = index === 0;
        upBtn.addEventListener('click', () => {
          draftColumns = moveColumn(col.id, -1, draftColumns);
          renderList();
        });

        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className =
          'production-btn production-btn-secondary production-btn-sm';
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
    modal.appendChild(list);

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'form-actions column-config-actions-footer';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className =
      'production-btn production-btn-secondary production-btn-sm';
    resetBtn.textContent = 'Obnovit výchozí';
    resetBtn.addEventListener('click', handleResetColumns);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'production-btn production-btn-primary';
    saveBtn.textContent = 'Uložit nastavení';
    saveBtn.addEventListener('click', () =>
      handleSaveColumns(draftColumns),
    );

    actionsWrap.appendChild(resetBtn);
    actionsWrap.appendChild(saveBtn);
    modal.appendChild(actionsWrap);

    document.body.appendChild(columnModal);
    document.body.classList.add('modal-open');
  }

  async function loadColumnsConfig() {
    const loaded = await loadUserColumns(
      MODULE_CODE,
      VIEW_CODE,
      getDefaultColumns(),
    );
    columns = normalizeColumns(loaded);
    renderTableHead();
  }

  // --- Akce v tabulce (DB delete + refresh) --------------------------------

  function renderActionsCell(recipe) {
    const wrap = document.createElement('div');
    wrap.className = 'materials-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className =
      'secondary production-btn production-btn-secondary production-btn-sm';
    editBtn.textContent = 'Upravit';
    editBtn.addEventListener('click', async () => {
      // pokusit se načíst detail receptury včetně skladby z API
      try {
        const detail = await apiGet(
          `${RECIPES_API}?id=${encodeURIComponent(recipe.id)}`,
        );
        const item =
          detail && (detail.item || detail.data || detail.recipe);

        if (item) {
          const full = mapRecipeRow(item);

          if (full) {
            if (Array.isArray(item.composition)) {
              full.composition = item.composition;
              full.componentsCount =
                typeof item.componentsCount === 'number'
                  ? item.componentsCount
                  : item.composition.length;
            }

            openRecipeModal(full);
            return;
          }
        }
      } catch (err) {
        console.error('Chyba při načítání detailu receptury:', err);
        showToast(
          'Nepodařilo se načíst detail receptury, zobrazím lokální data.',
          { type: 'error' },
        );
      }

      // fallback – kdyby API selhalo, aspoň otevřít to, co máme v seznamu
      openRecipeModal(recipe);
    });
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className =
      'danger production-btn production-btn-danger production-btn-sm';
    delBtn.textContent = labels.delete || 'Smazat';
    delBtn.addEventListener('click', async () => {
      if (!confirm('Opravdu odstranit tuto recepturu?')) return;
      try {
        const resp = await apiDelete(
          `${RECIPES_API}?id=${encodeURIComponent(recipe.id)}`,
        );
        if (resp && resp.success === false) {
          throw new Error(resp.message || 'Smazání receptury selhalo.');
        }
        recipes = recipes.filter((r) => r.id !== recipe.id);
        saveList(STORAGE_KEYS.recipes, recipes);
        if (typeof onCountChange === 'function') {
          onCountChange(recipes.length);
        }
        showToast('Receptura smazána.');
        applyFilter();
      } catch (err) {
        console.error('Chyba při mazání receptury:', err);
        showToast(
          err.message || 'Smazání receptury se nezdařilo.',
          { type: 'error' },
        );
      }
    });

    wrap.appendChild(editBtn);
    wrap.appendChild(delBtn);
    return wrap;
  }

  // --- Modal pro vytvoření / úpravu receptury (DB POST) --------------------

  function openRecipeModal(existing = null) {
    const isEdit = !!existing;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay materials-modal-overlay';
    overlay.style.background = 'rgba(15, 23, 42, 0.55)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.zIndex = '1100';

    const modal = document.createElement('div');
    modal.className = 'modal-dialog materials-modal';
    modal.style.background = '#ffffff';
    modal.style.borderRadius = '18px';
    modal.style.boxShadow = '0 22px 60px rgba(15, 23, 42, 0.45)';
    modal.style.maxWidth = '760px';
    modal.style.width = '100%';
    modal.style.padding = '1.75rem 2rem';

    overlay.appendChild(modal);

    const header = document.createElement('div');
    header.className = 'materials-modal-header flex-row';
    header.style.justifyContent = 'space-between';

    const titleWrap = document.createElement('div');
    titleWrap.innerHTML = `
      <p class="modal-eyebrow">${isEdit ? 'Úprava receptury' : 'Nová receptura'}</p>
      <h3>${labels.addRecipe}</h3>
      <p class="materials-modal-subtitle">${
        labels.recipesIntro ||
        'Spojte polotovary a suroviny do finální receptury.'
      }</p>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '&times;';

    header.appendChild(titleWrap);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'materials-modal-body';

    const card = document.createElement('div');
    card.className = 'materials-modal-card';

    const form = document.createElement('form');
    form.className = 'form-grid production-two-col';
    form.innerHTML = `
      <label>Název receptury<input name="name" required placeholder="Fasádní barva" /></label>
      <label>Odstín / kód<input name="shade" placeholder="RAL 9010" /></label>
      <label>Lesk<input name="gloss" placeholder="Mat / Polomat / Lesk" /></label>
      <label>Dávka (kg)<input name="batchSize" type="number" min="0" step="0.01" placeholder="100" /></label>
      <label class="production-field-full">Poznámka<textarea name="note" rows="2" placeholder="Specifikace, požadavky zákazníka, ..."></textarea></label>
    `;

    if (isEdit && existing) {
      form.elements.namedItem('name').value = existing.name || '';
      form.elements.namedItem('shade').value = existing.shade || '';
      form.elements.namedItem('gloss').value = existing.gloss || '';
      form.elements.namedItem('note').value = existing.note || '';
      if (existing.batchSize != null && !Number.isNaN(existing.batchSize)) {
        form.elements.namedItem('batchSize').value = existing.batchSize;
      }
    }

    const options = [
      ...(Array.isArray(materials)
        ? materials.map((m) => ({
            id: m.id,
            label: `${m.code || m.name} — ${m.name}`,
            type: 'material',
          }))
        : []),
      ...(Array.isArray(intermediates)
        ? intermediates.map((i) => ({
            id: i.id,
            label: `${i.code || i.name} — ${i.name}`,
            type: 'intermediate',
          }))
        : []),
    ];

    const compositionWrap = document.createElement('div');
    compositionWrap.className = 'form-field composition-card';
    const compHeader = document.createElement('div');
    compHeader.className = 'flex-row';
    compHeader.style.justifyContent = 'space-between';
    const compLabel = document.createElement('label');
    compLabel.textContent = 'Složení receptury';

    const unitHint = document.createElement('div');
    unitHint.className = 'production-unit-hint';
    unitHint.textContent = 'Množství složek zadávejte v kilogramech (kg).';
    const addComponentBtn = document.createElement('button');
    addComponentBtn.type = 'button';
    addComponentBtn.textContent = 'Přidat surovinu';
    addComponentBtn.className =
      'production-btn production-btn-secondary production-btn-sm';
    compHeader.appendChild(compLabel);
    compHeader.appendChild(addComponentBtn);
    compositionWrap.appendChild(compHeader);
    compositionWrap.appendChild(unitHint);
    compositionWrap.appendChild(unitHint);

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
        if (prefill.component && prefill.component === opt.value) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });

      const amount = document.createElement('input');
      amount.type = 'number';
      amount.min = '0';
      amount.step = '0.01';
      amount.placeholder = 'kg';
      amount.title = 'Množství v kg';
      if (prefill.amount != null) amount.value = prefill.amount;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className =
        'danger production-btn production-btn-danger production-btn-sm';
      remove.textContent = '✕';
      remove.addEventListener('click', () => row.remove());

      row.appendChild(select);
      row.appendChild(amount);
      row.appendChild(remove);
      list.appendChild(row);
    }

    if (
      isEdit &&
      existing &&
      Array.isArray(existing.composition) &&
      existing.composition.length
    ) {
      existing.composition.forEach((c) => {
        const value =
          c.component ||
          (c.componentType && c.componentId
            ? `${c.componentType}:${c.componentId}`
            : '');
        addRow({ component: value, amount: c.amount });
      });
    } else {
      addRow();
    }

    addComponentBtn.addEventListener('click', () => addRow());

    const actionRow = document.createElement('div');
    actionRow.className = 'form-actions';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = isEdit ? 'Uložit změny' : 'Uložit recepturu';
    submitBtn.classList.add('production-btn', 'production-btn-primary');
    actionRow.appendChild(submitBtn);

    form.appendChild(compositionWrap);
    form.appendChild(actionRow);

    const handleClose = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (!document.querySelector('.modal-overlay')) {
        document.body.classList.remove('modal-open');
      }
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const composition = Array.from(
        list.querySelectorAll('.composition-row'),
      )
        .map((row) => {
          const select = row.querySelector('select');
          const value = select ? select.value : '';
          const [componentType, componentId] = value.split(':');
          const amountInput = row.querySelector('input');
          const amountValue = amountInput
            ? parseFloat(amountInput.value) || 0
            : 0;
          return {
            componentType: componentType || null,
            componentId:
              componentId != null && componentId !== ''
                ? parseInt(componentId, 10)
                : null,
            amount: amountValue,
          };
        })
        .filter(
          (c) =>
            c.componentType &&
            c.componentId &&
            !Number.isNaN(c.componentId) &&
            c.amount > 0,
        );

      if (!composition.length) {
        showToast('Přidejte alespoň jednu surovinu s nenulovým množstvím.', {
          type: 'error',
        });
        return;
      }

      const payload = {
        id: isEdit && existing ? existing.id : null,
        name: fd.get('name'),
        shade: fd.get('shade') || null,
        gloss: fd.get('gloss') || null,
        note: fd.get('note') || null,
        batchSize:
          fd.get('batchSize') !== null && fd.get('batchSize') !== ''
            ? parseFloat(fd.get('batchSize'))
            : null,
        composition,
      };

      try {
        const resp = await apiPost(RECIPES_API, payload);
        if (!resp || resp.success === false) {
          throw new Error(
            (resp && resp.message) || 'Uložení receptury se nezdařilo.',
          );
        }

        const item = resp.item || resp.data || null;
        let entry;
        if (item) {
          entry = mapRecipeRow(item);
          if (!entry.composition) {
            entry.composition = composition;
          }
        } else {
          entry = {
            id:
              isEdit && existing
                ? existing.id
                : Date.now(), // fallback
            name: payload.name,
            shade: payload.shade || '',
            gloss: payload.gloss || '',
            batchSize: payload.batchSize,
            note: payload.note || '',
            composition,
            componentsCount: composition.length,
            createdAt: existing && existing.createdAt
              ? existing.createdAt
              : null,
            updatedAt: null,
          };
        }

        const idx = recipes.findIndex((r) => r.id === entry.id);
        if (idx === -1) {
          recipes = [...recipes, entry];
        } else {
          const copy = [...recipes];
          copy[idx] = entry;
          recipes = copy;
        }

        saveList(STORAGE_KEYS.recipes, recipes);
        if (typeof onCountChange === 'function') {
          onCountChange(recipes.length);
        }
        showToast(isEdit ? 'Receptura upravena.' : 'Receptura uložena.');
        handleClose();
        applyFilter();
      } catch (err) {
        console.error('Chyba při ukládání receptury:', err);
        showToast(
          err.message || 'Uložení receptury se nezdařilo.',
          { type: 'error' },
        );
      }
    });

    closeBtn.addEventListener('click', handleClose);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        handleClose();
      }
    });

    card.appendChild(form);
    body.appendChild(card);
    modal.appendChild(header);
    modal.appendChild(body);

    document.body.appendChild(overlay);
    if (!document.body.classList.contains('modal-open')) {
      document.body.classList.add('modal-open');
    }
  }

  // --- Handlery toolbaru, stránkování, sloupců -----------------------------

  if (filterInput) {
    filterInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value || '';
      currentPage = 1;
      applyFilter();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        applyFilter();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      if (currentPage < maxPage) {
        currentPage += 1;
        applyFilter();
      }
    });
  }

  if (columnSettingsBtn) {
    columnSettingsBtn.addEventListener('click', openColumnsModal);
  }

  addRecipeBtn.addEventListener('click', () => {
    if (!canCreateRecipes) {
      showToast(
        'Pro vytvoření receptury je potřeba nejprve přidat suroviny či polotovary.',
        {
          type: 'warning',
        },
      );
      return;
    }
    openRecipeModal();
  });

  await loadColumnsConfig();
  applyFilter();

  if (typeof onCountChange === 'function') {
    onCountChange(recipes.length || 0);
  }
}


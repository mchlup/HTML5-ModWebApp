import labels from './lang_cs.js';
import { registerModule } from '../../core/moduleRegistry.js';
import { apiJson } from '../../core/authService.js';

// -------------------------------
// Načtení CSS stylů modulu suppliers
// -------------------------------
let suppliersStylesLoaded = false;

function ensuresuppliersStylesLoaded() {
  if (suppliersStylesLoaded) return;
  suppliersStylesLoaded = true;

  // Stejný princip jako v production:
  const href = new URL('./styles.css', import.meta.url).pathname;

  const existing = document.querySelector(
    `link[data-suppliers-styles="true"][href="${href}"]`
  );
  if (existing) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.suppliersStyles = 'true';
  document.head.appendChild(link);
}

const SUPPLIERS_API = './modules/suppliers/api/suppliers.php';
const PAGE_SIZE = 10;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function createCard(title, text) {
  const card = el('div', 'card');
  if (title) {
    const h = el('h3');
    h.textContent = title;
    card.appendChild(h);
  }
  if (text) {
    const p = el('p', 'muted', text);
    card.appendChild(p);
  }
  return card;
}

function renderSuppliersModule(container) {
  ensuresuppliersStylesLoaded();

  const state = {
    suppliers: [],
    editingId: null,
    isSaving: false,
    isLoading: false,
    page: 1,
    pageSize: PAGE_SIZE,
    sortField: 'name',
    sortDirection: 'asc',
  };

  // --------------------------------------------------------
  // ZÁKLADNÍ STRUKTURA STRÁNKY
  // --------------------------------------------------------

  const page = el('div', 'suppliers-page');

  const header = el('div', 'suppliers-header');
  const title = el('h1', null, labels.title);
  const subtitle = el('p', 'muted', labels.subtitle);
  header.appendChild(title);
  header.appendChild(subtitle);
  page.appendChild(header);

  const intro = el('p', null, labels.intro);
  page.appendChild(intro);

  const layout = el('div', 'form-grid suppliers-layout');
  page.appendChild(layout);

  // --------------------------------------------------------
  // SEZNAM DODAVATELŮ + TOOLBAR
  // --------------------------------------------------------

  const listCard = createCard(labels.listTitle, labels.listHelp);
  listCard.classList.add('suppliers-list-card');

  // stejné základní rozložení toolbaru jako u Surovin – využijeme společnou .table-toolbar
  const toolbar = el('div', 'table-toolbar suppliers-toolbar');

  const refreshBtn = el(
    'button',
    'suppliers-btn suppliers-btn-secondary suppliers-btn-sm',
    labels.refreshButton
  );

  const searchInput = el('input', 'suppliers-search');
  searchInput.type = 'search';
  searchInput.placeholder = labels.searchPlaceholder;

  const addBtn = el(
    'button',
    'suppliers-btn suppliers-btn-primary suppliers-btn-sm',
    labels.addButton
  );

  toolbar.appendChild(refreshBtn);
  toolbar.appendChild(searchInput);
  toolbar.appendChild(addBtn);
  listCard.appendChild(toolbar);

  const listError = el('div', 'alert alert-error hidden');
  listCard.appendChild(listError);

  // “Tabulka” ve stejném duchu jako production – grid, ne <table>
  const table = el('div', 'suppliers-table');

  const columns = [
    { key: 'name', label: labels.colName, sortable: true },
    { key: 'code', label: labels.colCode, sortable: true },
    { key: 'contact_person', label: labels.colContactPerson, sortable: true },
    { key: 'email', label: labels.colEmail, sortable: false },
    { key: 'phone', label: labels.colPhone, sortable: false },
    { key: 'website', label: labels.colWebsite, sortable: false },
    { key: 'note', label: labels.colNote, sortable: false },
    { key: 'actions', label: labels.colActions, sortable: false },
  ];

  const headerRow = el('div', 'suppliers-row suppliers-header-row');

  columns.forEach((col) => {
    const cell = el(
      'div',
      'suppliers-cell suppliers-header-cell',
      col.label
    );

    if (col.sortable) {
      cell.classList.add('sortable');
      cell.dataset.sortKey = col.key;
      const sortIcon = el('span', 'sort-icon', '');
      cell.appendChild(sortIcon);
    }

    headerRow.appendChild(cell);
  });

  table.appendChild(headerRow);

  const tbody = el('div', 'suppliers-body');
  table.appendChild(tbody);

  // stejné obalení tabulky jako u Surovin – table-scroll + results-block
  const tableWrapper = el('div', 'table-scroll');
  tableWrapper.appendChild(table);

  const resultsBlock = el('div', 'suppliers-results-block');
  resultsBlock.appendChild(tableWrapper);

  const emptyInfo = el('p', 'muted', labels.emptyListInfo);
  emptyInfo.style.display = 'none';

  listCard.appendChild(resultsBlock);
  listCard.appendChild(emptyInfo);

  // stránkování
  const pagination = el('div', 'suppliers-pagination');
  const paginationInfo = el('div', 'suppliers-pagination-info');
  const paginationButtons = el('div', 'suppliers-pagination-buttons');

  const prevBtn = el(
    'button',
    'suppliers-btn suppliers-btn-secondary suppliers-btn-sm',
    labels.paginationPrev
  );
  const nextBtn = el(
    'button',
    'suppliers-btn suppliers-btn-secondary suppliers-btn-sm',
    labels.paginationNext
  );

  paginationButtons.appendChild(prevBtn);
  paginationButtons.appendChild(nextBtn);
  pagination.appendChild(paginationInfo);
  pagination.appendChild(paginationButtons);
  listCard.appendChild(pagination);

  layout.appendChild(listCard);

  // --------------------------------------------------------
  // MODÁLNÍ OKNO – FORMULÁŘ
  // --------------------------------------------------------

  const modalBackdrop = el('div', 'suppliers-modal-backdrop hidden');
  const modal = el('div', 'suppliers-modal');
  modalBackdrop.appendChild(modal);

  const modalHeader = el('div', 'suppliers-modal-header');
  const modalTitle = el('h3', null, labels.formTitleNew);
  const modalCloseBtn = el('button', 'suppliers-modal-close', '×');
  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(modalCloseBtn);
  modal.appendChild(modalHeader);

  const formCard = createCard(null, labels.formHelp);
  formCard.classList.add('suppliers-form-card');
  modal.appendChild(formCard);

  const form = el('form', 'suppliers-form');
  form.noValidate = true;

  const formError = el('div', 'alert alert-error hidden');
  form.appendChild(formError);

  function formRow(labelText, inputEl) {
    const row = el('div', 'suppliers-form-row');
    const labelEl = el('label', null, labelText);
    row.appendChild(labelEl);
    inputEl.classList.add('suppliers-input');
    row.appendChild(inputEl);
    return row;
  }

  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.placeholder = labels.namePlaceholder;

  const codeInput = el('input');
  codeInput.type = 'text';
  codeInput.placeholder = labels.codePlaceholder;

  const contactPersonInput = el('input');
  contactPersonInput.type = 'text';
  contactPersonInput.placeholder = labels.contactPersonPlaceholder;

  const emailInput = el('input');
  emailInput.type = 'email';
  emailInput.placeholder = labels.emailPlaceholder;

  const phoneInput = el('input');
  phoneInput.type = 'text';
  phoneInput.placeholder = labels.phonePlaceholder;

  const websiteInput = el('input');
  websiteInput.type = 'text';
  websiteInput.placeholder = labels.websitePlaceholder;

  const noteInput = el('textarea');
  noteInput.rows = 3;
  noteInput.placeholder = labels.notePlaceholder;

  form.appendChild(formRow(labels.nameLabel, nameInput));
  form.appendChild(formRow(labels.codeLabel, codeInput));
  form.appendChild(formRow(labels.contactPersonLabel, contactPersonInput));
  form.appendChild(formRow(labels.emailLabel, emailInput));
  form.appendChild(formRow(labels.phoneLabel, phoneInput));
  form.appendChild(formRow(labels.websiteLabel, websiteInput));
  form.appendChild(formRow(labels.noteLabel, noteInput));

  const formActions = el('div', 'form-actions');
  const saveBtn = el(
    'button',
    'suppliers-btn suppliers-btn-primary',
    labels.saveButton
  );
  saveBtn.type = 'submit';
  const cancelBtn = el(
    'button',
    'suppliers-btn suppliers-btn-secondary',
    labels.cancelButton
  );
  cancelBtn.type = 'button';

  formActions.appendChild(saveBtn);
  formActions.appendChild(cancelBtn);
  form.appendChild(formActions);

  formCard.appendChild(form);
  page.appendChild(modalBackdrop);

  // --------------------------------------------------------
  // POMOCNÉ FUNKCE – UI
  // --------------------------------------------------------

  function openModalForCreate() {
    state.editingId = null;
    setFormError('');
    modalTitle.textContent = labels.formTitleNew;
    nameInput.value = '';
    codeInput.value = '';
    contactPersonInput.value = '';
    emailInput.value = '';
    phoneInput.value = '';
    websiteInput.value = '';
    noteInput.value = '';
    modalBackdrop.classList.remove('hidden');
    nameInput.focus();
  }

  function openModalForEdit(s) {
    state.editingId = s.id;
    setFormError('');
    modalTitle.textContent = labels.formTitleEdit;
    nameInput.value = s.name || '';
    codeInput.value = s.code || '';
    contactPersonInput.value = s.contact_person || '';
    emailInput.value = s.email || '';
    phoneInput.value = s.phone || '';
    websiteInput.value = s.website || '';
    noteInput.value = s.note || '';
    modalBackdrop.classList.remove('hidden');
    nameInput.focus();
  }

  function closeModal() {
    modalBackdrop.classList.add('hidden');
  }

  function setFormError(message) {
    if (!message) {
      formError.textContent = '';
      formError.classList.add('hidden');
    } else {
      formError.textContent = message;
      formError.classList.remove('hidden');
    }
  }

  function setListError(message) {
    if (!message) {
      listError.textContent = '';
      listError.classList.add('hidden');
    } else {
      listError.textContent = message;
      listError.classList.remove('hidden');
    }
  }

  function setLoading(loading) {
    state.isLoading = loading;
    if (loading) {
      listCard.classList.add('is-loading');
    } else {
      listCard.classList.remove('is-loading');
    }
  }

  function getFilteredSuppliers() {
    const q = (searchInput.value || '').toLowerCase().trim();
    let items = state.suppliers;
    if (q) {
      items = items.filter((s) =>
        [
          s.name,
          s.code,
          s.contact_person,
          s.email,
          s.phone,
          s.website,
          s.note,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    if (state.sortField) {
      const field = state.sortField;
      const dir = state.sortDirection === 'desc' ? -1 : 1;
      items = [...items].sort((a, b) => {
        const av = (a[field] ?? '').toString().toLowerCase();
        const bv = (b[field] ?? '').toString().toLowerCase();
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }

    return items;
  }

  function updatePaginationInfo(total) {
    if (!total) {
      paginationInfo.textContent = '';
    } else {
      const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
      if (state.page > pageCount) state.page = pageCount;

      const from = (state.page - 1) * state.pageSize + 1;
      const to = Math.min(total, state.page * state.pageSize);

      paginationInfo.textContent = `${from}–${to} z ${total} (${labels.paginationPageLabel} ${state.page}/${pageCount})`;

      prevBtn.disabled = state.page <= 1;
      nextBtn.disabled = state.page >= pageCount;
    }
  }

  function renderTableBody() {
    tbody.innerHTML = '';
    const allItems = getFilteredSuppliers();
    const total = allItems.length;

    if (!total) {
      emptyInfo.style.display = 'block';
      updatePaginationInfo(0);
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }
    emptyInfo.style.display = 'none';

    const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pageCount) state.page = pageCount;

    const start = (state.page - 1) * state.pageSize;
    const items = allItems.slice(start, start + state.pageSize);

    items.forEach((s) => {
      const row = el('div', 'suppliers-row');

      row.appendChild(el('div', 'suppliers-cell', s.name || ''));
      row.appendChild(el('div', 'suppliers-cell', s.code || ''));
      row.appendChild(
        el('div', 'suppliers-cell', s.contact_person || '')
      );
      row.appendChild(el('div', 'suppliers-cell', s.email || ''));
      row.appendChild(el('div', 'suppliers-cell', s.phone || ''));
      row.appendChild(el('div', 'suppliers-cell', s.website || ''));
      row.appendChild(el('div', 'suppliers-cell', s.note || ''));

      const actionsCell = el('div', 'suppliers-cell suppliers-actions');

      const editBtn = el(
        'button',
        'suppliers-btn suppliers-btn-secondary suppliers-btn-sm',
        labels.editButton
      );
      editBtn.type = 'button';
      editBtn.addEventListener('click', () => {
        openModalForEdit(s);
      });

      const deleteBtn = el(
        'button',
        'suppliers-btn suppliers-btn-danger suppliers-btn-sm',
        labels.deleteButton
      );
      deleteBtn.type = 'button';
      deleteBtn.addEventListener('click', async () => {
        if (!window.confirm(labels.deleteConfirm)) return;
        await deleteSupplier(s.id);
      });

      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(deleteBtn);
      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });

    updatePaginationInfo(total);
  }

  // --------------------------------------------------------
  // BACKEND VOLÁNÍ (API)
  // --------------------------------------------------------

  async function loadSuppliers() {
    setListError('');
    setLoading(true);
    try {
      const data = await apiJson(`${SUPPLIERS_API}?action=list`, {
        method: 'GET',
      });

      state.suppliers = Array.isArray(data.data) ? data.data : [];
      state.page = 1;
      renderTableBody();
    } catch (err) {
      console.error('Chyba při načítání dodavatelů:', err);
      state.suppliers = [];
      renderTableBody();
      setListError(labels.loadError);
    } finally {
      setLoading(false);
    }
  }

  async function saveSupplier(payload) {
    setFormError('');
    try {
      await apiJson(`${SUPPLIERS_API}?action=save`, {
        method: 'POST',
        body: payload,
      });
      await loadSuppliers();
      closeModal();
    } catch (err) {
      console.error('Chyba při ukládání dodavatele:', err);
      setFormError(labels.saveError);
    }
  }

  async function deleteSupplier(id) {
    setListError('');
    try {
      await apiJson(
        `${SUPPLIERS_API}?action=delete&id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      await loadSuppliers();
    } catch (err) {
      console.error('Chyba při mazání dodavatele:', err);
      setListError(labels.deleteError);
    }
  }

  // --------------------------------------------------------
  // HANDLERY FORMULÁŘE, TOOLBARU A TABULKY
  // --------------------------------------------------------

  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    if (state.isSaving) return;

    const name = (nameInput.value || '').trim();
    const code = (codeInput.value || '').trim();
    const contact_person = (contactPersonInput.value || '').trim();
    const email = (emailInput.value || '').trim();
    const phone = (phoneInput.value || '').trim();
    const website = (websiteInput.value || '').trim();
    const note = (noteInput.value || '').trim();

    if (!name) {
      setFormError(labels.validationNameRequired);
      nameInput.focus();
      return;
    }

    const payload = {
      id: state.editingId,
      name,
      code,
      contact_person,
      email,
      phone,
      website,
      note,
    };

    state.isSaving = true;
    saveSupplier(payload).finally(() => {
      state.isSaving = false;
    });
  });

  cancelBtn.addEventListener('click', () => {
    closeModal();
  });

  modalCloseBtn.addEventListener('click', () => {
    closeModal();
  });

  modalBackdrop.addEventListener('click', (evt) => {
    if (evt.target === modalBackdrop) {
      closeModal();
    }
  });

  refreshBtn.addEventListener('click', () => {
    loadSuppliers();
  });

  addBtn.addEventListener('click', () => {
    openModalForCreate();
  });

  searchInput.addEventListener('input', () => {
    state.page = 1;
    renderTableBody();
  });

  prevBtn.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      renderTableBody();
    }
  });

  nextBtn.addEventListener('click', () => {
    state.page += 1;
    renderTableBody();
  });

  // třídění podle hlaviček (klik na header cell)
  headerRow
    .querySelectorAll('.suppliers-header-cell.sortable')
    .forEach((cell) => {
      cell.addEventListener('click', () => {
        const key = cell.dataset.sortKey;
        if (!key) return;
        if (state.sortField === key) {
          state.sortDirection =
            state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortField = key;
          state.sortDirection = 'asc';
        }
        state.page = 1;
        renderTableBody();
      });
    });

  // --------------------------------------------------------
  // MONTÁŽ DO STRÁNKY
  // --------------------------------------------------------

  container.innerHTML = '';
  container.appendChild(page);

  loadSuppliers();
}

const meta = {
  iconClass: 'fa-solid fa-truck-field',
  labels: { cs: labels.title },
  description: labels.subtitle,
};

const moduleDefinition = {
  id: 'suppliers',
  meta,
  render: renderSuppliersModule,
  register: () => registerModule('suppliers', moduleDefinition),
};

export function register() {
  moduleDefinition.register();
}

export default moduleDefinition;


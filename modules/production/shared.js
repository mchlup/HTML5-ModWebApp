export const STORAGE_KEYS = {
  rawMaterials: 'production_raw_materials',
  intermediates: 'production_intermediates',
  recipes: 'production_recipes',
  orders: 'production_orders',
  customers: 'production_customers',
};

export function loadList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
  // Neplatná data nebo problém s localStorage – zalogujeme do konzole a vrátíme prázdný seznam
    console.warn(
      '[production] Neplatná data v localStorage pro klíč',
      key,
      err
    );
    return [];
  }
}

export function saveList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (err) {
    // Uložení do localStorage selhalo – zalogujeme do konzole, ale neshodíme UI
    console.warn(
      '[production] Uložení do localStorage selhalo pro klíč',
      key,
      err
    );
  }
}

export function createCard(titleText, subtitleText) {
  const card = document.createElement('div');
  card.className = 'card production-card';
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

export function createPill(text, type = 'default') {
  const span = document.createElement('span');
  span.className = `pill pill-${type}`;
  span.textContent = text;
  return span;
}

/**
 * Pomocná funkce pro pohodlné vytváření DOM prvků.
 * Příklad:
 *   h('button', { className: 'production-btn', onClick: fn }, 'Text')
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);

  if (attrs && typeof attrs === 'object') {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null) continue;

      if (key === 'className') {
        el.className = value;
      } else if (key === 'dataset' && value && typeof value === 'object') {
        Object.assign(el.dataset, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.slice(2).toLowerCase();
        el.addEventListener(eventName, value);
      } else if (key in el) {
        // např. value, type, checked…
        el[key] = value;
      } else {
        el.setAttribute(key, value);
      }
    }
  }

  const flatChildren = children.flat();
  for (const child of flatChildren) {
    if (child === null || child === undefined) continue;
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Jednoduchý helper pro řazení podle klíče.
 * getKey vrací hodnotu, podle které se řadí (string / number).
 */
export function sortBy(array, getKey, direction = 'asc') {
  const factor = direction === 'desc' ? -1 : 1;
  return [...array].sort((a, b) => {
    const ak = getKey(a);
    const bk = getKey(b);

    if (ak == null && bk == null) return 0;
    if (ak == null) return 1;
    if (bk == null) return -1;

    if (ak > bk) return factor;
    if (ak < bk) return -factor;
    return 0;
  });
}

export function renderEmptyState(card, message) {
  const empty = document.createElement('p');
  empty.className = 'muted';
  empty.textContent = message;
  card.appendChild(empty);
}

export function truncate(text, maxLen) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

/**
 * Bezpečná tvorba cest k assetům / API pomocí import.meta.url.
 * Díky tomu není nutné hardcodovat název modulu do řetězců (např. "./modules/production/").
 *
 * @param {string} relativePath Např. './api/materials.php' nebo '../suppliers/api/suppliers.php'
 * @param {string} metaUrl Typicky import.meta.url volajícího modulu
 * @returns {string} Absolutní cesta (pathname) v rámci webu, např. '/html5/modules/production/api/materials.php'
 */
export function modulePath(relativePath, metaUrl) {
  try {
    return new URL(relativePath, metaUrl).pathname;
  } catch (err) {
    // fallback – vrátíme původní cestu (lepší než shodit UI)
    console.warn('[production] modulePath() selhalo pro', relativePath, err);
    return relativePath;
  }
}

/**
 * Šablona pro sjednocené listovací stránky (Suroviny/Receptury).
 * Vytvoří kartu se standardním toolbar  tabulka  stránkování.
 */
export function createStandardListCard({
  title,
  subtitle,
  filterLabel,
  filterName,
  filterPlaceholder,
  addButtonText,
  addButtonDisabled = false,
} = {}) {
  const grid = document.createElement('div');
  grid.className = 'form-grid production-grid';

  const listCard = createCard(title, subtitle);
  listCard.classList.add('materials-card');

  const toolbar = document.createElement('div');
  toolbar.className = 'table-toolbar materials-toolbar';
  toolbar.innerHTML = `
    <div class="materials-toolbar-inner">
      <label class="materials-filter">
        <span class="muted materials-filter-label"></span>
        <input type="search" name="" placeholder="" />
      </label>
      <div class="materials-toolbar-actions">
        <span class="muted materials-count"></span>
        <div class="materials-toolbar-buttons">
          <button type="button" class="production-btn production-btn-secondary" data-role="column-settings">
            ⚙ Zobrazené sloupce
          </button>
        </div>
      </div>
    </div>
  `;
  const filterLabelEl = toolbar.querySelector('.materials-filter-label');
  if (filterLabelEl) filterLabelEl.textContent = filterLabel || 'Filtrovat';

  const filterInput = toolbar.querySelector('input[type="search"]');
  if (filterInput) {
    filterInput.name = filterName || 'filter';
    filterInput.placeholder = filterPlaceholder || '';
  }

  const actions = toolbar.querySelector('.materials-toolbar-actions');
  const buttons = toolbar.querySelector('.materials-toolbar-buttons');
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.textContent = addButtonText || 'Přidat';
  addBtn.className = 'production-btn production-btn-primary materials-add-btn';
  addBtn.disabled = !!addButtonDisabled;
  // dle požadavku: tlačítko „Přidat…“ má být o řádek výš nad „Zobrazené sloupce“
  buttons?.prepend(addBtn);

  listCard.appendChild(toolbar);

  const table = document.createElement('table');
  table.className = 'striped materials-table';
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  table.appendChild(thead);
  table.appendChild(tbody);

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-scroll';
  tableWrapper.appendChild(table);

  const resultsBlock = document.createElement('div');
  resultsBlock.className = 'materials-results-block';
  resultsBlock.appendChild(tableWrapper);
  listCard.appendChild(resultsBlock);

  const pagination = document.createElement('div');
  pagination.className = 'materials-pagination';
  pagination.innerHTML = `
    <button type="button" data-page="prev">‹ Předchozí</button>
    <span class="materials-page-info"></span>
    <button type="button" data-page="next">Další ›</button>
  `;
  listCard.appendChild(pagination);

  const columnSettingsBtn = toolbar.querySelector('[data-role="column-settings"]');
  const countLabel = toolbar.querySelector('.materials-count');
  const pageInfo = pagination.querySelector('.materials-page-info');
  const prevBtn = pagination.querySelector('[data-page="prev"]');
  const nextBtn = pagination.querySelector('[data-page="next"]');

  prevBtn?.classList.add('production-btn', 'production-btn-secondary', 'production-btn-sm');
  nextBtn?.classList.add('production-btn', 'production-btn-secondary', 'production-btn-sm');

  grid.appendChild(listCard);

  return {
    grid,
    listCard,
    toolbar,
    filterInput,
    actions,
    addBtn,
    columnSettingsBtn,
    countLabel,
    table,
    thead,
    tbody,
    pagination,
    pageInfo,
    prevBtn,
    nextBtn,
  };
}


/**
 * Standardizovaný modál pro modul production.
 * - sjednocená struktura (overlay -> modal -> header/body)
 * - zavření: X tlačítko, klik mimo, ESC
 *
 * @param {object} options
 * @param {string} [options.eyebrow]
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {string} [options.overlayClass]
 * @param {string} [options.modalClass]
 * @param {HTMLElement} options.bodyContent
 * @param {Function} [options.onClose]
 */
export function createStandardModal({
  eyebrow = '',
  title,
  subtitle = '',
  overlayClass = '',
  modalClass = '',
  bodyContent,
  onClose,
}) {
  const overlay = document.createElement('div');
  overlay.className = `modal-overlay production-modal-overlay ${overlayClass}`.trim();

  const modal = document.createElement('div');
  modal.className = `modal production-modal ${modalClass}`.trim();

  const header = document.createElement('div');
  header.className = 'modal-header production-modal-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'production-modal-titlewrap';

  titleWrap.innerHTML = `
    ${eyebrow ? `<p class="modal-eyebrow">${eyebrow}</p>` : ''}
    <h3></h3>
    ${subtitle ? `<p class="production-modal-subtitle">${subtitle}</p>` : ''}
  `.trim();

  const titleEl = titleWrap.querySelector('h3');
  if (titleEl) titleEl.textContent = title || '';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close production-modal-close';
  closeBtn.setAttribute('aria-label', 'Zavřít');
  closeBtn.innerHTML = '&times;';

  header.appendChild(titleWrap);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'production-modal-body';
  if (bodyContent) body.appendChild(bodyContent);

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);

  let escHandler = null;

  const handleClose = () => {
    document.body.classList.remove('modal-open');
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (typeof onClose === 'function') onClose();
  };

  const open = () => {
    if (!overlay.isConnected) document.body.appendChild(overlay);
    document.body.classList.add('modal-open');

    escHandler = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', escHandler);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleClose();
  });
  closeBtn.addEventListener('click', handleClose);

  return {
    overlay,
    modal,
    header,
    body,
    open,
    close: handleClose,
    setTitle: (t) => {
      if (titleEl) titleEl.textContent = t || '';
    },
  };
}

// ---------------------------------------------------------------------------
// Detail modál (klik na řádek / položku v seznamu)
// ---------------------------------------------------------------------------

/**
 * Vrátí true, pokud klik / focus vznikl na "interaktivním" prvku uvnitř řádku
 * (tlačítka, inputy apod.) – tzn. detail se nemá otevřít.
 *
 * POZOR: samotný řádek dostává role="button" kvůli a11y.
 * Proto musíme ignorovat případ, kdy closest([role="button"]) vrátí právě rootEl.
 */
function isInteractiveElement(target, rootEl) {
  if (!(target instanceof Element)) return false;

  const hit = target.closest(
    'button, a, input, select, textarea, label, [role="button"], [data-no-row-click], .materials-actions, .form-actions'
  );

  if (!hit) return false;
  if (rootEl && hit === rootEl) return false; // klik na řádek samotný má otevřít detail
  return true;
}

function formatDetailValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (value instanceof Node) return value;
  if (typeof value === 'boolean') return value ? 'Ano' : 'Ne';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toLocaleString();
  return String(value);
}

/**
 * Vytvoří jednoduchý přehled detailů (label -> hodnota).
 * fields: [{ label, value: (item) => any|Node }]
 */
export function buildDetailList(fields = [], item) {
  const wrap = document.createElement('div');
  wrap.className = 'production-detail';

  const dl = document.createElement('dl');
  dl.className = 'production-detail-list';

  (fields || []).forEach((f) => {
    const dt = document.createElement('dt');
    dt.textContent = f.label || '';

    const dd = document.createElement('dd');
    const raw = typeof f.value === 'function' ? f.value(item) : item?.[f.key];
    const val = formatDetailValue(raw);
    if (val instanceof Node) {
      dd.appendChild(val);
    } else {
      dd.textContent = val;
    }

    dl.appendChild(dt);
    dl.appendChild(dd);
  });

  wrap.appendChild(dl);
  return wrap;
}

/**
 * Naváže na element (typicky <tr> nebo blok v listu) otevření modálu s detailem.
 *
 * @param {HTMLElement} targetEl
 * @param {object} options
 * @param {any} options.item
 * @param {string} options.title
 * @param {string} [options.eyebrow]
 * @param {string} [options.subtitle]
 * @param {Array} [options.fields]
 * @param {(item:any)=>HTMLElement} [options.body]
 * @param {string} [options.overlayClass]
 * @param {string} [options.modalClass]
 */
export function bindDetailModal(targetEl, {
  item,
  title,
  eyebrow = 'DETAIL',
  subtitle = '',
  fields = [],
  body,
  overlayClass = '',
  modalClass = '',
} = {}) {
  if (!targetEl) return;

  targetEl.classList.add('production-clickable');
  targetEl.setAttribute('tabindex', '0');
  targetEl.setAttribute('role', 'button');
  targetEl.setAttribute('aria-label', `Otevřít detail: ${title || ''}`.trim());

  const openDetail = () => {
    const bodyContent = typeof body === 'function' ? body(item) : buildDetailList(fields, item);
    const modal = createStandardModal({
      eyebrow,
      title: title || '',
      subtitle,
      overlayClass,
      modalClass,
      bodyContent,
    });
    modal.open();
  };

  targetEl.addEventListener('click', (e) => {
    if (isInteractiveElement(e.target, targetEl)) return;
    openDetail();
  });

  targetEl.addEventListener('keydown', (e) => {
    if (isInteractiveElement(e.target, targetEl)) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetail();
    }
  });
}


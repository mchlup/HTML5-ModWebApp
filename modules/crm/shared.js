export const STORAGE_KEYS = {
  rawMaterials: 'crm_raw_materials',
  intermediates: 'crm_intermediates',
  recipes: 'crm_recipes',
  orders: 'crm_orders',
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
      '[CRM] Neplatná data v localStorage pro klíč',
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
      '[CRM] Uložení do localStorage selhalo pro klíč',
      key,
      err
    );
  }
}

export function createCard(titleText, subtitleText) {
  const card = document.createElement('div');
  card.className = 'card crm-card';
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
 *   h('button', { className: 'crm-btn', onClick: fn }, 'Text')
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

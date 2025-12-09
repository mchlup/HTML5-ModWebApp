export const STORAGE_KEYS = {
  rawMaterials: 'crm_raw_materials',
  intermediates: 'crm_intermediates',
  recipes: 'crm_recipes',
  orders: 'crm_orders',
};

export function loadList(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

export function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
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

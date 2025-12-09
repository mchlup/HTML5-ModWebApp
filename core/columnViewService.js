import { requestWithCsrf } from './authService.js';

const API_ENDPOINT = './api/user-column-views.php';

function normalizeColumns(defaultColumns = []) {
  return (defaultColumns || []).map((col, index) => ({
    ...col,
    order: typeof col.order === 'number' ? col.order : index,
    visible: col.defaultVisible !== false,
  }));
}

export function mergeColumnConfig(defaultColumns = [], userColumns = []) {
  const baseColumns = normalizeColumns(defaultColumns);
  const map = new Map();
  baseColumns.forEach((col) => {
    map.set(col.id, { ...col });
  });

  if (Array.isArray(userColumns)) {
    userColumns.forEach((savedCol, savedIndex) => {
      const target = map.get(savedCol.id);
      if (!target) return;
      const next = { ...target };
      if (savedCol.visible !== undefined && target.required !== true) {
        next.visible = Boolean(savedCol.visible);
      }
      if (savedCol.width) {
        next.width = String(savedCol.width);
      }
      if (typeof savedCol.order === 'number') {
        next.order = savedCol.order;
      } else {
        next.order = savedIndex;
      }
      map.set(savedCol.id, next);
    });
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  merged.forEach((col, idx) => {
    // normalizace pořadí pro další zpracování
    col.order = idx;
    if (col.required) {
      col.visible = true;
    }
  });
  return merged;
}

export async function loadUserColumns(moduleCode, viewCode, defaultColumns = []) {
  const fallback = normalizeColumns(defaultColumns);
  const url = `${API_ENDPOINT}?moduleCode=${encodeURIComponent(moduleCode)}&viewCode=${encodeURIComponent(viewCode)}`;
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      return fallback;
    }
    const saved = Array.isArray(data.columns) ? data.columns : [];
    return mergeColumnConfig(defaultColumns, saved);
  } catch (err) {
    console.warn('Nepodařilo se načíst uživatelské sloupce', err);
    return fallback;
  }
}

export async function saveUserColumns(moduleCode, viewCode, columns = []) {
  const payload = {
    moduleCode,
    viewCode,
    columns: (columns || []).map((col, idx) => ({
      id: col.id,
      visible: col.required ? true : Boolean(col.visible),
      width: col.width || null,
      order: idx,
    })),
  };

  const res = await requestWithCsrf(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    const msg = data?.message || 'Uložení nastavení sloupců selhalo.';
    throw new Error(msg);
  }
  return data;
}

export async function deleteUserColumns(moduleCode, viewCode) {
  const url = `${API_ENDPOINT}?moduleCode=${encodeURIComponent(moduleCode)}&viewCode=${encodeURIComponent(viewCode)}`;
  const res = await requestWithCsrf(url, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    const msg = data?.message || 'Reset nastavení sloupců selhal.';
    throw new Error(msg);
  }
  return data;
}

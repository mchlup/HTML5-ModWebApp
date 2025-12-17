import labelsCs from './lang_cs.js';
import labelsEn from './lang_en.js';
import { registerModule } from '../../core/moduleRegistry.js';
import { apiJson } from '../../core/authService.js';
import { getLanguage } from '../../core/languageManager.js';
import { showToast } from '../../core/uiService.js';
import {
  loadUserColumns,
  saveUserColumns,
  deleteUserColumns,
} from '../../core/columnViewService.js';

let customersStylesLoaded = false;

function labels() {
  const lang = (typeof getLanguage === 'function' ? getLanguage() : 'cs');
  return lang === 'en' ? labelsEn : labelsCs;
}

function ensureStyles() {
  if (customersStylesLoaded) return;

  const href = 'modules/customers/styles.css';
  const existing = document.querySelector(`link[data-customers-styles="true"][href="${href}"]`);
  if (!existing) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.customersStyles = 'true';
    document.head.appendChild(link);
  }
  customersStylesLoaded = true;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, k);
    else if (v !== false && v != null) node.setAttribute(k, String(v));
  });
  ([]).concat(children || []).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

function createModal({ title, subtitle = '', content, onClose }) {
  const overlay = el('div', { class: 'customers-modal-overlay', role: 'dialog', 'aria-modal': 'true' });
  const modal = el('div', { class: 'customers-modal' });

  const header = el('div', { class: 'customers-modal-header' }, [
    el('div', { class: 'customers-modal-titles' }, [
      el('div', { class: 'customers-modal-title' }, [title]),
      subtitle ? el('div', { class: 'customers-modal-subtitle' }, [subtitle]) : null,
    ]),
    el('button', { class: 'customers-btn customers-btn-ghost', type: 'button', onClick: close }, ['✕']),
  ]);

  const body = el('div', { class: 'customers-modal-body' }, [content]);

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);

  function open() {
    document.body.appendChild(overlay);
    document.body.classList.add('customers-modal-open');
    setTimeout(() => {
      const first = overlay.querySelector('input, textarea, select, button');
      if (first) first.focus();
    }, 0);
  }

  function close() {
    overlay.remove();
    document.body.classList.remove('customers-modal-open');
    if (typeof onClose === 'function') onClose();
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener(
    'keydown',
    (e) => {
      if (!document.body.contains(overlay)) return;
      if (e.key === 'Escape') close();
    },
    true
  );

  return { open, close, overlay };
}

function normalizeBool(v) {
  return v === 1 || v === '1' || v === true || v === 'true';
}

async function fetchCustomers() {
  const res = await apiJson('modules/customers/api/customers.php', { method: 'GET' });
  if (!res || res.success !== true) throw new Error(res?.message || 'Load failed');
  // kompatibilita: API může vracet "data" nebo "items"
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.items)) return res.items;
  return [];
}

async function createCustomer(payload) {
  const res = await apiJson('modules/customers/api/customers.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res || res.success !== true) throw new Error(res?.message || 'Save failed');
  return res;
}

async function updateCustomer(payload) {
  const res = await apiJson('modules/customers/api/customers.php', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res || res.success !== true) throw new Error(res?.message || 'Save failed');
  return res;
}

async function deleteCustomer(id) {
  const res = await apiJson(`modules/customers/api/customers.php?id=${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });
  if (!res || res.success !== true) throw new Error(res?.message || 'Delete failed');
  return res;
}

function renderCustomers(root) {
  ensureStyles();
  const t = labels();

  root.innerHTML = '';
  const wrap = el('div', { class: 'customers-wrap' });

  const header = el('div', { class: 'customers-header' }, [
    el('div', { class: 'customers-headline' }, [
      el('h2', { class: 'customers-title' }, [t.title]),
      el('div', { class: 'customers-desc' }, [t.description]),
    ]),
    el('div', { class: 'customers-actions' }, [
      el('input', {
        class: 'customers-search',
        type: 'search',
        placeholder: t.searchPlaceholder,
        'aria-label': t.searchPlaceholder,
      }),
      el('div', { class: 'customers-actions-btns' }, [
        el('button', { class: 'customers-btn customers-btn-secondary', type: 'button', 'data-action': 'columns' }, [
          t.columnSettings || 'Zobrazené sloupce',
        ]),
        el('button', { class: 'customers-btn customers-btn-primary', type: 'button', 'data-action': 'add' }, [t.addCustomer]),
      ]),
    ]),
  ]);

  const tableWrap = el('div', { class: 'customers-tablewrap' });
  const table = el('table', { class: 'customers-table' });
  const thead = el('thead');
  const tbody = el('tbody');

  const MODULE_CODE = 'customers';
  const VIEW_CODE = 'customers';

    const defaultColumns = [
    { id: 'code', label: t.columns.code || 'Kód', order: 0, width: '', required: true, defaultVisible: true },
    { id: 'name', label: t.columns.name || 'Název', order: 1, width: '', required: true, defaultVisible: true },
    { id: 'ico', label: t.columns.ico || 'IČO', order: 2, width: '', defaultVisible: true },
    { id: 'dic', label: t.columns.dic || 'DIČ', order: 3, width: '', defaultVisible: true },
    { id: 'email', label: t.columns.email || 'E-mail', order: 4, width: '', defaultVisible: true },
    { id: 'phone', label: t.columns.phone || 'Telefon', order: 5, width: '', defaultVisible: true },
    { id: 'address', label: t.columns.address || 'Adresa', order: 6, width: '', defaultVisible: false },
    { id: 'note', label: t.columns.note || 'Poznámka', order: 7, width: '', defaultVisible: false },
    { id: 'active', label: t.columns.active || 'Aktivní', order: 8, width: '90px', defaultVisible: true },
  ];

  let userColumns = null;

  function cloneDefaultColumns() {
    return defaultColumns.map((c, i) => ({
      ...c,
      order: typeof c.order === 'number' ? c.order : i,
      visible: c.required ? true : (c.defaultVisible !== false),
    }));
  }

  function getColumnsConfig() {
    return Array.isArray(userColumns) && userColumns.length ? userColumns : cloneDefaultColumns();
  }

  function getVisibleCols() {
    return getColumnsConfig().filter((c) => c.visible !== false);
  }

  function renderHead() {
    thead.innerHTML = '';
    const tr = el('tr');
    const visible = getVisibleCols();
    visible.forEach((col) => {
      const th = el('th', {}, [col.label || col.id]);
      if (col.width) th.style.width = col.width;
      tr.appendChild(th);
    });
    tr.appendChild(el('th', { class: 'customers-th-actions' }, [t.columns.actions]));
    thead.appendChild(tr);
  }

  function openColumnsModal() {
    const cfg = getColumnsConfig().map((c, i) => ({
      ...c,
      order: typeof c.order === 'number' ? c.order : i,
      visible: c.required ? true : (c.visible !== false),
      width: c.width || '',
    }));

    const body = el('div', { class: 'customers-columns' });

    const list = el('div', { class: 'customers-columns-list' });
    cfg.forEach((col) => {
      const row = el('div', { class: 'customers-columns-row' });
      const label = el('label', { class: 'customers-columns-label' });
      const cb = el('input', { type: 'checkbox' });
      cb.checked = col.visible !== false;
      cb.disabled = !!col.required;
      cb.addEventListener('change', () => {
        col.visible = cb.checked;
      });

      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + (col.label || col.id)));
      if (col.required) {
        const badge = el('span', { class: 'customers-pill' }, [t.requiredPill || 'Povinný']);
        label.appendChild(badge);
      }

      const width = el('input', {
        class: 'customers-columns-width',
        type: 'text',
        placeholder: t.columnsWidthPlaceholder || 'Šířka (px/%)',
        value: col.width || '',
      });
      width.addEventListener('input', (e) => {
        col.width = String(e.target.value || '').trim();
      });

      row.appendChild(label);
      row.appendChild(width);
      list.appendChild(row);
    });

    const actionsRow = el('div', { class: 'customers-columns-actions' });
    const btnReset = el('button', { class: 'customers-btn customers-btn-secondary', type: 'button' }, [
      t.resetColumns || 'Obnovit výchozí',
    ]);
    const btnSave = el('button', { class: 'customers-btn customers-btn-primary', type: 'button' }, [
      t.saveColumns || 'Uložit',
    ]);

    actionsRow.appendChild(btnReset);
    actionsRow.appendChild(btnSave);

    body.appendChild(list);
    body.appendChild(actionsRow);

    const modal = createModal({
      title: t.columnSettings || 'Zobrazené sloupce',
      subtitle: t.columnSettingsSubtitle || 'Vyberte, které sloupce chcete zobrazit v tabulce.',
      content: body,
    });

    btnReset.addEventListener('click', async () => {
      try {
        await deleteUserColumns(MODULE_CODE, VIEW_CODE);
        userColumns = cloneDefaultColumns();
        renderHead();
        applyFilter(header.querySelector('input.customers-search').value);
        modal.close();
        showToast(t.columnsResetDone || 'Výchozí sloupce byly obnoveny.', 'success');
      } catch (e) {
        showToast((t.columnsSaveFailed || 'Uložení sloupců selhalo.') + ' ' + (e?.message || ''), 'error');
      }
    });

    btnSave.addEventListener('click', async () => {
      try {
        // normalizace pořadí + povinných sloupců
        const next = cfg
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((c, idx) => ({
            ...c,
            order: idx,
            visible: c.required ? true : (c.visible !== false),
            width: (c.width || '').trim(),
          }));

        userColumns = next;
        await saveUserColumns(MODULE_CODE, VIEW_CODE, userColumns);
        renderHead();
        applyFilter(header.querySelector('input.customers-search').value);
        modal.close();
        showToast(t.columnsSaved || 'Sloupce byly uloženy.', 'success');
      } catch (e) {
        showToast((t.columnsSaveFailed || 'Uložení sloupců selhalo.') + ' ' + (e?.message || ''), 'error');
      }
    });

    modal.open();
  }

  async function loadColumns() {
    try {
      userColumns = await loadUserColumns(MODULE_CODE, VIEW_CODE, defaultColumns);
    } catch (e) {
      console.warn('[customers] loadUserColumns failed', e);
      userColumns = cloneDefaultColumns();
    }
    renderHead();
  }
  table.appendChild(thead);
  table.appendChild(tbody);
  tableWrap.appendChild(table);

  const empty = el('div', { class: 'customers-empty' }, [t.empty]);
  tableWrap.appendChild(empty);

  const pg = t.pagination || {};
  const pager = el('div', { class: 'customers-pager' });
  const perPageText = pg.perPage || 'Na stránku';

  const pagerLeft = el('div', { class: 'customers-pager-left' });
  pagerLeft.appendChild(el('span', { class: 'customers-pager-label' }, [perPageText]));

  const pageSizeSelect = el('select', { class: 'customers-pager-select', 'aria-label': perPageText });
  [10, 25, 50, 100].forEach((n) => {
    pageSizeSelect.appendChild(el('option', { value: String(n) }, [String(n)]));
  });
  pageSizeSelect.value = '25';
  pagerLeft.appendChild(pageSizeSelect);

  const pagerRight = el('div', { class: 'customers-pager-right' });
  const btnPrevPage = el('button', { class: 'customers-btn customers-btn-secondary customers-btn-small', type: 'button' }, [
    pg.prev || 'Předchozí',
  ]);
  const pagerInfo = el('span', { class: 'customers-pager-info' }, ['']);
  const btnNextPage = el('button', { class: 'customers-btn customers-btn-secondary customers-btn-small', type: 'button' }, [
    pg.next || 'Další',
  ]);
  pagerRight.appendChild(btnPrevPage);
  pagerRight.appendChild(pagerInfo);
  pagerRight.appendChild(btnNextPage);

  pager.appendChild(pagerLeft);
  pager.appendChild(pagerRight);
  pager.style.display = 'none';

  wrap.appendChild(header);
  wrap.appendChild(tableWrap);
  wrap.appendChild(pager);
  root.appendChild(wrap);

  let all = [];
  let filtered = [];
  let currentPage = 1;
  let pageSize = Number(pageSizeSelect.value) || 25;

  function updatePagination() {
    pageSize = Number(pageSizeSelect.value) || 25;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = total === 0 ? 0 : (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pageRows = total === 0 ? [] : filtered.slice(startIdx, endIdx);

    renderRows(pageRows, total);

    pagerInfo.textContent = total === 0
      ? (pg.emptyInfo || '')
      : `${(pg.page || 'Strana')} ${currentPage}/${totalPages} · ${startIdx + 1}–${endIdx} ${(pg.of || 'z')} ${total}`;

    btnPrevPage.disabled = currentPage <= 1;
    btnNextPage.disabled = currentPage >= totalPages;
  }

  pageSizeSelect.addEventListener('change', () => {
    currentPage = 1;
    updatePagination();
  });

  btnPrevPage.addEventListener('click', () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    updatePagination();
  });

  btnNextPage.addEventListener('click', () => {
    currentPage += 1;
    updatePagination();
  });

  function applyFilter(q) {
    const needle = (q || '').trim().toLowerCase();
    filtered = !needle
      ? all
      : all.filter((x) => {
          const hay = [
            x.code,
            x.name,
            x.ico,
            x.dic,
            x.email,
            x.phone,
            x.address,
            x.note,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(needle);
        });

    currentPage = 1;
    updatePagination();
  }

  function renderRows(rows, totalCount) {
    tbody.innerHTML = '';
    const hasAny = (totalCount || 0) > 0;
    empty.style.display = hasAny ? 'none' : 'block';
    table.style.display = hasAny ? 'table' : 'none';
    pager.style.display = hasAny ? 'flex' : 'none';

    rows.forEach((row) => {
      const tr = el('tr', { class: 'customers-row' });
      const visible = getVisibleCols();
      visible.forEach((col) => {
        const c = col.id;
        let val = row[c];
        if (c === 'active') val = normalizeBool(val) ? '✓' : '';
        tr.appendChild(el('td', { title: val == null ? '' : String(val) }, [val == null ? '' : String(val)]));
      });

      const btnEdit = el('button', { class: 'customers-btn customers-btn-small', type: 'button' }, [t.editCustomer]);
      const btnDel = el('button', { class: 'customers-btn customers-btn-danger customers-btn-small', type: 'button' }, [
        t.deleteCustomer,
      ]);

      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        openForm(row);
      });
      btnDel.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(t.confirmDelete)) return;
        try {
          await deleteCustomer(row.id);
          showToast(t.messages.deleted, 'success');
          await reload();
        } catch (e) {
          showToast(t.messages.deleteFailed + ' ' + (e?.message || ''), 'error');
        }
      });

      const tdActions = el('td', { class: 'customers-td-actions' }, [
        el('div', { class: 'customers-actions-col' }, [btnEdit, btnDel]),
      ]);
      tr.appendChild(tdActions);

      // Detail po kliknutí na řádek
      tr.addEventListener('click', () => openDetails(row));

      tbody.appendChild(tr);
    });
  }

  function formatValue(v) {
    if (v == null) return '';
    if (typeof v === 'boolean') return v ? '✓' : '';
    return String(v);
  }

  function openDetails(row) {
    const body = el('div', { class: 'customers-detail' });
    const grid = el('div', { class: 'customers-detail-grid' });

    const fields = [
      ['code', t.columns.code],
      ['name', t.columns.name],
      ['ico', t.columns.ico],
      ['dic', t.columns.dic],
      ['email', t.columns.email],
      ['phone', t.columns.phone],
      ['address', t.columns.address],
      ['note', t.columns.note],
      ['active', t.columns.active],
      ['created_at', t.details?.createdAt || 'Vytvořeno'],
      ['updated_at', t.details?.updatedAt || 'Aktualizováno'],
    ];

    fields.forEach(([key, label]) => {
      const val = key === 'active' ? (normalizeBool(row.active) ? '✓' : '') : formatValue(row[key]);
      const item = el('div', { class: 'customers-detail-item' }, [
        el('div', { class: 'customers-detail-label' }, [label]),
        el('div', { class: 'customers-detail-value' }, [val]),
      ]);
      grid.appendChild(item);
    });

    const actions = el('div', { class: 'customers-detail-actions' }, [
      el('button', { class: 'customers-btn customers-btn-secondary', type: 'button' }, [t.form.cancel]),
      el('button', { class: 'customers-btn customers-btn-primary', type: 'button' }, [t.details?.edit || t.editCustomer]),
    ]);

    body.appendChild(grid);
    body.appendChild(actions);

    const modal = createModal({
      title: (t.details?.title || 'Detail zákazníka') + (row.name ? `: ${row.name}` : ''),
      subtitle: row.code ? `${t.columns.code}: ${row.code}` : '',
      content: body,
    });

    const [btnClose, btnEdit] = actions.querySelectorAll('button');
    btnClose.addEventListener('click', () => modal.close());
    btnEdit.addEventListener('click', () => {
      modal.close();
      openForm(row);
    });

    modal.open();
  }

  function openForm(existing) {
    const isEdit = !!existing;
    const data = existing
      ? {
          id: existing.id,
          code: existing.code || '',
          name: existing.name || '',
          ico: existing.ico || '',
          dic: existing.dic || '',
          email: existing.email || '',
          phone: existing.phone || '',
          address: existing.address || '',
          note: existing.note || '',
          active: normalizeBool(existing.active),
        }
      : {
          code: '',
          name: '',
          ico: '',
          dic: '',
          email: '',
          phone: '',
          address: '',
          note: '',
          active: true,
        };

    const form = el('form', { class: 'customers-form' });

    const row1 = el('div', { class: 'customers-form-grid' }, [
      field('code', t.form.code, data.code),
      field('name', t.form.name, data.name, { required: true }),
      field('ico', t.form.ico, data.ico),
      field('dic', t.form.dic, data.dic),
      field('email', t.form.email, data.email),
      field('phone', t.form.phone, data.phone),
    ]);

    const row2 = el('div', { class: 'customers-form-grid customers-form-grid-wide' }, [
      textarea('address', t.form.address, data.address),
      textarea('note', t.form.note, data.note),
    ]);

    const activeWrap = el('label', { class: 'customers-check' }, [
      el('input', { type: 'checkbox', name: 'active', checked: data.active ? 'checked' : null }),
      el('span', { class: 'customers-check-label' }, [t.form.active]),
    ]);

    const foot = el('div', { class: 'customers-form-footer' }, [
      el('div', { class: 'customers-form-required' }, [t.form.required]),
      el('div', { class: 'customers-form-buttons' }, [
        el('button', { class: 'customers-btn', type: 'button' }, [t.form.cancel]),
        el('button', { class: 'customers-btn customers-btn-primary', type: 'submit' }, [t.form.save]),
      ]),
    ]);

    form.appendChild(row1);
    form.appendChild(row2);
    form.appendChild(activeWrap);
    form.appendChild(foot);

    function field(name, label, value, opts = {}) {
      const input = el('input', {
        class: 'customers-input',
        type: 'text',
        name,
        value: value ?? '',
        ...(opts.required ? { required: 'required' } : {}),
      });
      return el('label', { class: 'customers-field' }, [
        el('span', { class: 'customers-label' }, [label]),
        input,
      ]);
    }

    function textarea(name, label, value) {
      const ta = el('textarea', { class: 'customers-textarea', name, rows: '3' }, [value ?? '']);
      return el('label', { class: 'customers-field customers-field-wide' }, [
        el('span', { class: 'customers-label' }, [label]),
        ta,
      ]);
    }

    const modal = createModal({
      title: isEdit ? t.editCustomer : t.addCustomer,
      subtitle: '',
      content: form,
    });

    // cancel
    foot.querySelector('button[type="button"]').addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fd = new FormData(form);
      const payload = {
        ...(isEdit ? { id: data.id } : {}),
        code: String(fd.get('code') || '').trim(),
        name: String(fd.get('name') || '').trim(),
        ico: String(fd.get('ico') || '').trim(),
        dic: String(fd.get('dic') || '').trim(),
        email: String(fd.get('email') || '').trim(),
        phone: String(fd.get('phone') || '').trim(),
        address: String(fd.get('address') || '').trim(),
        note: String(fd.get('note') || '').trim(),
        active: fd.get('active') ? true : false,
      };

      if (!payload.name) {
        showToast(t.form.name + ' - ' + 'chybí', 'warning');
        return;
      }

      try {
        if (isEdit) {
          await updateCustomer(payload);
        } else {
          await createCustomer(payload);
        }
        showToast(t.messages.saved, 'success');
        modal.close();
        await reload();
      } catch (err) {
        showToast(t.messages.saveFailed + ' ' + (err?.message || ''), 'error');
      }
    });

    modal.open();
  }

  header.querySelector('[data-action="add"]').addEventListener('click', () => openForm(null));
  header.querySelector('input.customers-search').addEventListener('input', (e) => applyFilter(e.target.value));
  const columnsBtn = header.querySelector('[data-action="columns"]');
  if (columnsBtn) columnsBtn.addEventListener('click', () => openColumnsModal());

  async function reload() {
    try {
      all = await fetchCustomers();
      applyFilter(header.querySelector('input.customers-search').value);
    } catch (e) {
      showToast(t.messages.loadFailed + ' ' + (e?.message || ''), 'error');
      all = [];
      applyFilter('');
    }
  }

  (async () => {
    await loadColumns();
    await reload();
  })();
}

const meta = {
  iconClass: 'fa-solid fa-users',
  description: labelsCs.description,
  labels: { cs: labelsCs.title, en: labelsEn.title },
};

const moduleDefinition = {
  id: 'customers',
  meta,
  render: (root) => renderCustomers(root),
  register() {
    registerModule('customers', moduleDefinition);
  },
};

if (typeof window !== 'undefined') {
  moduleDefinition.register();
}

export default moduleDefinition;

import { showToast } from '../../core/uiService.js';
import {
  createCard,
  createStandardModal,
  createStandardListCard,
  loadList,
  renderEmptyState,
  saveList,
  STORAGE_KEYS,
  sortBy,
} from './shared.js';

export function renderOrders(container, { labels, onCountChange } = {}) {
  const recipes = loadList(STORAGE_KEYS.recipes);
  const orders = loadList(STORAGE_KEYS.orders);
  const customers = loadList(STORAGE_KEYS.customers);

  if (!recipes.length) {
    const card = createCard(labels.orders, labels.emptyOrders || 'Nejsou evidovány žádné receptury.');
    card.appendChild(
      renderEmptyState(
        labels.emptyOrders ||
          'Nejdříve vytvořte alespoň jednu recepturu, poté můžete zadávat zakázky.'
      )
    );
    container.innerHTML = '';
    container.appendChild(card);
    return;
  }

  const listTpl = createStandardListCard({
    title: labels.ordersListTitle || labels.orders,
    subtitle:
      labels.ordersListSubtitle ||
      labels.ordersIntro ||
      'Zadejte zakázku zákazníka a přiřaďte k ní konkrétní recepturu.',
    filterLabel: labels.filterOrders || 'Filtrovat zakázky',
    filterName: 'ordersFilter',
    filterPlaceholder: labels.filterOrdersPlaceholder || 'Hledat podle zákazníka nebo poznámky',
    addButtonText: labels.addOrder,
  });

  const { grid, listCard, filterInput, addBtn, table, countLabel } = listTpl;

  // Zakázky zobrazujeme jako bloky, tabulku v šabloně schováme
  table.style.display = 'none';

  const listWrap = document.createElement('div');
  listWrap.className = 'orders-list';
  listCard.querySelector('.materials-results-block')?.appendChild(listWrap);

  const state = { term: '' };

  let modal = null;

  function buildFormCard() {
    const formCard = createCard(
      labels.addOrder,
      labels.ordersIntro ||
        'Zadejte zakázku zákazníka a přiřaďte k ní konkrétní recepturu.'
    );

    const form = document.createElement('form');
    form.className = 'production-form';
    form.innerHTML = `
      <div class="form-grid two-col">
        <label>${labels.customer || 'Zákazník'}
          <div class="materials-supplier-inline">
            <select name="customerId" required>
              <option value="">—</option>
              ${customers
                .map((c) => `<option value="${String(c.id)}">${String(c.name || '')}</option>`)
                .join('')}
            </select>
            <button type="button" class="production-btn production-btn-secondary production-btn-sm" data-role="add-customer">+ Nový zákazník</button>
          </div>
        </label>
        <label>${labels.recipeLabel || 'Receptura'}
          <select name="recipeId" required>
            <option value="">—</option>
            ${recipes
              .map((r) => `<option value="${String(r.id)}">${String(r.name || 'Receptura')}</option>`)
              .join('')}
          </select>
        </label>
        <label>${labels.quantity || 'Množství (kg)'}<input name="quantity" type="number" min="1" step="1" placeholder="250" /></label>
        <label>${labels.dueDate || 'Termín výroby'}<input name="dueDate" type="date" /></label>
        <label>Poznámka<textarea name="note" rows="2" placeholder="Dodat na stavbu v týdnu 32, balení 25 kg."></textarea></label>
      </div>
    `;

    const customerSelect = form.querySelector('select[name="customerId"]');
    const addCustomerBtn = form.querySelector('[data-role="add-customer"]');

    function refreshCustomerOptions(selectedId = null) {
      if (!customerSelect) return;
      const current = (selectedId ?? Number(customerSelect.value || 0)) || 0;

      customerSelect.innerHTML = `
        <option value="">—</option>
        ${customers
          .map((c) => `<option value="${String(c.id)}">${String(c.name || '')}</option>`)
          .join('')}
      `;
      if (current) customerSelect.value = String(current);
    }

    let customerModal = null;

    function buildCustomerModal() {
      if (customerModal) return customerModal;

      const wrap = document.createElement('div');

      const f = document.createElement('form');
      f.className = 'production-form';
      f.innerHTML = `
        <div class="form-grid two-col">
          <label>${labels.customer || 'Zákazník'}
            <input name="customerName" required placeholder="${labels.customerPlaceholder || 'Např. Stavby a.s.'}" />
          </label>
          <label>${labels.note || 'Poznámka'}
            <input name="note" placeholder="${labels.customerNotePlaceholder || ''}" />
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="production-btn production-btn-primary">${labels.save || 'Uložit'}</button>
          <button type="button" class="production-btn production-btn-secondary" data-role="close">${labels.close || 'Zavřít'}</button>
        </div>
      `;
      wrap.appendChild(f);

      customerModal = createStandardModal({
        eyebrow: labels.newCustomerEyebrow || 'NOVÝ ZÁKAZNÍK',
        title: labels.newCustomerTitle || (labels.customer || 'Zákazník'),
        subtitle: labels.newCustomerSubtitle || 'Zadejte údaje zákazníka a uložte jej.',
        overlayClass: 'production-customer-modal-overlay',
        modalClass: 'production-customer-modal',
        bodyContent: wrap,
        onClose: () => {
          customerModal = null;
        },
      });

      const closeBtn = f.querySelector('[data-role="close"]');
      closeBtn?.addEventListener('click', () => customerModal?.close());

      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd2 = new FormData(f);
        const name = String(fd2.get('customerName') || '').trim();
        const note2 = String(fd2.get('note') || '').trim();

        if (!name) return;

        const nextCustomers = [
          ...customers,
          { id: Date.now(), name, note: note2 },
        ];
        customers.length = 0;
        customers.push(...nextCustomers);
        saveList(STORAGE_KEYS.customers, nextCustomers);

        // refresh select and auto-select new customer
        const newId = nextCustomers[nextCustomers.length - 1].id;
        refreshCustomerOptions(newId);

        showToast(labels.customerSaved || 'Zákazník uložen.');
        customerModal?.close();
      });

      return customerModal;
    }

    function openCustomerModal() {
      const m = buildCustomerModal();
      m.open();
      setTimeout(() => {
        const el = m.body.querySelector('input, textarea, select, button');
        el?.focus?.();
      }, 50);
    }

    addCustomerBtn?.addEventListener('click', openCustomerModal);

    const actions = document.createElement('div');
    actions.className = 'form-actions';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'production-btn production-btn-primary';
    submit.textContent = labels.saveOrder || 'Uložit zakázku';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'production-btn production-btn-secondary';
    closeBtn.textContent = labels.close || 'Zavřít';
    closeBtn.addEventListener('click', () => modal?.close());

    actions.appendChild(submit);
    actions.appendChild(closeBtn);
    form.appendChild(actions);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);

      const customerId = Number(fd.get('customerId') || 0);
      const recipeId = Number(fd.get('recipeId') || 0);
      if (!customerId || !recipeId) return;

      const customerObj = customers.find((c) => Number(c.id) === customerId);
      const customer = String(customerObj?.name || '').trim();
      if (!customer) return;

      const quantity = Number(fd.get('quantity') || 0) || null;
      const dueDate = String(fd.get('dueDate') || '').trim();
      const note = String(fd.get('note') || '').trim();

      const recipe = recipes.find((r) => Number(r.id) === recipeId);

      const next = [
        ...orders,
        {
          id: Date.now(),
          customer,
          recipeId,
          recipeName: recipe?.name || '',
          quantity,
          dueDate,
          note,
          status: 'new',
          createdAt: new Date().toISOString(),
        },
      ];
      saveList(STORAGE_KEYS.orders, next);
      if (typeof onCountChange === 'function') onCountChange(next.length);
      showToast('Zakázka uložena.');
      modal?.close();
      renderOrders(container, { labels, onCountChange });
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
      eyebrow: labels.newOrderEyebrow || 'Nová zakázka',
      title: labels.addOrder,
      subtitle:
        labels.ordersIntro ||
        'Zadejte zakázku zákazníka a přiřaďte k ní konkrétní recepturu.',
      overlayClass: 'production-orders-modal-overlay',
      modalClass: 'production-orders-modal',
      bodyContent: formCard,
      onClose: () => {
        modal = null;
      },
    });
    modal.open();
  }

  addBtn.addEventListener('click', openModal);

  function matches(o) {
    const t = state.term;
    if (!t) return true;
    const hay = `${o.customer || ''} ${o.note || ''} ${o.recipeName || ''}`.toLowerCase();
    return hay.includes(t);
  }

  function renderList() {
    listWrap.innerHTML = '';
    const filtered = orders.filter(matches);
    countLabel.textContent = `${filtered.length} položek`;

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = labels.emptyOrders || 'Žádné zakázky.';
      listWrap.appendChild(empty);
      return;
    }

    const sorted = sortBy(filtered, (o) => (o.dueDate || ''));

    sorted.forEach((o) => {
      const block = document.createElement('div');
      block.className = 'materials-item';

      const title = document.createElement('div');
      title.className = 'materials-item-title';
      title.textContent = `${o.customer || 'Zakázka'} — ${o.recipeName || ''}`.trim();

      const meta = document.createElement('div');
      meta.className = 'materials-params';
      const due = o.dueDate ? `Termín: ${o.dueDate}` : 'Termín: —';
      const qty = o.quantity ? `Množství: ${o.quantity} kg` : 'Množství: —';
      meta.textContent = `${due} | ${qty}`;

      const note = document.createElement('div');
      note.className = 'materials-note';
      note.textContent = o.note || '—';

      const actions = document.createElement('div');
      actions.className = 'materials-actions';

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger production-btn production-btn-danger production-btn-sm';
      del.textContent = labels.delete || 'Smazat';
      del.addEventListener('click', () => {
        const next = orders.filter((item) => item.id !== o.id);
        saveList(STORAGE_KEYS.orders, next);
        if (typeof onCountChange === 'function') onCountChange(next.length);
        showToast('Zakázka odstraněna.');
        renderOrders(container, { labels, onCountChange });
      });

      actions.appendChild(del);

      block.appendChild(title);
      block.appendChild(meta);
      block.appendChild(note);
      block.appendChild(actions);

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

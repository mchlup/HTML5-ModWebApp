import { showToast } from '../../core/uiService.js';
import { createCard, loadList, renderEmptyState, saveList, STORAGE_KEYS, sortBy } from './shared.js';

export function renderOrders(container, { labels, onCountChange } = {}) {
  const recipes = loadList(STORAGE_KEYS.recipes);
  const orders = loadList(STORAGE_KEYS.orders);

  const grid = document.createElement('div');
  grid.className = 'form-grid crm-grid';

  const formCard = createCard(
    labels.addOrder,
    labels.ordersIntro ||
      'Zadejte zakázku zákazníka a přiřaďte k ní konkrétní recepturu.'
  );
  if (!recipes.length) {
    const emptyText =
      labels.emptyOrdersCreateHint ||
      'Pro založení zakázky vytvořte nejdříve recepturu.';
    renderEmptyState(formCard, emptyText);
  } else {
    const form = document.createElement('form');
    form.className = 'form-grid crm-two-col';
    form.innerHTML = `
      <label>Zákazník<input name="customer" required placeholder="Malířství Novák" /></label>
      <label>Kontaktní osoba<input name="contact" placeholder="jan.novak@example.com" /></label>
      <label>Receptura
        <select name="recipeId" required>
          ${recipes
            .map((r) => `<option value="${r.id}">${r.name}${r.shade ? ` — ${r.shade}` : ''}</option>`)
            .join('')}
        </select>
      </label>
      <label>Množství (kg)<input name="quantity" type="number" min="1" step="1" placeholder="250" /></label>
      <label>Termín výroby<input name="dueDate" type="date" /></label>
      <label>Poznámka k zakázce<textarea name="note" rows="2" placeholder="Dodat na stavbu v týdnu 32, balení 25 kg."></textarea></label>
    `;

    const actionRow = document.createElement('div');
    actionRow.className = 'form-actions';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Uložit zakázku';
    submitBtn.classList.add('crm-btn', 'crm-btn-primary');
    actionRow.appendChild(submitBtn);

    form.appendChild(actionRow);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);

      const recipeId = fd.get('recipeId');
      const recipeExists = recipes.some((r) => r.id === recipeId);
      if (!recipeExists) {
        showToast('Zvolená receptura již není k dispozici.', {
          type: 'error',
        });
        return;
      }

      const entry = {
        id: crypto.randomUUID(),
        customer: fd.get('customer'),
        contact: fd.get('contact'),
        recipeId: fd.get('recipeId'),
        quantity: parseFloat(fd.get('quantity')) || null,
        dueDate: fd.get('dueDate'),
        status: 'Nová',
        note: fd.get('note'),
        createdAt: new Date().toISOString(),
      };

      const next = [...orders, entry];
      saveList(STORAGE_KEYS.orders, next);
      if (typeof onCountChange === 'function') onCountChange(next.length);
      showToast('Zakázka uložena.');
      renderOrders(container, { labels, onCountChange });
    });

    formCard.appendChild(form);
  }
  grid.appendChild(formCard);

  const listCard = createCard(
    labels.ordersListTitle || 'Zakázky',
    labels.ordersListSubtitle || 'Rozpracované a dokončené zákaznické receptury.'
  );
  
  if (!orders.length) {
    renderEmptyState(listCard, labels.emptyOrders);
  } else {
    const table = document.createElement('table');
    table.className = 'striped crm-table';
    const head = document.createElement('thead');
    head.innerHTML = `
      <tr>
        <th>Zákazník</th>
        <th>Receptura</th>
        <th>Množství</th>
        <th>Termín</th>
        <th>Stav</th>
        <th></th>
      </tr>
    `;
    table.appendChild(head);

    const tbody = document.createElement('tbody');

    // seřadíme zakázky podle termínu – nejbližší termín nahoře
    const sortedOrders = sortBy(
      orders,
      (o) => o.dueDate || '',
      'asc'
    );

    sortedOrders.forEach((order) => {
      const recipe = recipes.find((r) => r.id === order.recipeId);
      const recipeLabel = recipe
        ? `${recipe.name}${recipe.shade ? ` — ${recipe.shade}` : ''}`
        : 'Receptura nenalezena';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${order.customer}</td>
        <td>${recipeLabel}</td>
        <td>${order.quantity ? `${order.quantity} kg` : '—'}</td>
        <td>${order.dueDate || '—'}</td>
        <td>${order.status}</td>
        <td class="form-actions"><button type="button" class="danger crm-btn crm-btn-danger crm-btn-sm">${labels.delete}</button></td>
      `;
      row.querySelector('button')?.addEventListener('click', () => {
        const nextList = orders.filter((o) => o.id !== order.id);
        saveList(STORAGE_KEYS.orders, nextList);
        if (typeof onCountChange === 'function') onCountChange(nextList.length);
        showToast('Zakázka odstraněna.');
        renderOrders(container, { labels, onCountChange });
      });
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    listCard.appendChild(table);
  }
  grid.appendChild(listCard);

  container.innerHTML = '';
  container.appendChild(grid);
}

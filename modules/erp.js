const STORAGE_KEY = "erp_orders_v1";

function loadOrders(defaultCurrency) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [
        { id: 1001, customer: "Firma A", total: 5000, currency: defaultCurrency || "CZK" },
        { id: 1002, customer: "Firma B", total: 7500, currency: defaultCurrency || "CZK" },
      ];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn("ERP: chyba při čtení localStorage:", err);
    return [];
  }
}

function saveOrders(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("ERP: chyba při zápisu do localStorage:", err);
  }
}

export function renderErp(container, ctx) {
  const moduleCfg =
    ctx && ctx.appConfig && ctx.appConfig.moduleConfig
      ? ctx.appConfig.moduleConfig.erp || {}
      : {};
  const defaultCurrency = moduleCfg.defaultCurrency || "CZK";

  let orders = loadOrders(defaultCurrency);

  const info = document.createElement("p");
  info.className = "muted";
  info.textContent =
    "Ukázkový přehled objednávek – data jsou opět jen v localStorage.";
  container.appendChild(info);

  const table = document.createElement("table");
  table.className = "table";

  const thead = document.createElement("thead");
  thead.innerHTML =
    "<tr><th>Číslo</th><th>Zákazník</th><th>Celkem</th><th>Měna</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);

  function redraw() {
    tbody.innerHTML = "";
    orders.forEach((o) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${o.id}</td><td>${o.customer}</td><td>${o.total}</td><td>${o.currency}</td>`;
      tbody.appendChild(tr);
    });
  }

  redraw();

  container.appendChild(table);
}

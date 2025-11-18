import { registerModule } from "../../core/moduleRegistry.js";

const ERP_META = {
  id: "erp",
  iconClass: "fa-solid fa-boxes-stacked",
  labels: {
    cs: "ERP – objednávky",
    en: "ERP – Orders",
  },
  navItems: [
    {
      id: "main",
      labels: {
        cs: "Objednávky",
        en: "Orders",
      },
    },
  ],
};

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

function renderErp(container, ctx) {
  const moduleCfg =
    ctx && ctx.appConfig && ctx.appConfig.moduleConfig
      ? ctx.appConfig.moduleConfig.erp || {}
      : {};
  const defaultCurrency = moduleCfg.defaultCurrency || "CZK";

  const lang = (ctx && ctx.language) || "cs";
  const subId = (ctx && ctx.currentSubId) || "main";

  let orders = loadOrders(defaultCurrency);

  const info = document.createElement("p");
  info.className = "muted";
  info.textContent =
    lang === "en"
      ? "Sample orders – data are stored only in localStorage."
      : "Ukázkový přehled objednávek – data jsou opět jen v localStorage.";
  container.appendChild(info);

  if (subId === "main") {
    const table = document.createElement("table");
    table.className = "table";

    const thead = document.createElement("thead");
    thead.innerHTML =
      lang === "en"
        ? "<tr><th>Number</th><th>Customer</th><th>Total</th><th>Currency</th></tr>"
        : "<tr><th>Číslo</th><th>Zákazník</th><th>Celkem</th><th>Měna</th></tr>";
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
}

registerModule({
  id: ERP_META.id,
  meta: ERP_META,
  render: renderErp,
});

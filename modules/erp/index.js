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

function loadOrders(defaultCurrency) {
  void defaultCurrency;
  return [];
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
      ? "Sample orders – data are stored in the shared database."
      : "Ukázkový přehled objednávek – data jsou ukládána ve sdílené databázi.";
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

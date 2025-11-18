import { registerModule } from "../../core/moduleRegistry.js";

const CRM_META = {
  id: "crm",
  iconClass: "fa-solid fa-address-book",
  labels: {
    cs: "CRM – zákazníci",
    en: "CRM – Customers",
  },
  navItems: [
    {
      id: "main",
      labels: {
        cs: "Přehled",
        en: "Overview",
      },
    },
  ],
};

function loadCustomers(defaultCity) {
  void defaultCity;
  return [];
}

function saveCustomers(list) {
  void list;
}

function renderCrm(container, ctx) {
  const moduleCfg =
    ctx && ctx.appConfig && ctx.appConfig.moduleConfig
      ? ctx.appConfig.moduleConfig.crm || {}
      : {};
  const defaultCity = moduleCfg.defaultCity || "Praha";

  const lang = (ctx && ctx.language) || "cs";
  const subId = (ctx && ctx.currentSubId) || "main";

  let customers = loadCustomers(defaultCity);

  const info = document.createElement("p");
  info.className = "muted";
  info.textContent =
    lang === "en"
      ? "Data is stored in the shared database."
      : "Data jsou ukládána ve sdílené databázi.";
  container.appendChild(info);

  if (subId === "main") {
    const form = document.createElement("form");
    form.className = "form-inline";

    const inputName = document.createElement("input");
    inputName.name = "name";
    inputName.placeholder = lang === "en" ? "Company name" : "Název firmy";
    inputName.required = true;

    const inputCity = document.createElement("input");
    inputCity.name = "city";
    inputCity.placeholder = lang === "en" ? "City" : "Město";
    inputCity.value = defaultCity;

    const btn = document.createElement("button");
    btn.type = "submit";
    btn.textContent = lang === "en" ? "Add" : "Přidat";

    form.appendChild(inputName);
    form.appendChild(inputCity);
    form.appendChild(btn);

    const table = document.createElement("table");
    table.className = "table";

    const thead = document.createElement("thead");
    thead.innerHTML = lang === "en"
      ? "<tr><th>ID</th><th>Company</th><th>City</th></tr>"
      : "<tr><th>ID</th><th>Firma</th><th>Město</th></tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    function redraw() {
      tbody.innerHTML = "";
      customers.forEach((c) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${c.id}</td><td>${c.name}</td><td>${c.city || ""}</td>`;
        tbody.appendChild(tr);
      });
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = inputName.value.trim();
      const city = inputCity.value.trim() || defaultCity;
      if (!name) return;
      const nextId = customers.length ? customers[customers.length - 1].id + 1 : 1;
      const customer = { id: nextId, name, city };
      customers = [...customers, customer];
      saveCustomers(customers);
      redraw();
      inputName.value = "";
      inputCity.value = defaultCity;
    });

    container.appendChild(form);
    container.appendChild(table);
    redraw();
  }
}

registerModule({
  id: CRM_META.id,
  meta: CRM_META,
  render: renderCrm,
});

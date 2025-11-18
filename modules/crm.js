const STORAGE_KEY = "crm_customers_v1";

function loadCustomers(defaultCity) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [
        { id: 1, name: "Firma A", city: defaultCity || "Praha" },
        { id: 2, name: "Firma B", city: "Brno" },
      ];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn("CRM: chyba při čtení localStorage:", err);
    return [];
  }
}

function saveCustomers(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("CRM: chyba při zápisu do localStorage:", err);
  }
}

export function renderCrm(container, ctx) {
  const moduleCfg =
    ctx && ctx.appConfig && ctx.appConfig.moduleConfig
      ? ctx.appConfig.moduleConfig.crm || {}
      : {};
  const defaultCity = moduleCfg.defaultCity || "Praha";

  let customers = loadCustomers(defaultCity);

  const info = document.createElement("p");
  info.className = "muted";
  info.textContent =
    "Data jsou ukládána jen do localStorage v prohlížeči (žádný backend).";
  container.appendChild(info);

  const form = document.createElement("form");
  form.className = "form-inline";

  const inputName = document.createElement("input");
  inputName.name = "name";
  inputName.placeholder = "Název firmy";
  inputName.required = true;

  const inputCity = document.createElement("input");
  inputCity.name = "city";
  inputCity.placeholder = "Město";
  inputCity.value = defaultCity;

  const btn = document.createElement("button");
  btn.type = "submit";
  btn.textContent = "Přidat";

  form.appendChild(inputName);
  form.appendChild(inputCity);
  form.appendChild(btn);

  const table = document.createElement("table");
  table.className = "table";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>ID</th><th>Firma</th><th>Město</th></tr>";
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

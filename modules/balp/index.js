import { registerModule } from "../../core/moduleRegistry.js";

const BALP_META = {
  id: "balp",
  iconClass: "fa-solid fa-flask",
  labels: {
    cs: "BALP v2",
    en: "BALP v2",
  },
  navItems: [
    { id: "suroviny", labels: { cs: "Suroviny", en: "Raw materials" } },
    { id: "polotovary", labels: { cs: "Polotovary", en: "Intermediates" } },
    { id: "naterove-hmoty", labels: { cs: "Nátěrové hmoty", en: "Coatings" } },
  ],
};

function renderSuroviny(container, lang) {
  const h = document.createElement("h3");
  h.textContent = lang === "en" ? "Raw materials" : "Suroviny";
  container.appendChild(h);

  const table = document.createElement("table");
  table.className = "table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["ID", lang === "en" ? "Name" : "Název", lang === "en" ? "Supplier" : "Dodavatel"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  head.appendChild(headRow);
  table.appendChild(head);

  const tbody = document.createElement("tbody");
  const rows = [
    ["1", "Pryskyřice A", "Dodavatel X"],
    ["2", "Rozpouštědlo B", "Dodavatel Y"],
  ];
  rows.forEach((cells) => {
    const tr = document.createElement("tr");
    cells.forEach((c) => {
      const td = document.createElement("td");
      td.textContent = c;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.appendChild(table);
}

function renderPolotovary(container, lang) {
  const h = document.createElement("h3");
  h.textContent = lang === "en" ? "Intermediates" : "Polotovary";
  container.appendChild(h);

  const p = document.createElement("p");
  p.className = "muted";
  p.textContent =
    lang === "en"
      ? "Here you can manage intermediate products."
      : "Zde můžeš spravovat polotovary.";
  container.appendChild(p);
}

function renderNateroveHmoty(container, lang) {
  const h = document.createElement("h3");
  h.textContent = lang === "en" ? "Coatings" : "Nátěrové hmoty";
  container.appendChild(h);

  const p = document.createElement("p");
  p.className = "muted";
  p.textContent =
    lang === "en"
      ? "Here you can manage final coating products."
      : "Zde můžeš spravovat finální nátěrové hmoty.";
  container.appendChild(p);
}

function render(container, ctx) {
  const lang = (ctx && ctx.language) || "cs";
  const subId = (ctx && ctx.currentSubId) || "suroviny";
  const info = document.createElement("p");
  info.className = "muted";
  info.textContent =
    lang === "en"
      ? "BALP v2 demo module – data are stored in the database."
      : "BALP v2 demo modul – data jsou ukládána do databáze.";
  container.appendChild(info);

  if (subId === "suroviny") {
    renderSuroviny(container, lang);
  } else if (subId === "polotovary") {
    renderPolotovary(container, lang);
  } else if (subId === "naterove-hmoty") {
    renderNateroveHmoty(container, lang);
  } else {
    renderSuroviny(container, lang);
  }
}

export default {
  register({ config, translations } = {}) {
    registerModule("balp", {
      id: "balp",
      meta: { ...BALP_META, translations, config },
      render,
    });
  },
  meta: BALP_META,
  render,
};

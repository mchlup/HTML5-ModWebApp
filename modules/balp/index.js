import { registerModule } from "../../core/moduleRegistry.js";

const BALP_META = {
  id: "balp",
  iconClass: "fa-solid fa-flask",
  labels: {
    cs: "BALP v2",
    en: "BALP v2",
  },
  navItems: [
    {
      id: "suroviny",
      labels: {
        cs: "Suroviny",
        en: "Raw materials",
      },
    },
    {
      id: "polotovary",
      labels: {
        cs: "Polotovary",
        en: "Intermediates",
      },
    },
    {
      id: "naterove-hmoty",
      labels: {
        cs: "Nátěrové hmoty",
        en: "Coatings",
      },
    },
  ],
};

function renderSuroviny(container, lang) {
  const h = document.createElement("h3");
  h.textContent = lang === "en" ? "Raw materials" : "Suroviny";
  container.appendChild(h);

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML =
    lang === "en"
      ? "<thead><tr><th>ID</th><th>Name</th><th>Supplier</th></tr></thead>"
      : "<thead><tr><th>ID</th><th>Název</th><th>Dodavatel</th></tr></thead>";

  const tbody = document.createElement("tbody");
  tbody.innerHTML = `
    <tr><td>1</td><td>Pryskyřice A</td><td>Dodavatel X</td></tr>
    <tr><td>2</td><td>Rozpouštědlo B</td><td>Dodavatel Y</td></tr>
  `;
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

function renderBalp(container, ctx) {
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

registerModule({
  id: BALP_META.id,
  meta: BALP_META,
  render: renderBalp,
});


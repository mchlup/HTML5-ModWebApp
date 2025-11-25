import labels from "./lang_cs.js";
import { registerModule } from "../../core/moduleRegistry.js";
import { showToast } from "../../core/uiService.js";

// Jednoduchý loader logů – můžeš později napojit na skutečný backend endpoint.
async function fetchLogs() {
  try {
    const res = await fetch("./config/logs.php", { credentials: "same-origin" });
    if (!res.ok) {
      throw new Error("Načtení logů selhalo");
    }
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || "Načtení logů selhalo");
    }
    return Array.isArray(data.logs) ? data.logs : [];
  } catch (err) {
    console.warn("Chyba při načítání logů", err);
    return [];
  }
}

function render(container, context = {}) {
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "logs-module";

  const title = document.createElement("h1");
  title.textContent = labels.title;
  wrap.appendChild(title);

  const table = document.createElement("table");
  table.className = "logs-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>${labels.time}</th>
      <th>${labels.level}</th>
      <th>${labels.user}</th>
      <th>${labels.message}</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);

  wrap.appendChild(table);
  container.appendChild(wrap);

  fetchLogs().then((logs) => {
    tbody.innerHTML = "";
    if (!logs.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = labels.empty;
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    logs.forEach((log) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${log.time || ""}</td>
        <td>${log.level || ""}</td>
        <td>${log.user || ""}</td>
        <td>${log.message || ""}</td>
      `;
      tbody.appendChild(row);
    });
  }).catch((err) => {
    console.error(err);
    showToast("Nepodařilo se načíst logy.", { type: "error" });
  });
}

export default {
  register() {
    registerModule("logs", {
      id: "logs",
      meta: { iconClass: "fa-solid fa-clipboard-list", labels: { cs: labels.title } },
      render,
    });
  },
  meta: { iconClass: "fa-solid fa-clipboard-list", labels: { cs: labels.title } },
  render,
};


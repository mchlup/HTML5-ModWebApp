# "Flexo" - Modulární Webová Aplikace

Tato verze obsahuje rozšířené **jádro aplikace** (core služby), aby byla appka robustní a připravená na budoucí rozšiřování:
- automatická detekce modulů podle složek v `/modules`,
- centrální **storageService**, **uiService**, **eventBus**,
- základ **permissionService**, **i18n**, **versionService**, **serviceRegistry**,
- vylepšené switchování **světlý / tmavý režim**.

Aplikace stále funguje jako **čistě statická HTML5 app** + jednoduché PHP (`config/modules.php`) na straně serveru pro zjištění seznamu modulů.

## Jak přidat nový modul

1. Vytvoř složku v `modules`, např.:

```text
modules/marketing/
```

2. Přidej soubor `modules/marketing/index.js`:

```js
import { registerModule } from "../../core/moduleRegistry.js";

const META = {
  id: "marketing",
  iconClass: "fa-solid fa-bullhorn",
  labels: { cs: "Marketing", en: "Marketing" },
  navItems: [
    { id: "overview", labels: { cs: "Přehled", en: "Overview" } }
  ],
};

function renderMarketing(container, ctx) {
  container.innerHTML = "<p>Marketing modul funguje.</p>";
}

registerModule({
  id: META.id,
  meta: META,
  render: renderMarketing,
});
```

3. Není potřeba upravovat žádný core soubor ani konfiguraci – `config/modules.php` modul automaticky najde a frontend ho načte.

## Spuštění na Synology / nginx

1. Rozbal tento balíček (např. `html5_modapp_v9`) do webového adresáře.
2. V nginx / WebStation nastav root na tuto složku a povol PHP.
3. Otevři v prohlížeči adresu NASu – aplikace se načte a moduly se zjistí automaticky.

## Core služby ve verzi v9

- `core/storageService.js` – jednotné ukládání hodnot (globálně, per modul, per user) nad localStorage.
- `core/uiService.js` – toast notifikace a základní confirm dialog.
- `core/eventBus.js` – jednoduchý pub/sub mezi moduly (emit/on).
- `core/permissionService.js` – kostra systému práv (zatím jednoduchá logika založená na roli).
- `core/i18n.js` – registrační a překladový engine pro budoucí i18n.
- `core/versionService.js` – verze aplikace + hook pro migrace dat.
- `core/serviceRegistry.js` – registr sdílených služeb, aby je mohly moduly pohodlně využívat.
- `core/moduleRegistry.js` – rozšířený registr modulů + podpora init hooků.

Struktura projektu je stále jednoduchá a přehledná, připravená na další rozšiřování podle tvých potřeb.

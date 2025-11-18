Statický skeleton modulární CRM/ERP aplikace – refaktor jádra
=============================================================

Tato verze NEPOTŘEBUJE žádný build ani npm. 
Jsou to čisté statické soubory (HTML, JS ES moduly, CSS).

Klíčové vlastnosti:
- Přihlašovací stránka (super-admin) před vstupem do aplikace.
- Super-admin definován v `config/app.json`.
- Jádro rozdělené na:
    - `core/configService.js` – načítání a ukládání konfigurace (app_config_v2, app.json)
    - `core/authService.js`   – práce s aktuálním uživatelem a přihlášením super-admina
- `modules/config.js` je klient UI pro konfiguraci (moduly, uživatelé, náčrt oprávnění).
- CRM a ERP moduly umí číst modulovou konfiguraci (např. výchozí město/měnu).

Struktura:
- index.html
- styles.css
- app.js                 – shell aplikace, používá configService + authService
- config/app.json        – globální konfigurace (superAdmin, defaultEnabledModules, modulové defaulty)
- config/modules.json    – výchozí seznam modulů (doplněk)
- core/router.js         – jednoduchý hash router (#/crm, #/erp, #/config)
- core/modules.js        – registr modulů
- core/configService.js  – služba pro konfiguraci
- core/authService.js    – služba pro přihlášení
- modules/crm.js         – CRM modul (localStorage, respektuje defaultCity z konfigurace)
- modules/erp.js         – ERP modul (localStorage, respektuje defaultCurrency)
- modules/config.js      – konfigurační modul (moduly, uživatelé, náčrt oprávnění)

Nasazení:
1. Celý obsah této složky nahraj do webrootu na NAS (např. /volume1/web/html5).
2. V nginx / Web Station nastav root na tuto složku (tu, kde leží index.html).
3. Otevři v prohlížeči http(s)://tvoje-domena/ nebo IP.

Aplikace používá hash routing (URL ve tvaru http://host/#/crm), 
takže není nutná speciální nginx konfigurace kvůli routování.

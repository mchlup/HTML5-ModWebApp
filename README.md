# HTML5-ModWebApp

Moderní modulární webová aplikace založená na čistém JavaScriptu,
vlastním jádře, responzivním UI a PHP backendu.\
Projekt je navržen tak, aby bylo možné přidávat nové funkce pouhým
vytvořením nové složky v `modules/`, bez nutnosti úprav jinde v
aplikaci.

Aplikace obsahuje dynamické načítání modulů, runtime konfigurace, správu
uživatelů, oprávnění, podporu super-admina, CRM funkce a demonstrační
rozšiřující modul.

## 📁 Struktura projektu

    html5/
    ├── index.html
    ├── app.js
    ├── styles.css
    │
    ├── core/
    │   ├── auth/
    │   ├── config/
    │   ├── utils/
    │   └── ui/
    │
    ├── config/
    │   ├── database.php
    │   ├── modules.json
    │   └── runtime.json
    │
    ├── modules/
    │   ├── BALP/
    │   ├── crm/
    │   └── ...
    │
    └── backend/
        ├── api/
        └── db/

## ✨ Hlavní vlastnosti

### 🔌 Automatické načítání modulů

-   nový modul = složka v `modules/`\
-   minimální soubor: `index.js`\
-   aplikace modul sama registruje do `config/modules.json`\
-   volitelné: `config.js`, jazykové soubory, UI komponenty

### 🧠 Robustní jádro aplikace

-   sjednocené služby a utility\
-   modernizované UI komponenty\
-   opravené chování navigačního menu\
-   ukládání stavu aplikace (runtime, téma, session)

### 🎨 Dark / Light režim

-   kompletně přepracovaná logika\
-   trvalé uložení preferencí uživatele

### 🔐 Autentizace a role

-   podpora super-admina i bez databáze\
-   automatické dotahování oprávnění z DB\
-   přehledné chybové stavy

### 📦 CRM modul

-   evidence surovin a položek\
-   responzivní UI pro stovky záznamů\
-   přidávání, úpravy, mazání, rozšířené parametry\
-   modernější rozložení polí

## 🚀 Instalace

### 1. Nahrání projektu

Nakopírujte projekt na server:

    /var/www/html/html5/

### 2. Nastavení backendu

-   upravte `config/database.php`
-   ověřte práva zápisu do `config/`
-   v administraci klikněte na **Založit tabulky**

### 3. Spuštění

    http://localhost/html5/

## 🧩 Jak vytvořit nový modul

1.  Vytvořte složku:

```{=html}
<!-- -->
```
    modules/MujModul/

2.  Přidejte soubor:

```{=html}
<!-- -->
```
    index.js

3.  (Volitelné) Přidejte `config.js`, jazykové soubory, UI.

4.  Po refreshi aplikace:

-   modul se objeví v `modules.json`\
-   automaticky se načte\
-   zobrazí se v menu (pokud obsahuje UI)

## ⚙️ Backend API

Backend poskytuje: - CRUD operace\
- správu uživatelů\
- práci s runtime konfigurací\
- inicializaci databáze\
- endpointy pro moduly

## 🛠 Vývoj

### Lokální spuštění bez Apache:

    php -S localhost:8080

### Debug mód:

V `config/runtime.json` nastavte:

``` json
{ "debug": true }
```

## 📚 Budoucí rozšíření

-   systém šablon pro rychlou tvorbu modulů\
-   více jazykových mutací\
-   migrace databáze\
-   modulární témata\
-   generátor dokumentace pro moduly

## 🔒 Licence

Projekt může být uvolněn pod licencí MIT nebo jinou dle potřeby.

-- modules/crm/schema.sql
-- CRM schema pro modul "crm" - vyroba a prodej naterovych hmot
-- Navrzeno pro MySQL/MariaDB (InnoDB, utf8mb4).

CREATE TABLE IF NOT EXISTS crm_materials (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  supplier VARCHAR(255) NULL,
  price DECIMAL(12,2) NULL,          -- cena / kg
  density DECIMAL(10,3) NULL,        -- hustota (g/cm3)
  solids DECIMAL(5,2) NULL,          -- susina v %
  okp VARCHAR(50) NULL,              -- OKP / VOC kategorie nebo jiny kod
  oil VARCHAR(100) NULL,             -- typ oleje / olejova faze
  voc DECIMAL(10,3) NULL,            -- VOC (g/l)
  safety VARCHAR(255) NULL,          -- napr. H315, H319
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_crm_materials_code (code),
  KEY idx_crm_materials_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS crm_intermediates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NULL,
  base VARCHAR(100) NULL,            -- napr. vodou reditelny / rozpoustedlovy zaklad
  solids DECIMAL(5,2) NULL,          -- susina v %
  viscosity DECIMAL(10,2) NULL,      -- viskozita (mPa·s)
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS crm_intermediate_components (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  intermediate_id INT UNSIGNED NOT NULL,
  material_id INT UNSIGNED NOT NULL,
  share DECIMAL(5,2) NOT NULL,       -- podil v %
  CONSTRAINT fk_crm_intermediate_components_intermediate
    FOREIGN KEY (intermediate_id) REFERENCES crm_intermediates(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_crm_intermediate_components_material
    FOREIGN KEY (material_id) REFERENCES crm_materials(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS crm_recipes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  shade VARCHAR(100) NULL,           -- odstin
  gloss VARCHAR(100) NULL,           -- lesk
  batch_size DECIMAL(10,2) NULL,     -- davka v kg
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS crm_recipe_components (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT UNSIGNED NOT NULL,
  component_type ENUM('material','intermediate') NOT NULL,
  component_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,3) NOT NULL,     -- mnozstvi v davce
  CONSTRAINT fk_crm_recipe_components_recipe
    FOREIGN KEY (recipe_id) REFERENCES crm_recipes(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS crm_orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer VARCHAR(255) NOT NULL,
  contact VARCHAR(255) NULL,
  recipe_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(10,2) NULL,       -- mnozstvi v kg
  due_date DATE NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'nova',
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_crm_orders_recipe
    FOREIGN KEY (recipe_id) REFERENCES crm_recipes(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- MIGRACE PRO STARE INSTALACE
-- Pokud tabulka crm_materials existuje, ale nema nove sloupce, timhle se doplni.
ALTER TABLE crm_materials
  ADD COLUMN IF NOT EXISTS solids DECIMAL(5,2) NULL AFTER density,
  ADD COLUMN IF NOT EXISTS okp VARCHAR(50) NULL AFTER solids,
  ADD COLUMN IF NOT EXISTS oil VARCHAR(100) NULL AFTER okp;


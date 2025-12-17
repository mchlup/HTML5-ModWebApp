-- modules/production/schema.sql
-- production schema pro modul "production" - výroba a prodej nátěrových hmot
-- MySQL/MariaDB (InnoDB, utf8mb4)

-- ----------------------------
-- SUROVINY
-- ----------------------------
CREATE TABLE IF NOT EXISTS production_materials (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  supplier VARCHAR(255) NULL,
  price DECIMAL(12,2) NULL,          -- cena / kg
  density DECIMAL(10,3) NULL,        -- hustota (g/cm3)
  solids DECIMAL(5,2) NULL,          -- sušina v %
  okp VARCHAR(50) NULL,              -- OKP / VOC kategorie nebo jiný kód
  oil VARCHAR(100) NULL,             -- typ oleje / olejová fáze
  voc DECIMAL(10,3) NULL,            -- VOC (g/l)
  safety VARCHAR(255) NULL,          -- např. H315, H319
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_production_materials_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migrace pro staré instalace (suroviny)
ALTER TABLE production_materials
  ADD COLUMN IF NOT EXISTS supplier VARCHAR(255) NULL AFTER name,
  ADD COLUMN IF NOT EXISTS price DECIMAL(12,2) NULL AFTER supplier,
  ADD COLUMN IF NOT EXISTS density DECIMAL(10,3) NULL AFTER price,
  ADD COLUMN IF NOT EXISTS solids DECIMAL(5,2) NULL AFTER density,
  ADD COLUMN IF NOT EXISTS okp VARCHAR(50) NULL AFTER solids,
  ADD COLUMN IF NOT EXISTS oil VARCHAR(100) NULL AFTER okp,
  ADD COLUMN IF NOT EXISTS voc DECIMAL(10,3) NULL AFTER oil,
  ADD COLUMN IF NOT EXISTS safety VARCHAR(255) NULL AFTER voc,
  ADD COLUMN IF NOT EXISTS note TEXT NULL AFTER safety,
  ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ----------------------------
-- RECEPTURY
-- ----------------------------
CREATE TABLE IF NOT EXISTS production_recipes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  shade VARCHAR(100) NULL,
  gloss VARCHAR(100) NULL,
  batch_size DECIMAL(10,2) NULL,      -- základní velikost šarže (kg)
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Složení receptury (komponenty)
-- component_type: 'material' | 'intermediate'
CREATE TABLE IF NOT EXISTS production_recipe_components (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT UNSIGNED NOT NULL,
  component_type VARCHAR(30) NOT NULL,
  component_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12,4) NOT NULL,      -- množství v kg (v rámci batch_size)
  KEY idx_production_recipe_components_recipe (recipe_id),
  CONSTRAINT fk_production_recipe_components_recipe
    FOREIGN KEY (recipe_id) REFERENCES production_recipes(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- ZAKÁZKY
-- ----------------------------
CREATE TABLE IF NOT EXISTS production_orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NULL,              -- Zyy#### (generováno)
  customer_id INT UNSIGNED NULL,      -- odkaz na customers modul (bez FK)
  customer_name VARCHAR(255) NULL,
  customer VARCHAR(255) NULL,         -- kompatibilita se starší strukturou
  contact VARCHAR(255) NULL,
  recipe_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(10,2) NULL,        -- množství v kg
  due_date DATE NULL,
  production_date DATE NULL,          -- kompatibilita / alternativní název termínu
  status VARCHAR(50) NOT NULL DEFAULT 'nova',
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_production_orders_recipe (recipe_id),
  KEY idx_production_orders_code (code),
  CONSTRAINT fk_production_orders_recipe
    FOREIGN KEY (recipe_id) REFERENCES production_recipes(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migrace pro staré instalace (zakázky)
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS code VARCHAR(10) NULL AFTER id,
  ADD COLUMN IF NOT EXISTS customer_id INT UNSIGNED NULL AFTER code,
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255) NULL AFTER customer_id,
  ADD COLUMN IF NOT EXISTS customer VARCHAR(255) NULL AFTER customer_name,
  ADD COLUMN IF NOT EXISTS production_date DATE NULL AFTER due_date;

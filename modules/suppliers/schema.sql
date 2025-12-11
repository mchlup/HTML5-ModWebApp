-- modules/suppliers/schema.sql
-- Centrální tabulka dodavatelů sdílená napříč moduly.

CREATE TABLE IF NOT EXISTS app_suppliers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NULL,
  contact_person VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  website VARCHAR(255) NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  UNIQUE KEY uniq_app_suppliers_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

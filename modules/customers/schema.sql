-- modules/customers/schema.sql
-- customers schema pro modul "customers" - centralni evidence zakazniku
-- Navrzeno pro MySQL/MariaDB (InnoDB, utf8mb4).

CREATE TABLE IF NOT EXISTS customers_customers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  ico VARCHAR(32) NULL,
  dic VARCHAR(64) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  address TEXT NULL,
  note TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customers_customers_code (code),
  KEY idx_customers_customers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

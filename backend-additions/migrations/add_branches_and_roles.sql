-- =====================================================
-- Migration: Add Branches table + update users table
-- Run AFTER the initial schema and add_new_sections.sql
-- =====================================================

-- 1. Branches table
CREATE TABLE IF NOT EXISTS branches (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  code        VARCHAR(10)  UNIQUE,
  address     TEXT,
  phone       VARCHAR(30),
  email       VARCHAR(150),
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Add branch_id to users (nullable so existing rows don't break)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS branch_id INT NULL REFERENCES branches(id) ON DELETE SET NULL;

-- 3. Update role ENUM to new values
-- NOTE: If your users table uses an ENUM column for role, run this:
-- ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','branch_manager','lab_technician') NOT NULL DEFAULT 'lab_technician';
-- If it uses a VARCHAR, run:
-- ALTER TABLE users MODIFY COLUMN role VARCHAR(30) NOT NULL DEFAULT 'lab_technician';

-- 4. Instruments table
CREATE TABLE IF NOT EXISTS instruments (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  name                VARCHAR(200) NOT NULL,
  model               VARCHAR(150),
  serial_number       VARCHAR(100),
  manufacturer        VARCHAR(150),
  category_id         INT NULL REFERENCES categories(id) ON DELETE SET NULL,
  status              ENUM('Operational','Under Maintenance','Out of Service','Retired') NOT NULL DEFAULT 'Operational',
  location            VARCHAR(200),
  purchase_date       DATE,
  purchase_price      DECIMAL(12,2),
  supplier_id         INT NULL REFERENCES suppliers(id) ON DELETE SET NULL,
  warranty_expiry     DATE,
  last_calibration    DATE,
  next_calibration    DATE,
  notes               TEXT,
  branch_id           INT NULL REFERENCES branches(id) ON DELETE SET NULL,
  is_active           TINYINT(1) NOT NULL DEFAULT 1,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_instruments_status   ON instruments(status);
CREATE INDEX IF NOT EXISTS idx_instruments_branch   ON instruments(branch_id);
CREATE INDEX IF NOT EXISTS idx_instruments_calib    ON instruments(next_calibration);

-- 5. Orders table
CREATE TABLE IF NOT EXISTS orders (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  order_number        VARCHAR(30) NOT NULL UNIQUE,
  supplier_id         INT NULL REFERENCES suppliers(id) ON DELETE SET NULL,
  branch_id           INT NULL REFERENCES branches(id) ON DELETE SET NULL,
  status              ENUM('Draft','Submitted','Approved','Ordered','Received','Cancelled') NOT NULL DEFAULT 'Draft',
  expected_delivery   DATE,
  total_amount        DECIMAL(14,2),
  notes               TEXT,
  created_by          INT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_name   VARCHAR(250) NOT NULL,
  quantity    DECIMAL(12,3) NOT NULL,
  unit        VARCHAR(30) NOT NULL DEFAULT 'pcs',
  unit_price  DECIMAL(12,2),
  total_price DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes       TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_branch   ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_order_items_ord ON order_items(order_id);

-- 6. Add branch_id to stock-related tables
ALTER TABLE items       ADD COLUMN IF NOT EXISTS branch_id INT NULL REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE chemicals   ADD COLUMN IF NOT EXISTS branch_id INT NULL REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE equipment   ADD COLUMN IF NOT EXISTS branch_id INT NULL REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS branch_id INT NULL REFERENCES branches(id) ON DELETE SET NULL;

-- 7. Update transactions type to support new movement types
-- ALTER TABLE transactions MODIFY COLUMN type ENUM('PURCHASE','USAGE','BRANCH_TRANSFER','BRANCH_RECEIPT','EXPIRY_DISPOSAL','SUPPLIER_RETURN','ADJUSTMENT') NOT NULL;

-- Add missing columns to transactions if not present
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_number  VARCHAR(100);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS quantity_before   DECIMAL(12,3);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS quantity_after    DECIMAL(12,3);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS performed_by      INT NULL REFERENCES users(id) ON DELETE SET NULL;

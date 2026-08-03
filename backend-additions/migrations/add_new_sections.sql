-- ============================================================
-- Migration: Add new sections (Chemicals, Equipment, Maintenance, Borrowing)
-- + upgrade Categories table with type & parent_id
-- Run once against your PostgreSQL database.
-- ============================================================

-- 1. Upgrade categories table
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE categories
  ADD CONSTRAINT categories_type_check CHECK (type IN ('General', 'Glassware', 'Consumables', 'Chemicals', 'Equipment'));

CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- 2. Chemicals table
CREATE TABLE IF NOT EXISTS chemicals (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  cas_number        VARCHAR(50),
  molecular_formula VARCHAR(100),
  category_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  hazard_class      VARCHAR(50) CHECK (hazard_class IN (
    'Flammable', 'Corrosive', 'Toxic', 'Oxidizer', 'Explosive',
    'Irritant', 'Carcinogen', 'Environmental Hazard', 'Non-Hazardous'
  )),
  physical_state    VARCHAR(20) CHECK (physical_state IN ('Solid', 'Liquid', 'Gas', 'Solution')),
  concentration     VARCHAR(100),
  quantity          NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_quantity      NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit              VARCHAR(20) NOT NULL DEFAULT 'ml',
  location          VARCHAR(255),
  storage_temp      VARCHAR(100),
  supplier_id       INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  expiry_date       DATE,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chemicals_name ON chemicals(name);
CREATE INDEX IF NOT EXISTS idx_chemicals_category_id ON chemicals(category_id);
CREATE INDEX IF NOT EXISTS idx_chemicals_hazard_class ON chemicals(hazard_class);
CREATE INDEX IF NOT EXISTS idx_chemicals_is_active ON chemicals(is_active);

-- 3. Equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  model            VARCHAR(255),
  serial_number    VARCHAR(255),
  manufacturer     VARCHAR(255),
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'Available' CHECK (status IN (
    'Available', 'In Use', 'Under Maintenance', 'Retired'
  )),
  location         VARCHAR(255),
  purchase_date    DATE,
  purchase_price   NUMERIC(12,2),
  supplier_id      INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  warranty_expiry  DATE,
  last_calibration DATE,
  next_calibration DATE,
  notes            TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_name ON equipment(name);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_is_active ON equipment(is_active);

-- 4. Maintenance records table
CREATE TABLE IF NOT EXISTS maintenance_records (
  id           SERIAL PRIMARY KEY,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  type         VARCHAR(30) NOT NULL CHECK (type IN (
    'Preventive', 'Corrective', 'Calibration', 'Inspection'
  )),
  date         DATE NOT NULL,
  performed_by VARCHAR(255),
  description  TEXT NOT NULL,
  cost         NUMERIC(12,2),
  status       VARCHAR(30) NOT NULL DEFAULT 'Scheduled' CHECK (status IN (
    'Scheduled', 'In Progress', 'Completed', 'Cancelled'
  )),
  next_date    DATE,
  notes        TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_equipment_id ON maintenance_records(equipment_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_date ON maintenance_records(date);

-- 5. Borrow records table
CREATE TABLE IF NOT EXISTS borrow_records (
  id              SERIAL PRIMARY KEY,
  item_type       VARCHAR(20) NOT NULL CHECK (item_type IN ('Item', 'Glassware', 'Equipment')),
  item_id         INTEGER NOT NULL,
  borrower_name   VARCHAR(255) NOT NULL,
  borrower_id     VARCHAR(100),
  department      VARCHAR(255),
  quantity        INTEGER NOT NULL DEFAULT 1,
  borrow_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_return DATE,
  actual_return   DATE,
  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_borrow_item ON borrow_records(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_borrow_borrower ON borrow_records(borrower_name);
CREATE INDEX IF NOT EXISTS idx_borrow_actual_return ON borrow_records(actual_return);

-- 6. updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['chemicals', 'equipment', 'maintenance_records', 'borrow_records'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_' || tbl || '_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;

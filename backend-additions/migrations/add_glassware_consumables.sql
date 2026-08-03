-- ============================================================
-- Migration: Add Glassware and Consumables tables
-- Run: node migrations/migrate.js  (after copying this SQL into
--       migrations/init.sql, or run it directly with psql)
-- ============================================================

-- Glassware table
CREATE TABLE IF NOT EXISTS glassware (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(100),
    capacity DECIMAL(10,3),
    capacity_unit VARCHAR(10) DEFAULT 'ml',
    material VARCHAR(100) DEFAULT 'Borosilicate Glass',
    quantity INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 0,
    condition VARCHAR(20) DEFAULT 'Good' CHECK (condition IN ('Good', 'Fair', 'Poor', 'Broken')),
    location VARCHAR(100),
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    purchase_date DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consumables table
CREATE TABLE IF NOT EXISTS consumables (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100),
    batch_number VARCHAR(100),
    quantity DECIMAL(10,2) DEFAULT 0,
    min_quantity DECIMAL(10,2) DEFAULT 0,
    unit VARCHAR(50) DEFAULT 'box',
    pack_size INTEGER,
    expiry_date DATE,
    location VARCHAR(100),
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    price DECIMAL(12,2),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_glassware_type ON glassware(type);
CREATE INDEX IF NOT EXISTS idx_glassware_condition ON glassware(condition);
CREATE INDEX IF NOT EXISTS idx_consumables_category ON consumables(category);
CREATE INDEX IF NOT EXISTS idx_consumables_expiry ON consumables(expiry_date);

-- Triggers for updated_at
CREATE TRIGGER update_glassware_updated_at
  BEFORE UPDATE ON glassware
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consumables_updated_at
  BEFORE UPDATE ON consumables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

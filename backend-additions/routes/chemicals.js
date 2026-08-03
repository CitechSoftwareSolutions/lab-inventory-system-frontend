const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/chemicals
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, hazard_class, physical_state, category_id, low_stock, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const values = [];
    const conditions = ['c.is_active = TRUE'];

    if (search) { values.push(`%${search}%`); conditions.push(`(c.name ILIKE $${values.length} OR c.cas_number ILIKE $${values.length} OR c.molecular_formula ILIKE $${values.length})`); }
    if (hazard_class) { values.push(hazard_class); conditions.push(`c.hazard_class = $${values.length}`); }
    if (physical_state) { values.push(physical_state); conditions.push(`c.physical_state = $${values.length}`); }
    if (category_id) { values.push(category_id); conditions.push(`c.category_id = $${values.length}`); }
    if (low_stock === 'true') conditions.push(`c.quantity <= c.min_quantity`);

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(`SELECT COUNT(*) FROM chemicals c ${where}`, values);
    const total = parseInt(countResult.rows[0].count);

    values.push(limit, offset);
    const result = await pool.query(
      `SELECT c.*, cat.name AS category_name, s.name AS supplier_name
       FROM chemicals c
       LEFT JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN suppliers s ON s.id = c.supplier_id
       ${where}
       ORDER BY c.name
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    res.json({ items: result.rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/chemicals/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, cat.name AS category_name, s.name AS supplier_name
       FROM chemicals c
       LEFT JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN suppliers s ON s.id = c.supplier_id
       WHERE c.id = $1 AND c.is_active = TRUE`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/chemicals
router.post('/', authenticate, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const {
      name, cas_number, molecular_formula, category_id, hazard_class, physical_state,
      concentration, quantity = 0, min_quantity = 0, unit = 'ml',
      location, storage_temp, supplier_id, expiry_date, notes,
    } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const result = await pool.query(
      `INSERT INTO chemicals
        (name, cas_number, molecular_formula, category_id, hazard_class, physical_state,
         concentration, quantity, min_quantity, unit, location, storage_temp, supplier_id, expiry_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        name.trim(), cas_number || null, molecular_formula || null,
        category_id || null, hazard_class || null, physical_state || null,
        concentration || null, quantity, min_quantity, unit,
        location || null, storage_temp || null, supplier_id || null,
        expiry_date || null, notes || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/chemicals/:id — quantity not updated here (use transactions)
router.put('/:id', authenticate, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const {
      name, cas_number, molecular_formula, category_id, hazard_class, physical_state,
      concentration, min_quantity, unit, location, storage_temp, supplier_id, expiry_date, notes,
    } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const result = await pool.query(
      `UPDATE chemicals SET
        name=$1, cas_number=$2, molecular_formula=$3, category_id=$4, hazard_class=$5,
        physical_state=$6, concentration=$7, min_quantity=$8, unit=$9, location=$10,
        storage_temp=$11, supplier_id=$12, expiry_date=$13, notes=$14, updated_at=NOW()
       WHERE id=$15 AND is_active=TRUE RETURNING *`,
      [
        name.trim(), cas_number || null, molecular_formula || null,
        category_id || null, hazard_class || null, physical_state || null,
        concentration || null, min_quantity, unit, location || null,
        storage_temp || null, supplier_id || null, expiry_date || null, notes || null,
        req.params.id,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/chemicals/:id — soft delete
router.delete('/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE chemicals SET is_active=FALSE, updated_at=NOW() WHERE id=$1 AND is_active=TRUE RETURNING id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

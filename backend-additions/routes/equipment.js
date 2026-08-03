const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/equipment
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, status, category_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const values = [];
    const conditions = ['e.is_active = TRUE'];

    if (search) { values.push(`%${search}%`); conditions.push(`(e.name ILIKE $${values.length} OR e.model ILIKE $${values.length} OR e.serial_number ILIKE $${values.length} OR e.manufacturer ILIKE $${values.length})`); }
    if (status) { values.push(status); conditions.push(`e.status = $${values.length}`); }
    if (category_id) { values.push(category_id); conditions.push(`e.category_id = $${values.length}`); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(`SELECT COUNT(*) FROM equipment e ${where}`, values);
    const total = parseInt(countResult.rows[0].count);

    values.push(limit, offset);
    const result = await pool.query(
      `SELECT e.*, cat.name AS category_name, s.name AS supplier_name
       FROM equipment e
       LEFT JOIN categories cat ON cat.id = e.category_id
       LEFT JOIN suppliers s ON s.id = e.supplier_id
       ${where}
       ORDER BY e.name
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    res.json({ items: result.rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/equipment/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, cat.name AS category_name, s.name AS supplier_name
       FROM equipment e
       LEFT JOIN categories cat ON cat.id = e.category_id
       LEFT JOIN suppliers s ON s.id = e.supplier_id
       WHERE e.id = $1 AND e.is_active = TRUE`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/equipment
router.post('/', authenticate, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const {
      name, model, serial_number, manufacturer, category_id, status = 'Available',
      location, purchase_date, purchase_price, supplier_id,
      warranty_expiry, last_calibration, next_calibration, notes,
    } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const result = await pool.query(
      `INSERT INTO equipment
        (name, model, serial_number, manufacturer, category_id, status,
         location, purchase_date, purchase_price, supplier_id,
         warranty_expiry, last_calibration, next_calibration, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        name.trim(), model || null, serial_number || null, manufacturer || null,
        category_id || null, status, location || null,
        purchase_date || null, purchase_price || null, supplier_id || null,
        warranty_expiry || null, last_calibration || null, next_calibration || null, notes || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/equipment/:id
router.put('/:id', authenticate, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const {
      name, model, serial_number, manufacturer, category_id, status,
      location, purchase_date, purchase_price, supplier_id,
      warranty_expiry, last_calibration, next_calibration, notes,
    } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const result = await pool.query(
      `UPDATE equipment SET
        name=$1, model=$2, serial_number=$3, manufacturer=$4, category_id=$5, status=$6,
        location=$7, purchase_date=$8, purchase_price=$9, supplier_id=$10,
        warranty_expiry=$11, last_calibration=$12, next_calibration=$13, notes=$14, updated_at=NOW()
       WHERE id=$15 AND is_active=TRUE RETURNING *`,
      [
        name.trim(), model || null, serial_number || null, manufacturer || null,
        category_id || null, status, location || null,
        purchase_date || null, purchase_price || null, supplier_id || null,
        warranty_expiry || null, last_calibration || null, next_calibration || null, notes || null,
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

// DELETE /api/equipment/:id — soft delete
router.delete('/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE equipment SET is_active=FALSE, updated_at=NOW() WHERE id=$1 AND is_active=TRUE RETURNING id`,
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

const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/consumables
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, category, low_stock, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE c.is_active = true';

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (c.name ILIKE $${params.length} OR c.brand ILIKE $${params.length} OR c.batch_number ILIKE $${params.length})`;
    }
    if (category) { params.push(category); where += ` AND c.category = $${params.length}`; }
    if (low_stock === 'true') { where += ` AND c.quantity <= c.min_quantity`; }

    const countResult = await pool.query(`SELECT COUNT(*) FROM consumables c ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT c.*, s.name AS supplier_name
       FROM consumables c
       LEFT JOIN suppliers s ON s.id = c.supplier_id
       ${where} ORDER BY c.name
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ items: result.rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
});

// GET /api/consumables/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.*, s.name AS supplier_name FROM consumables c
       LEFT JOIN suppliers s ON s.id = c.supplier_id WHERE c.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/consumables
router.post('/', authenticate, requireRole('admin', 'staff'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('quantity').isNumeric().withMessage('Quantity must be a number'),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { name, brand, category, batch_number, quantity, min_quantity,
            unit, pack_size, expiry_date, location, supplier_id, price, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO consumables
        (name, brand, category, batch_number, quantity, min_quantity,
         unit, pack_size, expiry_date, location, supplier_id, price, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [name, brand || null, category || null, batch_number || null, quantity, min_quantity || 0,
       unit || 'box', pack_size || null, expiry_date || null, location || null,
       supplier_id || null, price || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/consumables/:id
router.put('/:id', authenticate, requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const { name, brand, category, batch_number, min_quantity, unit, pack_size,
            expiry_date, location, supplier_id, price, notes, is_active } = req.body;
    const result = await pool.query(
      `UPDATE consumables SET name=$1, brand=$2, category=$3, batch_number=$4,
        min_quantity=$5, unit=$6, pack_size=$7, expiry_date=$8, location=$9,
        supplier_id=$10, price=$11, notes=$12, is_active=$13 WHERE id=$14 RETURNING *`,
      [name, brand || null, category || null, batch_number || null, min_quantity || 0,
       unit || 'box', pack_size || null, expiry_date || null, location || null,
       supplier_id || null, price || null, notes || null, is_active !== false, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/consumables/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    await pool.query('UPDATE consumables SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;

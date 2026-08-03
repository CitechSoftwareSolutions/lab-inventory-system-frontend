const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/glassware
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, type, condition, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE g.is_active = true';

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (g.name ILIKE $${params.length} OR g.type ILIKE $${params.length})`;
    }
    if (type) { params.push(type); where += ` AND g.type = $${params.length}`; }
    if (condition) { params.push(condition); where += ` AND g.condition = $${params.length}`; }

    const countResult = await pool.query(`SELECT COUNT(*) FROM glassware g ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT g.*, s.name AS supplier_name
       FROM glassware g
       LEFT JOIN suppliers s ON s.id = g.supplier_id
       ${where} ORDER BY g.name
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ items: result.rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
});

// GET /api/glassware/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT g.*, s.name AS supplier_name FROM glassware g
       LEFT JOIN suppliers s ON s.id = g.supplier_id WHERE g.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/glassware
router.post('/', authenticate, requireRole('admin', 'staff'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { name, type, capacity, capacity_unit, material, quantity, min_quantity,
            condition, location, supplier_id, purchase_date, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO glassware
        (name, type, capacity, capacity_unit, material, quantity, min_quantity,
         condition, location, supplier_id, purchase_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name, type || null, capacity || null, capacity_unit || 'ml', material || 'Borosilicate Glass',
       quantity, min_quantity || 0, condition || 'Good', location || null,
       supplier_id || null, purchase_date || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/glassware/:id
router.put('/:id', authenticate, requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const { name, type, capacity, capacity_unit, material, min_quantity,
            condition, location, supplier_id, purchase_date, notes, is_active } = req.body;
    const result = await pool.query(
      `UPDATE glassware SET name=$1, type=$2, capacity=$3, capacity_unit=$4, material=$5,
        min_quantity=$6, condition=$7, location=$8, supplier_id=$9, purchase_date=$10,
        notes=$11, is_active=$12 WHERE id=$13 RETURNING *`,
      [name, type || null, capacity || null, capacity_unit || 'ml', material || 'Borosilicate Glass',
       min_quantity || 0, condition || 'Good', location || null, supplier_id || null,
       purchase_date || null, notes || null, is_active !== false, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/glassware/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    await pool.query('UPDATE glassware SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;

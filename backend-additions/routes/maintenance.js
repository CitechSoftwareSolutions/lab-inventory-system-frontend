const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/maintenance
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, type, status, equipment_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const values = [];
    const conditions = [];

    if (search) { values.push(`%${search}%`); conditions.push(`(e.name ILIKE $${values.length} OR m.description ILIKE $${values.length} OR m.performed_by ILIKE $${values.length})`); }
    if (type) { values.push(type); conditions.push(`m.type = $${values.length}`); }
    if (status) { values.push(status); conditions.push(`m.status = $${values.length}`); }
    if (equipment_id) { values.push(equipment_id); conditions.push(`m.equipment_id = $${values.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM maintenance_records m LEFT JOIN equipment e ON e.id = m.equipment_id ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    values.push(limit, offset);
    const result = await pool.query(
      `SELECT m.*, e.name AS equipment_name
       FROM maintenance_records m
       LEFT JOIN equipment e ON e.id = m.equipment_id
       ${where}
       ORDER BY m.date DESC, m.id DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    res.json({ items: result.rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/maintenance/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, e.name AS equipment_name
       FROM maintenance_records m
       LEFT JOIN equipment e ON e.id = m.equipment_id
       WHERE m.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/maintenance
router.post('/', authenticate, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { equipment_id, type, date, performed_by, description, cost, status = 'Scheduled', next_date, notes } = req.body;
    if (!equipment_id) return res.status(400).json({ error: 'equipment_id is required' });
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    const result = await pool.query(
      `INSERT INTO maintenance_records (equipment_id, type, date, performed_by, description, cost, status, next_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [equipment_id, type, date, performed_by || null, description.trim(), cost || null, status, next_date || null, notes || null]
    );

    // If completed calibration, update equipment last_calibration + next_calibration
    if (type === 'Calibration' && status === 'Completed') {
      await pool.query(
        `UPDATE equipment SET last_calibration=$1, next_calibration=$2, updated_at=NOW() WHERE id=$3`,
        [date, next_date || null, equipment_id]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/maintenance/:id
router.put('/:id', authenticate, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { equipment_id, type, date, performed_by, description, cost, status, next_date, notes } = req.body;
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' });

    const result = await pool.query(
      `UPDATE maintenance_records SET
        equipment_id=$1, type=$2, date=$3, performed_by=$4, description=$5,
        cost=$6, status=$7, next_date=$8, notes=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [equipment_id, type, date, performed_by || null, description.trim(), cost || null, status, next_date || null, notes || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

    if (type === 'Calibration' && status === 'Completed') {
      await pool.query(
        `UPDATE equipment SET last_calibration=$1, next_calibration=$2, updated_at=NOW() WHERE id=$3`,
        [date, next_date || null, equipment_id]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/maintenance/:id
router.delete('/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM maintenance_records WHERE id=$1 RETURNING id`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

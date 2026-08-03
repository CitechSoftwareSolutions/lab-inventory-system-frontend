const express = require('express');
const router = express.Router();
const { pool } = require('../db'); // adjust path as needed
const { authenticate, requireRole } = require('../middleware/auth'); // adjust path as needed

// GET /api/categories — flat list with parent_name, optional ?type= filter
router.get('/', authenticate, async (req, res) => {
  try {
    const { type } = req.query;
    const values = [];
    let where = "WHERE c.is_active = TRUE";
    if (type) {
      values.push(type);
      where += ` AND c.type = $${values.length}`;
    }

    const result = await pool.query(
      `SELECT c.id, c.name, c.description, c.color, c.type, c.parent_id,
              p.name AS parent_name
       FROM categories c
       LEFT JOIN categories p ON p.id = c.parent_id
       ${where}
       ORDER BY c.type, COALESCE(p.name, c.name), c.parent_id NULLS FIRST, c.name`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/categories
router.post('/', authenticate, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { name, description, color, type = 'General', parent_id = null } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const result = await pool.query(
      `INSERT INTO categories (name, description, color, type, parent_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), description || null, color || '#3B82F6', type, parent_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/categories/:id
router.put('/:id', authenticate, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { name, description, color, type, parent_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const result = await pool.query(
      `UPDATE categories SET name=$1, description=$2, color=$3, type=$4, parent_id=$5, updated_at=NOW()
       WHERE id=$6 AND is_active=TRUE RETURNING *`,
      [name.trim(), description || null, color, type, parent_id || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/categories/:id — soft delete
router.delete('/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE categories SET is_active=FALSE, updated_at=NOW() WHERE id=$1 AND is_active=TRUE RETURNING id`,
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

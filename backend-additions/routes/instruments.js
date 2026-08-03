const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');

const MANAGERS = ['super_admin', 'branch_manager'];

function branchFilter(user) {
  return user.role === 'super_admin' ? null : user.branch_id;
}

// GET /api/instruments
router.get('/', authenticateToken, async (req, res) => {
  const { search, status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const branchId = branchFilter(req.user);

  let where = 'inst.is_active = 1';
  const params = [];

  if (branchId) { where += ' AND inst.branch_id = ?'; params.push(branchId); }
  if (status) { where += ' AND inst.status = ?'; params.push(status); }
  if (search) { where += ' AND inst.name LIKE ?'; params.push(`%${search}%`); }

  try {
    const db = req.app.get('db');
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM instruments inst WHERE ${where}`, params
    );
    const [rows] = await db.query(
      `SELECT inst.*, c.name AS category_name, s.name AS supplier_name
       FROM instruments inst
       LEFT JOIN categories c ON c.id = inst.category_id
       LEFT JOIN suppliers s ON s.id = inst.supplier_id
       WHERE ${where}
       ORDER BY inst.name
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    res.json({ items: rows, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/instruments/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const branchId = branchFilter(req.user);
    const [rows] = await db.query(
      `SELECT inst.*, c.name AS category_name, s.name AS supplier_name
       FROM instruments inst
       LEFT JOIN categories c ON c.id = inst.category_id
       LEFT JOIN suppliers s ON s.id = inst.supplier_id
       WHERE inst.id = ? AND inst.is_active = 1${branchId ? ' AND inst.branch_id = ?' : ''}`,
      branchId ? [req.params.id, branchId] : [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/instruments
router.post('/', authenticateToken, requireRole(MANAGERS), async (req, res) => {
  const {
    name, model, serial_number, manufacturer, category_id, status,
    location, purchase_date, purchase_price, supplier_id,
    warranty_expiry, last_calibration, next_calibration, notes
  } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const db = req.app.get('db');
    const branchId = req.user.branch_id;
    const [result] = await db.query(
      `INSERT INTO instruments
       (name, model, serial_number, manufacturer, category_id, status,
        location, purchase_date, purchase_price, supplier_id,
        warranty_expiry, last_calibration, next_calibration, notes, branch_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name.trim(), model || null, serial_number || null, manufacturer || null,
       category_id || null, status || 'Operational', location || null,
       purchase_date || null, purchase_price || null, supplier_id || null,
       warranty_expiry || null, last_calibration || null, next_calibration || null,
       notes || null, branchId || null]
    );
    const [rows] = await db.query('SELECT * FROM instruments WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/instruments/:id
router.put('/:id', authenticateToken, requireRole(MANAGERS), async (req, res) => {
  const {
    name, model, serial_number, manufacturer, category_id, status,
    location, purchase_date, purchase_price, supplier_id,
    warranty_expiry, last_calibration, next_calibration, notes
  } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const db = req.app.get('db');
    await db.query(
      `UPDATE instruments SET
       name=?, model=?, serial_number=?, manufacturer=?, category_id=?, status=?,
       location=?, purchase_date=?, purchase_price=?, supplier_id=?,
       warranty_expiry=?, last_calibration=?, next_calibration=?, notes=?
       WHERE id=? AND is_active=1`,
      [name.trim(), model || null, serial_number || null, manufacturer || null,
       category_id || null, status || 'Operational', location || null,
       purchase_date || null, purchase_price || null, supplier_id || null,
       warranty_expiry || null, last_calibration || null, next_calibration || null,
       notes || null, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM instruments WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/instruments/:id — soft delete
router.delete('/:id', authenticateToken, requireRole(MANAGERS), async (req, res) => {
  try {
    const db = req.app.get('db');
    await db.query('UPDATE instruments SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

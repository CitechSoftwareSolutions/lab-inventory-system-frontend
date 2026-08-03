const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');

const SUPER_ADMIN = ['super_admin'];
const MANAGERS = ['super_admin', 'branch_manager'];

// GET /api/branches — list branches (managers see all; filtered read for others)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    let rows;
    if (req.user.role === 'super_admin') {
      [rows] = await db.query(`
        SELECT b.*, COUNT(u.id) AS user_count
        FROM branches b
        LEFT JOIN users u ON u.branch_id = b.id AND u.is_active = 1
        WHERE b.is_active = 1
        GROUP BY b.id
        ORDER BY b.name`);
    } else {
      // Non-super-admins can only see their own branch
      [rows] = await db.query(`
        SELECT b.*, COUNT(u.id) AS user_count
        FROM branches b
        LEFT JOIN users u ON u.branch_id = b.id AND u.is_active = 1
        WHERE b.id = ? AND b.is_active = 1
        GROUP BY b.id`, [req.user.branch_id]);
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/branches/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const [rows] = await db.query(
      'SELECT * FROM branches WHERE id = ? AND is_active = 1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/branches — super_admin only
router.post('/', authenticateToken, requireRole(SUPER_ADMIN), async (req, res) => {
  const { name, code, address, phone, email } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Branch name is required' });
  try {
    const db = req.app.get('db');
    const [result] = await db.query(
      'INSERT INTO branches (name, code, address, phone, email) VALUES (?,?,?,?,?)',
      [name.trim(), code?.trim() || null, address?.trim() || null, phone?.trim() || null, email?.trim() || null]
    );
    const [rows] = await db.query('SELECT * FROM branches WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Branch code already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/branches/:id — super_admin only
router.put('/:id', authenticateToken, requireRole(SUPER_ADMIN), async (req, res) => {
  const { name, code, address, phone, email, is_active } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Branch name is required' });
  try {
    const db = req.app.get('db');
    await db.query(
      'UPDATE branches SET name=?, code=?, address=?, phone=?, email=?, is_active=? WHERE id=?',
      [name.trim(), code?.trim() || null, address?.trim() || null, phone?.trim() || null,
       email?.trim() || null, is_active !== false ? 1 : 0, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM branches WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Branch code already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/branches/:id — super_admin only (soft delete)
router.delete('/:id', authenticateToken, requireRole(SUPER_ADMIN), async (req, res) => {
  try {
    const db = req.app.get('db');
    // Check for active users
    const [users] = await db.query(
      'SELECT COUNT(*) AS cnt FROM users WHERE branch_id = ? AND is_active = 1', [req.params.id]
    );
    if (users[0].cnt > 0) {
      return res.status(409).json({ error: 'Cannot delete branch with active users. Reassign users first.' });
    }
    await db.query('UPDATE branches SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Branch deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

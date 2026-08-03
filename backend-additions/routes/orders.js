const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');

const MANAGERS = ['super_admin', 'branch_manager'];

function pad(n) { return String(n).padStart(4, '0'); }

async function generateOrderNumber(db) {
  const [[{ cnt }]] = await db.query('SELECT COUNT(*) AS cnt FROM orders');
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `ORD-${yy}${mm}-${pad(cnt + 1)}`;
}

// GET /api/orders
router.get('/', authenticateToken, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const branchId = req.user.role === 'super_admin' ? null : req.user.branch_id;

  let where = '1=1';
  const params = [];
  if (branchId) { where += ' AND o.branch_id = ?'; params.push(branchId); }
  if (status) { where += ' AND o.status = ?'; params.push(status); }

  try {
    const db = req.app.get('db');
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM orders o WHERE ${where}`, params);
    const [rows] = await db.query(
      `SELECT o.*, s.name AS supplier_name, b.name AS branch_name,
              u.full_name AS created_by_name,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o
       LEFT JOIN suppliers s ON s.id = o.supplier_id
       LEFT JOIN branches b ON b.id = o.branch_id
       LEFT JOIN users u ON u.id = o.created_by
       WHERE ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    res.json({ items: rows, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders/:id (with items)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const [orders] = await db.query(
      `SELECT o.*, s.name AS supplier_name, b.name AS branch_name
       FROM orders o
       LEFT JOIN suppliers s ON s.id = o.supplier_id
       LEFT JOIN branches b ON b.id = o.branch_id
       WHERE o.id = ?`, [req.params.id]
    );
    if (!orders.length) return res.status(404).json({ error: 'Not found' });
    const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ ...orders[0], items });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orders
router.post('/', authenticateToken, requireRole(MANAGERS), async (req, res) => {
  const { supplier_id, expected_delivery, notes, items } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'At least one item is required' });
  const db = req.app.get('db');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const orderNumber = await generateOrderNumber(db);
    const branchId = req.user.role === 'super_admin' ? (req.body.branch_id || null) : req.user.branch_id;

    const [result] = await conn.query(
      `INSERT INTO orders (order_number, supplier_id, branch_id, expected_delivery, notes, created_by)
       VALUES (?,?,?,?,?,?)`,
      [orderNumber, supplier_id || null, branchId, expected_delivery || null, notes || null, req.user.id]
    );
    const orderId = result.insertId;

    let total = 0;
    for (const item of items) {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      total += qty * price;
      await conn.query(
        `INSERT INTO order_items (order_id, item_name, quantity, unit, unit_price, notes)
         VALUES (?,?,?,?,?,?)`,
        [orderId, item.item_name, qty, item.unit || 'pcs', price || null, item.notes || null]
      );
    }

    await conn.query('UPDATE orders SET total_amount = ? WHERE id = ?', [total, orderId]);
    await conn.commit();

    const [rows] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const [orderItems] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    res.status(201).json({ ...rows[0], items: orderItems });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// PUT /api/orders/:id — only editable when Draft
router.put('/:id', authenticateToken, requireRole(MANAGERS), async (req, res) => {
  const { supplier_id, expected_delivery, notes, items } = req.body;
  const db = req.app.get('db');
  const conn = await db.getConnection();
  try {
    const [[order]] = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Not found' });
    if (order.status !== 'Draft') return res.status(400).json({ error: 'Only Draft orders can be edited' });

    await conn.beginTransaction();
    await conn.query(
      'UPDATE orders SET supplier_id=?, expected_delivery=?, notes=? WHERE id=?',
      [supplier_id || null, expected_delivery || null, notes || null, req.params.id]
    );

    if (items?.length) {
      await conn.query('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
      let total = 0;
      for (const item of items) {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unit_price) || 0;
        total += qty * price;
        await conn.query(
          'INSERT INTO order_items (order_id, item_name, quantity, unit, unit_price, notes) VALUES (?,?,?,?,?,?)',
          [req.params.id, item.item_name, qty, item.unit || 'pcs', price || null, item.notes || null]
        );
      }
      await conn.query('UPDATE orders SET total_amount = ? WHERE id = ?', [total, req.params.id]);
    }

    await conn.commit();
    const [rows] = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    const [orderItems] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ ...rows[0], items: orderItems });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// PUT /api/orders/:id/status — advance order status
router.put('/:id/status', authenticateToken, requireRole(MANAGERS), async (req, res) => {
  const { status } = req.body;
  const VALID = ['Draft', 'Submitted', 'Approved', 'Ordered', 'Received', 'Cancelled'];
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const db = req.app.get('db');
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/orders/:id — only Draft orders
router.delete('/:id', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  try {
    const db = req.app.get('db');
    const [[order]] = await db.query('SELECT status FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Not found' });
    if (order.status !== 'Draft') return res.status(400).json({ error: 'Only Draft orders can be deleted' });
    await db.query('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
    await db.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

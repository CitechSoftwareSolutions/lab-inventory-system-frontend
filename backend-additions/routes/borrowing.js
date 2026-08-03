const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// Helper: resolve item name from its type
async function getItemName(client, item_type, item_id) {
  const tableMap = { Item: 'items', Glassware: 'glassware', Equipment: 'equipment' };
  const table = tableMap[item_type];
  if (!table) return null;
  const r = await client.query(`SELECT name FROM ${table} WHERE id = $1`, [item_id]);
  return r.rows[0]?.name ?? null;
}

// GET /api/borrowing
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, item_type, borrower_name, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const values = [];
    const conditions = [];

    if (item_type) { values.push(item_type); conditions.push(`b.item_type = $${values.length}`); }
    if (borrower_name) { values.push(`%${borrower_name}%`); conditions.push(`b.borrower_name ILIKE $${values.length}`); }

    // status filter (computed server-side)
    if (status === 'Returned') conditions.push(`b.actual_return IS NOT NULL`);
    else if (status === 'Overdue') conditions.push(`b.actual_return IS NULL AND b.expected_return < CURRENT_DATE`);
    else if (status === 'Borrowed') conditions.push(`b.actual_return IS NULL AND (b.expected_return IS NULL OR b.expected_return >= CURRENT_DATE)`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM borrow_records b ${where}`, values);
    const total = parseInt(countResult.rows[0].count);

    values.push(limit, offset);
    const result = await pool.query(
      `SELECT b.*,
        CASE
          WHEN b.actual_return IS NOT NULL THEN 'Returned'
          WHEN b.expected_return IS NOT NULL AND b.expected_return < CURRENT_DATE THEN 'Overdue'
          ELSE 'Borrowed'
        END AS computed_status
       FROM borrow_records b
       ${where}
       ORDER BY b.borrow_date DESC, b.id DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    // Attach item names
    const client = await pool.connect();
    try {
      const rows = await Promise.all(result.rows.map(async (row) => {
        const item_name = await getItemName(client, row.item_type, row.item_id);
        return { ...row, item_name };
      }));
      res.json({ items: rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } finally { client.release(); }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/borrowing/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM borrow_records WHERE id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/borrowing
router.post('/', authenticate, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const {
      item_type, item_id, borrower_name, borrower_id, department,
      quantity = 1, borrow_date, expected_return, notes,
    } = req.body;
    if (!item_type || !item_id) return res.status(400).json({ error: 'item_type and item_id are required' });
    if (!borrower_name?.trim()) return res.status(400).json({ error: 'Borrower name is required' });

    const result = await pool.query(
      `INSERT INTO borrow_records (item_type, item_id, borrower_name, borrower_id, department, quantity, borrow_date, expected_return, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [item_type, item_id, borrower_name.trim(), borrower_id || null, department || null, quantity, borrow_date || new Date(), expected_return || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/borrowing/:id — update record details (not return)
router.put('/:id', authenticate, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const {
      item_type, item_id, borrower_name, borrower_id, department,
      quantity, borrow_date, expected_return, notes,
    } = req.body;
    if (!borrower_name?.trim()) return res.status(400).json({ error: 'Borrower name is required' });

    const result = await pool.query(
      `UPDATE borrow_records SET
        item_type=$1, item_id=$2, borrower_name=$3, borrower_id=$4, department=$5,
        quantity=$6, borrow_date=$7, expected_return=$8, notes=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [item_type, item_id, borrower_name.trim(), borrower_id || null, department || null, quantity, borrow_date, expected_return || null, notes || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/borrowing/:id/return — mark as returned
router.put('/:id/return', authenticate, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE borrow_records SET actual_return=CURRENT_DATE, updated_at=NOW() WHERE id=$1 AND actual_return IS NULL RETURNING *`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found or already returned' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/borrowing/:id
router.delete('/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM borrow_records WHERE id=$1 RETURNING id`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

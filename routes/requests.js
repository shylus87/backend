import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// List requests
router.get('/', requireAuth, async (req, res) => {
  if (process.env.NODE_ENV === 'development') {
    // Allow DB requests without authentication in development
    const { user_id, status, priority, search } = req.query;
    const where = [];
    const params = [];

    if (user_id) {
      params.push(user_id);
      where.push(`requester_id = $${params.length}`);
    }
    if (status) {
      const statuses = String(status).split(',');
      const placeholders = statuses.map((_, i) => `$${params.length + i + 1}`).join(',');
      params.push(...statuses);
      where.push(`status IN (${placeholders})`);
    }
    if (priority) {
      params.push(priority);
      where.push(`priority = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(short_description ILIKE $${params.length} OR detailed_justification ILIKE $${params.length})`);
    }

    const sql = `
      SELECT * FROM requests
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC
      LIMIT 200
    `;
    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  }
  // ...existing code...
});

// Create request
router.post('/', requireAuth, async (req, res) => {
  const { request_type, short_description, detailed_justification, priority } = req.body;
  const requestId = `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;

  const targetResolutionDate = new Date();
  targetResolutionDate.setHours(targetResolutionDate.getHours() + 48);

  const insert = `
    INSERT INTO requests
      (request_id, request_type, short_description, detailed_justification, priority, requester_id, target_resolution_date)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
  `;
  const { rows } = await pool.query(insert, [
    requestId,
    request_type,
    short_description,
    detailed_justification,
    priority,
    req.user.userId,
    targetResolutionDate.toISOString()
  ]);

  await pool.query(
    `INSERT INTO status_history (request_id, to_status, changed_by, changed_by_role)
     VALUES ($1, 'submitted', $2, $3)`,
    [rows[0].id, req.user.userId, req.user.role]
  );

  res.status(201).json(rows[0]);
});

// Request details
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });

  const request = rows[0];
  const history = (await pool.query('SELECT * FROM status_history WHERE request_id = $1 ORDER BY timestamp ASC', [id])).rows;
  const comments = (await pool.query('SELECT * FROM comments WHERE request_id = $1 ORDER BY timestamp ASC', [id])).rows;

  res.json({ ...request, status_history: history, comments });
});

// Update status
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status, comment } = req.body;
  const { id } = req.params;

  await pool.query('UPDATE requests SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);

  await pool.query(
    `INSERT INTO status_history (request_id, from_status, to_status, changed_by, changed_by_role, comment)
     VALUES ($1, (SELECT status FROM requests WHERE id = $1), $2, $3, $4, $5)`,
    [id, status, req.user.userId, req.user.role, comment ?? null]
  );

  res.json({ success: true });
});

// Add comment
router.post('/:id/comments', requireAuth, async (req, res) => {
  const { content } = req.body;
  const { id } = req.params;

  const userRes = await pool.query('SELECT name, role FROM users WHERE id = $1', [req.user.userId]);

  await pool.query(
    `INSERT INTO comments (request_id, user_id, user_name, user_role, content)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, req.user.userId, userRes.rows[0].name, userRes.rows[0].role, content]
  );

  res.status(201).json({ success: true });
});

export default router;

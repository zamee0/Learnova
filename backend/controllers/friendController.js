const pool = require("../config/db");

exports.getFriends = async (req, res, next) => {
  try {
    const query = `
      SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.email, u.role, u.bio, u.avatar_url,
             (CURRENT_TIMESTAMP - u.last_active_at < INTERVAL '5 minutes') AS is_online
      FROM friendships f
      JOIN users u ON (f.friend_id = u.id AND f.user_id = $1) OR (f.user_id = u.id AND f.friend_id = $1)
      WHERE f.status = 'accepted'
    `;
    const result = await pool.query(query, [req.user.id]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getRequests = async (req, res, next) => {
  try {
    const query = `
      SELECT f.id, f.user_id AS sender_id, u.first_name || ' ' || u.last_name AS sender_name, u.email AS sender_email, f.created_at
      FROM friendships f
      JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;
    const result = await pool.query(query, [req.user.id]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getState = async (req, res, next) => {
  try {
    const target = Number(req.params.userId);
    if (!Number.isInteger(target)) return res.status(400).json({ error: "Invalid user ID." });
    const row = await pool.query("SELECT id, user_id, friend_id, status FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)", [req.user.id, target]);
    if (!row.rowCount) return res.json({ state: 'NONE' });
    const r = row.rows[0];
    res.json({ state: r.status === 'accepted' ? 'ACCEPTED' : r.status === 'pending' ? (r.user_id === req.user.id ? 'SENT' : 'RECEIVED') : 'NONE', request_id: r.id });
  } catch (err) { next(err); }
};

exports.sendRequest = async (req, res, next) => {
  try {
    const friendId = Number(req.body.receiver_id);
    if (!Number.isInteger(friendId)) return res.status(400).json({ error: "A valid receiver_id is required." });

    if (req.user.id === friendId) return res.status(400).json({ error: "You cannot add yourself as a friend." });
    const targetExists = await pool.query("SELECT 1 FROM users WHERE id = $1", [friendId]);
    if (!targetExists.rowCount) return res.status(404).json({ error: "User not found." });

    const existing = await pool.query(
      `SELECT status FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [req.user.id, friendId]
    );
    if (existing.rows[0]?.status !== 'rejected' && existing.rows.length > 0) {
      return res.status(409).json({ error: `A relationship or request already exists (${existing.rows[0].status}).` });
    }
    await pool.withTransaction(async client => {
      if (existing.rows[0]?.status === 'rejected') {
        await client.query("UPDATE friendships SET user_id = $1, friend_id = $2, status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)", [req.user.id, friendId]);
      } else {
        await client.query("INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'pending')", [req.user.id, friendId]);
      }
      await client.query("INSERT INTO notifications (user_id, title, message, type) VALUES ($1, 'New Friend Request', 'Someone sent you a friend request.', 'friend_request')", [friendId]);
    });

    return res.status(201).json({ message: "Friend request sent successfully." });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: "A relationship or request already exists." });
    next(err);
  }
};

exports.cancelRequest = async (req, res, next) => {
  try {
    const deleted = await pool.query("DELETE FROM friendships WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id", [Number(req.params.id), req.user.id]);
    if (!deleted.rowCount) return res.status(404).json({ error: "Pending request not found." });
    res.sendStatus(204);
  } catch (err) { next(err); }
};

exports.unfriend = async (req, res, next) => {
  try {
    const id = Number(req.params.userId);
    const deleted = await pool.query("DELETE FROM friendships WHERE status = 'accepted' AND ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) RETURNING id", [req.user.id, id]);
    if (!deleted.rowCount) return res.status(404).json({ error: "Friendship not found." });
    res.sendStatus(204);
  } catch (err) { next(err); }
};

exports.respondRequest = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!Number.isInteger(requestId) || requestId <= 0) return res.status(400).json({ error: "Invalid friend request ID." });
    if (!['accepted', 'rejected', 'accept', 'reject'].includes(status)) return res.status(400).json({ error: "Status must be accepted or rejected." });
    const newStatus = status === 'accept' ? 'accepted' : status === 'reject' ? 'rejected' : status;

    const reqRecord = await pool.query("SELECT user_id, friend_id FROM friendships WHERE id = $1 AND friend_id = $2", [requestId, req.user.id]);
    if (reqRecord.rows.length === 0) return res.status(404).json({ error: "Friend request not found or unauthorized." });

    await pool.withTransaction(async client => {
      await client.query("UPDATE friendships SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [newStatus, requestId]);
      if (newStatus === "accepted") {
        await client.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES ($1, 'Friend Request Accepted', 'Your friend request was accepted.', 'friend_accept')",
        [reqRecord.rows[0].user_id]
        );
      }
    });

    return res.status(200).json({ message: `Friend request ${newStatus}.` });
  } catch (err) {
    next(err);
  }
};

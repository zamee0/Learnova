const pool = require("../config/db");

exports.getFriends = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT 
        u.id, 
        u.first_name || ' ' || u.last_name AS name, 
        u.email, 
        u.role, 
        u.bio
      FROM friendships f
      JOIN users u ON (f.friend_id = u.id AND f.user_id = $1) OR (f.user_id = u.id AND f.friend_id = $1)
      WHERE f.status = 'accepted'
    `;
    const result = await pool.query(query, [userId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getRequests = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT 
        f.id,
        f.user_id AS sender_id,
        u.first_name || ' ' || u.last_name AS sender_name,
        u.email AS sender_email,
        f.created_at
      FROM friendships f
      JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.sendRequest = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const target = req.body.receiver_id || req.body.email;

    if (!target) {
      return res.status(400).json({ error: "Receiver ID or Email is required." });
    }

    let friendId;
    if (isNaN(target)) {
      const userLookup = await pool.query("SELECT id FROM users WHERE email = $1", [target.toLowerCase().trim()]);
      if (userLookup.rows.length === 0) return res.status(404).json({ error: "User not found with this email." });
      friendId = userLookup.rows[0].id;
    } else {
      friendId = parseInt(target, 10);
    }

    if (userId === friendId) {
      return res.status(400).json({ error: "You cannot add yourself as a friend." });
    }

    const existing = await pool.query(
      `SELECT status FROM friendships 
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [userId, friendId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `A friendship or request already exists (${existing.rows[0].status}).` });
    }

    await pool.query(
      `INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'pending')`,
      [userId, friendId]
    );

    return res.status(201).json({ message: "Friend request sent successfully." });
  } catch (err) {
    next(err);
  }
};

exports.respondRequest = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'accepted' or 'rejected'." });
    }

    const result = await pool.query(
      `UPDATE friendships 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND friend_id = $3
       RETURNING *`,
      [status, requestId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Friend request not found or unauthorized." });
    }

    return res.status(200).json({ message: `Request ${status} successfully.` });
  } catch (err) {
    next(err);
  }
};
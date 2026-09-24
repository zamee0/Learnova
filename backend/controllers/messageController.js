const pool = require("../config/db");

exports.getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT u.id AS other_user_id, u.first_name || ' ' || u.last_name AS other_user_name,
        u.last_active_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes' AS is_online,
        last.content AS last_message, last.is_read, last.sender_id, last.created_at,
        (SELECT COUNT(*)::int FROM messages unread WHERE unread.sender_id = u.id AND unread.receiver_id = $1 AND unread.is_read = FALSE) AS unread_count
      FROM friendships f
      JOIN users u ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
      LEFT JOIN LATERAL (
        SELECT content, is_read, sender_id, created_at FROM messages m
        WHERE (m.sender_id = $1 AND m.receiver_id = u.id) OR (m.sender_id = u.id AND m.receiver_id = $1)
        ORDER BY m.created_at DESC LIMIT 1
      ) last ON TRUE
      WHERE f.status = 'accepted' AND (f.user_id = $1 OR f.friend_id = $1)
      ORDER BY last.created_at DESC NULLS LAST, other_user_name
    `;
    const result = await pool.query(query, [userId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getMessagesWithUser = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const otherUserId = parseInt(req.params.otherUserId, 10);
    if (!Number.isInteger(otherUserId) || otherUserId <= 0) return res.status(400).json({ error: "Invalid user ID." });
    const friends = await pool.query("SELECT 1 FROM friendships WHERE status = 'accepted' AND ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))", [userId, otherUserId]);
    if (!friends.rowCount) return res.status(403).json({ error: "Messaging is available to accepted friends only." });

    // Mark messages as read
    const marked = await pool.query(
      "UPDATE messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE",
      [otherUserId, userId]
    );
    if (marked.rowCount) req.app.get('io')?.to(`user:${otherUserId}`).emit('dm:read', { by: userId });

    const query = `
      SELECT m.id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at,
             su.first_name || ' ' || su.last_name AS sender_name
      FROM messages m
      JOIN users su ON m.sender_id = su.id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2)
         OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
    `;
    const result = await pool.query(query, [userId, otherUserId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { receiver_id, content } = req.body;
    const receiverId = parseInt(receiver_id, 10);

    if (!Number.isInteger(receiverId) || receiverId <= 0 || typeof content !== 'string' || !content.trim() || content.length > 10000) {
      return res.status(400).json({ error: "Receiver ID and message content are required." });
    }

    if (receiverId === senderId) return res.status(400).json({ error: "You cannot message yourself." });
    const friends = await pool.query("SELECT 1 FROM friendships WHERE status = 'accepted' AND ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))", [senderId, receiverId]);
    if (!friends.rowCount) return res.status(403).json({ error: "Messaging is available to accepted friends only." });

    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [senderId, receiverId, content.trim()]
    );
    req.app.get('io')?.to(`user:${receiverId}`).emit('dm:message', result.rows[0]);
    req.app.get('io')?.to(`user:${senderId}`).emit('dm:message', result.rows[0]);

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

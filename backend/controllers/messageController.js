const pool = require("../config/db");

exports.getConversations = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;

    const query = `
      SELECT DISTINCT ON (other_user_id)
        other_user_id,
        other_user_name,
        content AS last_message,
        created_at
      FROM (
        SELECT 
          CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS other_user_id,
          CASE WHEN sender_id = $1 THEN ru.first_name || ' ' || ru.last_name ELSE su.first_name || ' ' || su.last_name END AS other_user_name,
          content,
          m.created_at
        FROM messages m
        JOIN users su ON m.sender_id = su.user_id
        JOIN users ru ON m.receiver_id = ru.user_id
        WHERE sender_id = $1 OR receiver_id = $1
        ORDER BY m.created_at DESC
      ) t
      ORDER BY other_user_id, created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getMessagesWithUser = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const otherUserId = parseInt(req.params.otherUserId, 10);

    const query = `
      SELECT 
        m.message_id,
        m.message_id AS id,
        m.sender_id,
        m.receiver_id,
        m.content,
        m.is_read,
        m.created_at,
        su.first_name || ' ' || su.last_name AS sender_name
      FROM messages m
      JOIN users su ON m.sender_id = su.user_id
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
    const senderId = req.user.user_id || req.user.id;
    const { receiver_id, content } = req.body;
    const receiverId = parseInt(receiver_id, 10);

    if (isNaN(receiverId) || !content || !content.trim()) {
      return res.status(400).json({ error: "Receiver ID and message content are required." });
    }

    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, content)
       VALUES ($1, $2, $3)
       RETURNING *, message_id AS id`,
      [senderId, receiverId, content.trim()]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
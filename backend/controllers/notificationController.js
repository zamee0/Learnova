const pool = require("../config/db");

exports.getNotifications = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 30`,
      [req.user.id]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const notifId = parseInt(req.params.id, 10);
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [notifId, req.user.id]
    );
    return res.status(200).json({ message: "Notification marked as read." });
  } catch (err) {
    next(err);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
      [req.user.id]
    );
    return res.status(200).json({ message: "All notifications marked as read." });
  } catch (err) {
    next(err);
  }
};
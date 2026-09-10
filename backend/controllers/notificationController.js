const pool = require("../config/db");

exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;

    const result = await pool.query(
      `SELECT notification_id, notification_id AS id, title, message, type, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [userId]
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const notifId = parseInt(req.params.id, 10);

    await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2",
      [notifId, userId]
    );

    return res.status(200).json({ message: "Notification marked as read." });
  } catch (err) {
    next(err);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;

    await pool.query("UPDATE notifications SET is_read = TRUE WHERE user_id = $1", [userId]);

    return res.status(200).json({ message: "All notifications marked as read." });
  } catch (err) {
    next(err);
  }
};
const pool = require("../config/db");

// GET /api/notifications
async function getMyNotifications(req, res) {
    try {
        const result = await pool.query(
            "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
}

// PUT /api/notifications/:id/read
async function markAsRead(req, res) {
    try {
        const { id } = req.params;
        await pool.query(
            "UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2",
            [id, req.user.id]
        );
        res.json({ message: "Marked as read" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update notification" });
    }
}

// PUT /api/notifications/read-all
async function markAllAsRead(req, res) {
    try {
        await pool.query("UPDATE notifications SET is_read = TRUE WHERE user_id = $1", [req.user.id]);
        res.json({ message: "All notifications marked as read" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update notifications" });
    }
}

module.exports = { getMyNotifications, markAsRead, markAllAsRead };

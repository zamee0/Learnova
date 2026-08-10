const pool = require("../config/db");

async function areFriends(userA, userB) {
    const [a, b] = userA < userB ? [userA, userB] : [userB, userA];
    const result = await pool.query(
        "SELECT 1 FROM friendships WHERE user_a_id = $1 AND user_b_id = $2", [a, b]
    );
    return result.rows.length > 0;
}

// POST /api/messages - send a message (must be friends first)
async function sendMessage(req, res) {
    try {
        const { receiver_id, content } = req.body;
        const sender_id = req.user.id;
        if (!receiver_id || !content) return res.status(400).json({ error: "receiver_id and content are required" });

        const friends = await areFriends(sender_id, receiver_id);
        if (!friends) return res.status(403).json({ error: "You can only message friends. Send a friend request first." });

        const result = await pool.query(
            "INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *",
            [sender_id, receiver_id, content]
        );
        res.status(201).json({ message: "Sent", data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to send message" });
    }
}

// GET /api/messages/:otherUserId - full conversation with one friend
async function getConversation(req, res) {
    try {
        const myId = req.user.id;
        const { otherUserId } = req.params;

        const result = await pool.query(`
            SELECT * FROM messages
            WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
            ORDER BY created_at ASC
        `, [myId, otherUserId]);

        // Mark incoming messages as read
        await pool.query(
            "UPDATE messages SET is_read = TRUE WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE",
            [otherUserId, myId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch conversation" });
    }
}

// GET /api/messages - list of conversations (latest message per friend)
async function getConversationList(req, res) {
    try {
        const myId = req.user.id;
        const result = await pool.query(`
            SELECT DISTINCT ON (contact_id)
                   contact_id, u.first_name, u.last_name, u.avatar_url,
                   (u.last_active_at > NOW() - INTERVAL '5 minutes') AS is_active_now,
                   m.content AS last_message, m.created_at, m.sender_id = $1 AS sent_by_me
            FROM (
                SELECT *, CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS contact_id
                FROM messages
                WHERE sender_id = $1 OR receiver_id = $1
            ) m
            JOIN users u ON u.user_id = m.contact_id
            ORDER BY contact_id, m.created_at DESC
        `, [myId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch conversations" });
    }
}

module.exports = { sendMessage, getConversation, getConversationList };

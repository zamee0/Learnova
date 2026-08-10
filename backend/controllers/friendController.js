const pool = require("../config/db");

// Always store the pair with the smaller id first, so (A,B) and (B,A) are the same row
function orderedPair(a, b) {
    return a < b ? [a, b] : [b, a];
}

// POST /api/friends/request - send a friend request
async function sendFriendRequest(req, res) {
    const client = await pool.connect();
    try {
        const { receiver_id } = req.body;
        const sender_id = req.user.id;
        if (!receiver_id) return res.status(400).json({ error: "receiver_id is required" });
        if (receiver_id === sender_id) return res.status(400).json({ error: "Can't friend yourself" });

        const [a, b] = orderedPair(sender_id, receiver_id);
        const existingFriendship = await client.query(
            "SELECT 1 FROM friendships WHERE user_a_id = $1 AND user_b_id = $2", [a, b]
        );
        if (existingFriendship.rows.length > 0) {
            return res.status(409).json({ error: "Already friends" });
        }

        await client.query("BEGIN");
        const result = await client.query(
            "INSERT INTO friend_requests (sender_id, receiver_id) VALUES ($1, $2) RETURNING *",
            [sender_id, receiver_id]
        );

        const sender = await client.query("SELECT first_name, last_name FROM users WHERE user_id = $1", [sender_id]);
        await client.query(
            `INSERT INTO notifications (user_id, title, message, type)
             VALUES ($1, $2, $3, 'friend_request')`,
            [receiver_id, "New friend request", `${sender.rows[0].first_name} ${sender.rows[0].last_name} sent you a friend request.`]
        );

        await client.query("COMMIT");
        res.status(201).json({ message: "Friend request sent", request: result.rows[0] });
    } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "23505") {
            return res.status(409).json({ error: "Friend request already sent" });
        }
        console.error(err);
        res.status(500).json({ error: "Failed to send friend request" });
    } finally {
        client.release();
    }
}

// PUT /api/friends/request/:id - accept or reject
async function respondToFriendRequest(req, res) {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { action } = req.body; // "accept" | "reject"
        if (!["accept", "reject"].includes(action)) {
            return res.status(400).json({ error: "action must be 'accept' or 'reject'" });
        }

        const reqResult = await client.query("SELECT * FROM friend_requests WHERE request_id = $1", [id]);
        if (reqResult.rows.length === 0) return res.status(404).json({ error: "Request not found" });
        const request = reqResult.rows[0];

        if (request.receiver_id !== req.user.id) {
            return res.status(403).json({ error: "This request isn't addressed to you" });
        }
        if (request.status !== "pending") {
            return res.status(409).json({ error: `Request already ${request.status}` });
        }

        await client.query("BEGIN");
        const newStatus = action === "accept" ? "accepted" : "rejected";
        await client.query("UPDATE friend_requests SET status = $1 WHERE request_id = $2", [newStatus, id]);

        if (action === "accept") {
            const [a, b] = orderedPair(request.sender_id, request.receiver_id);
            await client.query(
                "INSERT INTO friendships (user_a_id, user_b_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                [a, b]
            );

            const receiver = await client.query("SELECT first_name, last_name FROM users WHERE user_id = $1", [req.user.id]);
            await client.query(
                `INSERT INTO notifications (user_id, title, message, type)
                 VALUES ($1, $2, $3, 'friend_accept')`,
                [request.sender_id, "Friend request accepted", `${receiver.rows[0].first_name} ${receiver.rows[0].last_name} accepted your friend request.`]
            );
        }

        await client.query("COMMIT");
        res.json({ message: `Request ${newStatus}` });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({ error: "Failed to respond to friend request" });
    } finally {
        client.release();
    }
}

// GET /api/friends/requests - incoming pending requests
async function getIncomingRequests(req, res) {
    try {
        const result = await pool.query(`
            SELECT fr.request_id, fr.created_at, u.user_id, u.first_name, u.last_name, u.avatar_url, u.role
            FROM friend_requests fr
            JOIN users u ON fr.sender_id = u.user_id
            WHERE fr.receiver_id = $1 AND fr.status = 'pending'
            ORDER BY fr.created_at DESC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch friend requests" });
    }
}

// GET /api/friends - my friend list (with Active Now status)
async function getMyFriends(req, res) {
    try {
        const result = await pool.query(`
            SELECT u.user_id, u.first_name, u.last_name, u.avatar_url, u.role,
                   (u.last_active_at > NOW() - INTERVAL '5 minutes') AS is_active_now
            FROM friendships f
            JOIN users u ON u.user_id = CASE WHEN f.user_a_id = $1 THEN f.user_b_id ELSE f.user_a_id END
            WHERE f.user_a_id = $1 OR f.user_b_id = $1
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch friends" });
    }
}

module.exports = { sendFriendRequest, respondToFriendRequest, getIncomingRequests, getMyFriends };

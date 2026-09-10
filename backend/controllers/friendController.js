const pool = require("../config/db");

// Get accepted friends list
exports.getFriends = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;

    const query = `
      SELECT 
        u.user_id,
        u.user_id AS id,
        u.first_name || ' ' || u.last_name AS name,
        u.email,
        u.role,
        u.bio,
        u.avatar_url
      FROM friendships f
      JOIN users u ON (f.user_b_id = u.user_id AND f.user_a_id = $1) 
                   OR (f.user_a_id = u.user_id AND f.user_b_id = $1)
    `;

    const result = await pool.query(query, [userId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Get pending incoming friend requests
exports.getRequests = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;

    const query = `
      SELECT 
        fr.request_id,
        fr.request_id AS id,
        fr.sender_id,
        u.first_name || ' ' || u.last_name AS sender_name,
        u.email AS sender_email,
        fr.created_at
      FROM friend_requests fr
      JOIN users u ON fr.sender_id = u.user_id
      WHERE fr.receiver_id = $1 AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Send a friend request by receiver user_id or email
exports.sendRequest = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const target = req.body.receiver_id || req.body.email;

    if (!target) {
      return res.status(400).json({ error: "Receiver ID or Email is required." });
    }

    let friendId;
    if (isNaN(target)) {
      const lookup = await pool.query("SELECT user_id FROM users WHERE email = $1", [target.toLowerCase().trim()]);
      if (lookup.rows.length === 0) return res.status(404).json({ error: "User not found with this email." });
      friendId = lookup.rows[0].user_id;
    } else {
      friendId = parseInt(target, 10);
    }

    if (userId === friendId) {
      return res.status(400).json({ error: "You cannot add yourself as a friend." });
    }

    // Check if already friends
    const existingFriend = await pool.query(
      `SELECT 1 FROM friendships 
       WHERE (user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)`,
      [userId, friendId]
    );
    if (existingFriend.rows.length > 0) {
      return res.status(400).json({ error: "You are already friends with this user." });
    }

    // Check if request already exists
    const existingReq = await pool.query(
      `SELECT status FROM friend_requests 
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
      [userId, friendId]
    );
    if (existingReq.rows.length > 0) {
      return res.status(400).json({ error: `A request already exists (${existingReq.rows[0].status}).` });
    }

    await pool.query(
      "INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES ($1, $2, 'pending')",
      [userId, friendId]
    );

    // Notify receiver
    await pool.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES ($1, 'New Friend Request', 'Someone sent you a friend request.', 'friend_request')",
      [friendId]
    );

    return res.status(201).json({ message: "Friend request sent successfully." });
  } catch (err) {
    next(err);
  }
};

// Accept or reject a friend request
exports.respondRequest = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const requestId = parseInt(req.params.id, 10);
    const { status } = req.body; // 'accepted' or 'rejected'

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'accepted' or 'rejected'." });
    }

    const reqRecord = await pool.query(
      "SELECT sender_id, receiver_id FROM friend_requests WHERE request_id = $1 AND receiver_id = $2",
      [requestId, userId]
    );

    if (reqRecord.rows.length === 0) {
      return res.status(404).json({ error: "Friend request not found or unauthorized." });
    }

    const { sender_id, receiver_id } = reqRecord.rows[0];

    await pool.query("UPDATE friend_requests SET status = $1 WHERE request_id = $2", [status, requestId]);

    if (status === "accepted") {
      const uA = Math.min(sender_id, receiver_id);
      const uB = Math.max(sender_id, receiver_id);

      await pool.query(
        "INSERT INTO friendships (user_a_id, user_b_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [uA, uB]
      );

      await pool.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES ($1, 'Friend Request Accepted', 'Your friend request was accepted.', 'friend_accept')",
        [sender_id]
      );
    }

    return res.status(200).json({ message: `Friend request ${status}.` });
  } catch (err) {
    next(err);
  }
};
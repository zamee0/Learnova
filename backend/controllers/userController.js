const pool = require("../config/db");

// GET /api/users/me - own profile
async function getMyProfile(req, res) {
    try {
        const result = await getProfileData(req.user.id);
        if (!result) return res.status(404).json({ error: "User not found" });
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
}

// GET /api/users/:id - view someone else's profile
async function getUserProfile(req, res) {
    try {
        const result = await getProfileData(req.params.id);
        if (!result) return res.status(404).json({ error: "User not found" });
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
}

// Shared logic: builds a profile object with avatar, Active Now, and course counts.
// "Active Now" = last_active_at within the last 5 minutes (refreshed by authMiddleware on every request).
async function getProfileData(userId) {
    const userResult = await pool.query(
        `SELECT user_id, first_name, last_name, email, role, avatar_url, bio, last_active_at, created_at,
                (last_active_at > NOW() - INTERVAL '5 minutes') AS is_active_now
         FROM users WHERE user_id = $1`,
        [userId]
    );
    if (userResult.rows.length === 0) return null;
    const user = userResult.rows[0];

    if (user.role === "student") {
        const countResult = await pool.query(
            "SELECT COUNT(*) FROM enrollments WHERE student_id = $1", [userId]
        );
        user.total_courses_enrolled = parseInt(countResult.rows[0].count, 10);
    } else {
        const countResult = await pool.query(
            "SELECT COUNT(*) FROM courses WHERE teacher_id = $1", [userId]
        );
        user.total_courses_teaching = parseInt(countResult.rows[0].count, 10);
    }

    return user;
}

// PUT /api/users/me - update own profile (name, avatar, bio)
async function updateMyProfile(req, res) {
    try {
        const { first_name, last_name, avatar_url, bio } = req.body;
        const result = await pool.query(
            `UPDATE users SET
                first_name = COALESCE($1, first_name),
                last_name = COALESCE($2, last_name),
                avatar_url = COALESCE($3, avatar_url),
                bio = COALESCE($4, bio)
             WHERE user_id = $5
             RETURNING user_id, first_name, last_name, avatar_url, bio`,
            [first_name, last_name, avatar_url, bio, req.user.id]
        );
        res.json({ message: "Profile updated", user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update profile" });
    }
}

// GET /api/users/search?q=... - find people to friend (excludes self)
async function searchUsers(req, res) {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ error: "Query param 'q' is required" });

        const result = await pool.query(
            `SELECT user_id, first_name, last_name, email, role, avatar_url
             FROM users
             WHERE (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1)
               AND user_id != $2
             LIMIT 20`,
            [`%${q}%`, req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Search failed" });
    }
}

module.exports = { getMyProfile, getUserProfile, updateMyProfile, searchUsers };

const pool = require("../config/db");

exports.getMe = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const result = await pool.query(
      `SELECT user_id, user_id AS id, first_name, last_name, email, role, bio, avatar_url, last_active_at, created_at 
       FROM users WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User profile not found." });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const { first_name, last_name, bio } = req.body;

    const result = await pool.query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           bio = COALESCE($3, bio)
       WHERE user_id = $4
       RETURNING user_id, user_id AS id, first_name, last_name, email, role, bio, avatar_url, created_at`,
      [first_name, last_name, bio, userId]
    );

    return res.status(200).json({ message: "Profile updated successfully", user: result.rows[0] });
  } catch (err) {
    next(err);
  }
};
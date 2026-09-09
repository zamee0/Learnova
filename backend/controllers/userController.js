const pool = require("../config/db");

exports.getMe = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, role, bio, avatar_url, is_active, created_at 
       FROM users WHERE id = $1`,
      [req.user.id]
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
    const { first_name, last_name, bio } = req.body;
    const result = await pool.query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           bio = COALESCE($3, bio),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, first_name, last_name, email, role, bio, avatar_url, created_at`,
      [first_name, last_name, bio, req.user.id]
    );

    return res.status(200).json({
      message: "Profile updated successfully",
      user: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
};
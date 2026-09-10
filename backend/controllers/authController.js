const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "learnova_jwt_secret_2026";

exports.signup = async (req, res, next) => {
  try {
    const { first_name, last_name, email, password, role, bio } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: "First name, last name, email, and password are required." });
    }

    const assignedRole = role === "teacher" ? "teacher" : "student";
    const cleanEmail = email.toLowerCase().trim();

    // Check existing email
    const existing = await pool.query("SELECT user_id FROM users WHERE email = $1", [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, bio)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, user_id AS id, first_name, last_name, email, role, bio, avatar_url, created_at`,
      [first_name.trim(), last_name.trim(), cleanEmail, password_hash, assignedRole, bio || null]
    );

    const user = result.rows[0];

    // Welcome notification
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Welcome to Learnova!', 'Your account has been created successfully.', 'general')`,
      [user.user_id]
    );

    const token = jwt.sign(
      { user_id: user.user_id, id: user.user_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({ message: "Registration successful", token, user });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const result = await pool.query(
      "SELECT user_id, user_id AS id, first_name, last_name, email, password_hash, role, bio, avatar_url, created_at FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    // Update active timestamp
    await pool.query("UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE user_id = $1", [user.user_id]);

    const token = jwt.sign(
      { user_id: user.user_id, id: user.user_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    delete user.password_hash;

    return res.status(200).json({ message: "Login successful", token, user });
  } catch (err) {
    next(err);
  }
};
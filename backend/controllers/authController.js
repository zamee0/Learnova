const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
require("dotenv").config();

function signToken(id, role, email) {
    return jwt.sign({ id, role, email }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// POST /api/auth/signup
async function signup(req, res) {
    try {
        const { first_name, last_name, email, password, role } = req.body;

        if (!first_name || !last_name || !email || !password || !role) {
            return res.status(400).json({ error: "first_name, last_name, email, password and role are required" });
        }
        if (!["student", "teacher"].includes(role)) {
            return res.status(400).json({ error: "role must be 'student' or 'teacher'" });
        }

        const existing = await pool.query("SELECT user_id FROM users WHERE email = $1", [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: "Email already registered" });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, role)
             VALUES ($1, $2, $3, $4, $5) RETURNING user_id`,
            [first_name, last_name, email, password_hash, role]
        );
        const user_id = result.rows[0].user_id;

        const token = signToken(user_id, role, email);
        res.status(201).json({
            message: "Signup successful",
            token,
            user: { id: user_id, first_name, last_name, email, role }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error during signup" });
    }
}

// POST /api/auth/login
async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "email and password are required" });
        }

        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        await pool.query("UPDATE users SET last_active_at = NOW() WHERE user_id = $1", [user.user_id]);

        const token = signToken(user.user_id, user.role, user.email);
        res.json({
            message: "Login successful",
            token,
            user: { id: user.user_id, first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role, avatar_url: user.avatar_url }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error during login" });
    }
}

module.exports = { signup, login };

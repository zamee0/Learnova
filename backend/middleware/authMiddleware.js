const jwt = require("jsonwebtoken");
const pool = require("../config/db");
require("dotenv").config();

// Protects routes - checks for a valid JWT in the Authorization header
function verifyToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"

    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired token" });
        }
        req.user = decoded; // { id, role, email }

        // Fire-and-forget: bump last_active_at so "Active Now" stays accurate.
        // Not awaited on purpose - shouldn't slow down the actual request.
        pool.query("UPDATE users SET last_active_at = NOW() WHERE user_id = $1", [req.user.id])
            .catch(err => console.error("Failed to update last_active_at:", err.message));

        next();
    });
}

// Restricts a route to specific roles, e.g. verifyRole("teacher")
function verifyRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: "Access denied for your role" });
        }
        next();
    };
}

module.exports = { verifyToken, verifyRole };

const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. Authentication token missing." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "learnova_jwt_secret_2026");
    const result = await pool.query("SELECT role,is_active FROM users WHERE id=$1", [decoded.id]);
    if (!result.rowCount || !result.rows[0].is_active) return res.status(401).json({ error: "This account is unavailable. Please log in again." });
    if (decoded.role !== result.rows[0].role) return res.status(401).json({ error: "Your account permissions changed. Please log in again." });
    req.user = { ...decoded, role: result.rows[0].role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') return res.status(401).json({ error: "Invalid or expired token. Please log in again." });
    return next(err);
  }
};

const teacherOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "teacher") {
    return res.status(403).json({ error: "Access forbidden. Teacher privileges required." });
  }
  next();
};

const studentOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "student") {
    return res.status(403).json({ error: "Access forbidden. Student privileges required." });
  }
  next();
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Access forbidden. Admin privileges required." });
  }
  next();
};

module.exports = { authMiddleware, teacherOnly, studentOnly, adminOnly };

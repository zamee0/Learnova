const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No authentication token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "learnova_super_secret_jwt_key_2026");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid, expired, or malformed authentication token." });
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

module.exports = { authMiddleware, teacherOnly, studentOnly };
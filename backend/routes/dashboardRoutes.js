const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getStats } = require("../controllers/dashboardController");

router.get("/stats", verifyToken, getStats);

module.exports = router;

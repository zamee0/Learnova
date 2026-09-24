const router = require("express").Router();
const c = require("../controllers/dashboardController");
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/stats", authMiddleware, c.getStats);
router.get("/profile-stats", authMiddleware, c.getProfileStats);
module.exports = router;

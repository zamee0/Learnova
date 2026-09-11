const router = require("express").Router();
const c = require("../controllers/dashboardController");
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/stats", authMiddleware, c.getStats);
module.exports = router;

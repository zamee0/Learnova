const router = require("express").Router();
const dashboardController = require("../controllers/dashboardController");
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/stats", authMiddleware, dashboardController.getStats);
module.exports = router;
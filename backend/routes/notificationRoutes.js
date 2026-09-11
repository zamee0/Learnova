const router = require("express").Router();
const c = require("../controllers/notificationController");
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/", authMiddleware, c.getNotifications);
router.put("/read-all", authMiddleware, c.markAllAsRead);
router.put("/:id/read", authMiddleware, c.markAsRead);
module.exports = router;

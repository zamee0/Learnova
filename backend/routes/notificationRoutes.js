const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getMyNotifications, markAsRead, markAllAsRead } = require("../controllers/notificationController");

router.get("/", verifyToken, getMyNotifications);
router.put("/read-all", verifyToken, markAllAsRead);
router.put("/:id/read", verifyToken, markAsRead);

module.exports = router;

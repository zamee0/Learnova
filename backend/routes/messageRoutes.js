const router = require("express").Router();
const messageController = require("../controllers/messageController");
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/", authMiddleware, messageController.getConversations);
router.get("/:otherUserId", authMiddleware, messageController.getMessagesWithUser);
router.post("/", authMiddleware, messageController.sendMessage);
module.exports = router;
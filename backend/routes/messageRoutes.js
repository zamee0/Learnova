const router = require("express").Router();
const c = require("../controllers/messageController");
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/", authMiddleware, c.getConversations);
router.get("/:otherUserId", authMiddleware, c.getMessagesWithUser);
router.post("/", authMiddleware, c.sendMessage);
module.exports = router;

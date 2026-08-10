const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { sendMessage, getConversation, getConversationList } = require("../controllers/messageController");

router.get("/", verifyToken, getConversationList);
router.get("/:otherUserId", verifyToken, getConversation);
router.post("/", verifyToken, sendMessage);

module.exports = router;

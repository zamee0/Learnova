const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
    getDiscussionsByCourse,
    getDiscussionById,
    createDiscussion,
    addReply,
    deleteDiscussion,
    deleteReply
} = require("../controllers/discussionController");

// Course discussions
router.get("/course/:courseId", getDiscussionsByCourse);
router.get("/", getDiscussionsByCourse);

// Single discussion thread + replies
router.get("/:id", getDiscussionById);

// Create discussion thread
router.post("/", verifyToken, createDiscussion);

// Reply to discussion thread
router.post("/:id/replies", verifyToken, addReply);

// Delete discussion thread
router.delete("/:id", verifyToken, deleteDiscussion);

// Delete reply
router.delete("/replies/:replyId", verifyToken, deleteReply);

module.exports = router;

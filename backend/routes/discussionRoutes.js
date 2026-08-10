const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getDiscussionsForCourse, createDiscussion, getReplies, postReply } = require("../controllers/discussionController");

router.get("/course/:courseId", verifyToken, getDiscussionsForCourse);
router.post("/", verifyToken, createDiscussion);
router.get("/:id/replies", verifyToken, getReplies);
router.post("/:id/replies", verifyToken, postReply);

module.exports = router;

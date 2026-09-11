const router = require("express").Router();
const c = require("../controllers/discussionController");
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/my-discussions", authMiddleware, c.getAllMyDiscussions);
router.get("/course/:courseId", authMiddleware, c.getDiscussionsByCourse);
router.post("/", authMiddleware, c.createDiscussion);
router.get("/:id/replies", authMiddleware, c.getReplies);
router.post("/:id/replies", authMiddleware, c.createReply);
module.exports = router;

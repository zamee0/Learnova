const router = require("express").Router();
const discussionController = require("../controllers/discussionController");
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/my-discussions", authMiddleware, discussionController.getAllMyDiscussions);
router.get("/course/:courseId", authMiddleware, discussionController.getDiscussionsByCourse);
router.post("/", authMiddleware, discussionController.createDiscussion);
router.get("/:id/replies", authMiddleware, discussionController.getReplies);
router.post("/:id/replies", authMiddleware, discussionController.createReply);
module.exports = router;
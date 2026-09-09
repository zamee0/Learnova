const router = require("express").Router();
const announcementController = require("../controllers/announcementController");
const { authMiddleware, teacherOnly } = require("../middleware/authMiddleware");
router.get("/recent", authMiddleware, announcementController.getRecentAnnouncements);
router.get("/course/:courseId", announcementController.getAnnouncementsByCourse);
router.post("/", authMiddleware, teacherOnly, announcementController.createAnnouncement);
module.exports = router;
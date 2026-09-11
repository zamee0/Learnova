const router = require("express").Router();
const c = require("../controllers/announcementController");
const { authMiddleware, teacherOnly } = require("../middleware/authMiddleware");
router.get("/recent", authMiddleware, c.getRecentAnnouncements);
router.get("/course/:courseId", c.getAnnouncementsByCourse);
router.post("/", authMiddleware, teacherOnly, c.createAnnouncement);
module.exports = router;

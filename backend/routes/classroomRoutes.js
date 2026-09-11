const router = require("express").Router();
const c = require("../controllers/classroomController");
const { authMiddleware, teacherOnly } = require("../middleware/authMiddleware");

router.get("/courses/:courseId/posts", authMiddleware, c.getClassroomPosts);
router.post("/posts", authMiddleware, teacherOnly, c.createClassroomPost);
router.get("/courses/:courseId/videos", authMiddleware, c.getCourseVideos);
router.post("/videos", authMiddleware, teacherOnly, c.createCourseVideo);
router.get("/courses/:courseId/live", authMiddleware, c.getLiveClasses);
router.post("/live", authMiddleware, teacherOnly, c.createLiveClass);

module.exports = router;
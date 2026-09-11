const router = require("express").Router();
const c = require("../controllers/courseController");
const { authMiddleware, teacherOnly } = require("../middleware/authMiddleware");

const optAuth = (req, res, next) => {
  if (req.headers.authorization?.startsWith("Bearer ")) return authMiddleware(req, res, next);
  next();
};

router.get("/", optAuth, c.getAllCourses);
router.get("/my-courses", authMiddleware, c.getMyCourses);
router.get("/teaching", authMiddleware, teacherOnly, c.getTeachingCourses);
router.get("/:id", optAuth, c.getCourseById);
router.post("/", authMiddleware, teacherOnly, c.createCourse);
router.put("/:id", authMiddleware, c.updateCourse);
router.delete("/:id/banner", authMiddleware, teacherOnly, c.deleteCourseBanner);
router.get("/:id/students", authMiddleware, teacherOnly, c.getEnrolledStudents);
router.post("/:id/students/:studentId/moderate", authMiddleware, teacherOnly, c.banOrRemoveStudent);
router.post("/:id/reviews", authMiddleware, c.addReview);
router.get("/:id/reviews", c.getReviews);
router.post("/:id/complete", authMiddleware, c.completeCourse);
module.exports = router;

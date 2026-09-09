const router = require("express").Router();
const courseController = require("../controllers/courseController");
const { authMiddleware, teacherOnly } = require("../middleware/authMiddleware");

router.get("/", (req, res, next) => {
  // Optional auth extraction to identify student enrollment status
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return authMiddleware(req, res, () => courseController.getAllCourses(req, res, next));
  }
  return courseController.getAllCourses(req, res, next);
});
router.get("/my-courses", authMiddleware, courseController.getMyCourses);
router.get("/teaching", authMiddleware, teacherOnly, courseController.getTeachingCourses);
router.get("/:id", (req, res, next) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return authMiddleware(req, res, () => courseController.getCourseById(req, res, next));
  }
  return courseController.getCourseById(req, res, next);
});
router.post("/", authMiddleware, teacherOnly, courseController.createCourse);
module.exports = router;
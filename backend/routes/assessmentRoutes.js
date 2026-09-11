const router = require("express").Router();
const c = require("../controllers/assessmentController");
const { authMiddleware, teacherOnly } = require("../middleware/authMiddleware");

router.get("/courses/:courseId/assignments", authMiddleware, c.getAssignments);
router.post("/assignments", authMiddleware, teacherOnly, c.createAssignment);
router.post("/assignments/:id/submit", authMiddleware, c.submitAssignment);
router.get("/courses/:courseId/exams", authMiddleware, c.getExams);
router.post("/exams", authMiddleware, teacherOnly, c.createExam);
router.post("/exams/:id/start", authMiddleware, c.startExam);
router.post("/exams/:id/submit", authMiddleware, c.submitExam);

module.exports = router;
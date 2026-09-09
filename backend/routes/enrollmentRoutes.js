const router = require("express").Router();
const enrollmentController = require("../controllers/enrollmentController");
const { authMiddleware, studentOnly } = require("../middleware/authMiddleware");
router.post("/", authMiddleware, studentOnly, enrollmentController.enroll);
router.delete("/:id", authMiddleware, studentOnly, enrollmentController.unenroll);
module.exports = router;
const express = require("express");
const router = express.Router();
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const { enrollInCourse, getEnrollmentsForCourse, unenroll } = require("../controllers/enrollmentController");

router.post("/", verifyToken, verifyRole("student"), enrollInCourse);
router.delete("/:id", verifyToken, verifyRole("student"), unenroll);
router.get("/course/:courseId", verifyToken, verifyRole("teacher"), getEnrollmentsForCourse);

module.exports = router;

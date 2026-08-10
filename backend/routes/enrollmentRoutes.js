const express = require("express");
const router = express.Router();
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const { enrollInCourse, getEnrollmentsForCourse } = require("../controllers/enrollmentController");

router.post("/", verifyToken, verifyRole("student"), enrollInCourse);
router.get("/course/:courseId", verifyToken, verifyRole("teacher"), getEnrollmentsForCourse);

module.exports = router;

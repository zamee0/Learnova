const express = require("express");
const router = express.Router();
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const { getAllCourses, getCourseById, getMyCourses, getTeachingCourses, createCourse } = require("../controllers/courseController");

router.get("/", getAllCourses);
router.get("/my", verifyToken, verifyRole("student"), getMyCourses);
router.get("/teaching", verifyToken, verifyRole("teacher"), getTeachingCourses);
router.get("/:id", getCourseById);
router.post("/", verifyToken, verifyRole("teacher"), createCourse);

module.exports = router;

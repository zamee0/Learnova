const express = require("express");
const router = express.Router();
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const { getAnnouncementsForCourse, createAnnouncement } = require("../controllers/announcementController");

router.get("/course/:courseId", getAnnouncementsForCourse);
router.post("/", verifyToken, verifyRole("teacher"), createAnnouncement);

module.exports = router;

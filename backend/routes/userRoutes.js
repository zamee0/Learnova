const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getMyProfile, getUserProfile, updateMyProfile, searchUsers } = require("../controllers/userController");

router.get("/me", verifyToken, getMyProfile);
router.put("/me", verifyToken, updateMyProfile);
router.get("/search", verifyToken, searchUsers);
router.get("/:id", verifyToken, getUserProfile);

module.exports = router;

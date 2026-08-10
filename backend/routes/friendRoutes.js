const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { sendFriendRequest, respondToFriendRequest, getIncomingRequests, getMyFriends } = require("../controllers/friendController");

router.post("/request", verifyToken, sendFriendRequest);
router.put("/request/:id", verifyToken, respondToFriendRequest);
router.get("/requests", verifyToken, getIncomingRequests);
router.get("/", verifyToken, getMyFriends);

module.exports = router;

const router = require("express").Router();
const friendController = require("../controllers/friendController");
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/", authMiddleware, friendController.getFriends);
router.get("/requests", authMiddleware, friendController.getRequests);
router.post("/request", authMiddleware, friendController.sendRequest);
router.put("/request/:id", authMiddleware, friendController.respondRequest);
module.exports = router;
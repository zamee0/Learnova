const router = require("express").Router();
const c = require("../controllers/friendController");
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/", authMiddleware, c.getFriends);
router.get("/requests", authMiddleware, c.getRequests);
router.post("/request", authMiddleware, c.sendRequest);
router.put("/request/:id", authMiddleware, c.respondRequest);
module.exports = router;

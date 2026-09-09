const router = require("express").Router();
const userController = require("../controllers/userController");
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/me", authMiddleware, userController.getMe);
router.put("/profile", authMiddleware, userController.updateProfile);
module.exports = router;
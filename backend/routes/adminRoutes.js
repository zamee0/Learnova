const router = require("express").Router();
const c = require("../controllers/adminController");
const { authMiddleware, adminOnly } = require("../middleware/authMiddleware");

router.get("/dashboard", authMiddleware, adminOnly, c.getDashboardStats);
router.put("/users/:id/status", authMiddleware, adminOnly, c.toggleUserStatus);
router.delete("/courses/:id", authMiddleware, adminOnly, c.deleteCourse);

module.exports = router;
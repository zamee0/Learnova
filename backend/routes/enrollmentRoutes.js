const router = require("express").Router();
const c = require("../controllers/enrollmentController");
const { authMiddleware, studentOnly } = require("../middleware/authMiddleware");
router.post("/", authMiddleware, studentOnly, c.enroll);
router.delete("/:id", authMiddleware, studentOnly, c.unenroll);
module.exports = router;

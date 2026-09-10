const pool = require("../config/db");

exports.getStats = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const role = req.user.role;

    if (role === "teacher") {
      const courseCount = await pool.query(
        "SELECT COUNT(*)::int AS count FROM courses WHERE teacher_id = $1",
        [userId]
      );

      const discussionCount = await pool.query(
        `SELECT COUNT(d.discussion_id)::int AS count 
         FROM discussions d 
         JOIN courses c ON d.course_id = c.course_id 
         WHERE c.teacher_id = $1`,
        [userId]
      );

      const unreadNotif = await pool.query(
        "SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE",
        [userId]
      );

      return res.status(200).json({
        totalCourses: courseCount.rows[0].count,
        totalDiscussions: discussionCount.rows[0].count,
        unreadNotifications: unreadNotif.rows[0].count
      });
    } else {
      const enrollmentCount = await pool.query(
        "SELECT COUNT(*)::int AS count FROM enrollments WHERE student_id = $1",
        [userId]
      );

      const activeDiscussions = await pool.query(
        `SELECT COUNT(d.discussion_id)::int AS count 
         FROM discussions d 
         WHERE d.course_id IN (SELECT course_id FROM enrollments WHERE student_id = $1)`,
        [userId]
      );

      const unreadNotif = await pool.query(
        "SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE",
        [userId]
      );

      return res.status(200).json({
        enrolledCourses: enrollmentCount.rows[0].count,
        activeDiscussions: activeDiscussions.rows[0].count,
        unreadNotifications: unreadNotif.rows[0].count
      });
    }
  } catch (err) {
    next(err);
  }
};
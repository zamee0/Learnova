const pool = require("../config/db");

exports.getDashboardStats = async (req, res, next) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM users WHERE role = 'student') AS total_students,
        (SELECT COUNT(*)::int FROM users WHERE role = 'teacher') AS total_teachers,
        (SELECT COUNT(*)::int FROM courses) AS total_courses,
        (SELECT COUNT(*)::int FROM enrollments) AS total_enrollments,
        (SELECT COUNT(*)::int FROM course_completions) AS total_completions,
        (SELECT COUNT(*)::int FROM users WHERE last_active_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes') AS active_now
    `);

    const recentUsers = await pool.query(
      "SELECT id, first_name || ' ' || last_name AS name, email, role, is_active, created_at FROM users ORDER BY created_at DESC LIMIT 10"
    );
    const recentCourses = await pool.query(
      `SELECT c.id, c.title, c.category, c.level, c.created_at, u.first_name || ' ' || u.last_name AS teacher_name
       FROM courses c JOIN users u ON c.teacher_id = u.id ORDER BY c.created_at DESC LIMIT 10`
    );

    return res.status(200).json({ metrics: stats.rows[0], recentUsers: recentUsers.rows, recentCourses: recentCourses.rows });
  } catch (err) {
    next(err);
  }
};

exports.toggleUserStatus = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { is_active } = req.body;
    await pool.query("UPDATE users SET is_active = $1 WHERE id = $2", [!!is_active, userId]);
    return res.status(200).json({ message: `User status set to ${is_active ? 'active' : 'suspended'}.` });
  } catch (err) {
    next(err);
  }
};

exports.deleteCourse = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    await pool.query("DELETE FROM courses WHERE id = $1", [courseId]);
    return res.status(200).json({ message: "Course removed by administrator." });
  } catch (err) {
    next(err);
  }
};
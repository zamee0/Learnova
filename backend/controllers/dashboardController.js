const pool = require("../config/db");

exports.getStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role === "teacher") {
      const courseCount = await pool.query("SELECT COUNT(*)::int AS count FROM courses WHERE teacher_id = $1", [userId]);
      const discussionCount = await pool.query("SELECT COUNT(d.id)::int AS count FROM discussions d JOIN courses c ON d.course_id = c.id WHERE c.teacher_id = $1", [userId]);
      const unreadNotif = await pool.query("SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE", [userId]);

      return res.status(200).json({
        totalCourses: courseCount.rows[0].count,
        totalDiscussions: discussionCount.rows[0].count,
        unreadNotifications: unreadNotif.rows[0].count
      });
    } else {
      const enrollmentCount = await pool.query("SELECT COUNT(*)::int AS count FROM enrollments WHERE user_id = $1", [userId]);
      const activeDiscussions = await pool.query("SELECT COUNT(d.id)::int AS count FROM discussions d WHERE d.course_id IN (SELECT course_id FROM enrollments WHERE user_id = $1)", [userId]);
      const unreadNotif = await pool.query("SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE", [userId]);

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

exports.getProfileStats = async (req, res, next) => {
  try {
    if (req.user.role === 'teacher') {
      const result = await pool.query(`SELECT c.id, c.title, COUNT(DISTINCT e.id)::int AS students,
        COALESCE(ROUND(AVG(r.rating)::numeric,1),0)::float AS rating
        FROM courses c LEFT JOIN enrollments e ON e.course_id=c.id AND e.status <> 'dropped'
        LEFT JOIN course_reviews r ON r.course_id=c.id WHERE c.teacher_id=$1 GROUP BY c.id ORDER BY students DESC`, [req.user.id]);
      return res.json({ role:'teacher', courses:result.rows, metrics:{ courses:result.rowCount, students:result.rows.reduce((n,c)=>n+c.students,0), rating:result.rowCount ? Number((result.rows.reduce((n,c)=>n+c.rating,0)/result.rowCount).toFixed(1)) : 0 } });
    }
    const result = await pool.query(`SELECT c.id, c.title, c.category, e.progress_percent::float AS progress, e.status
      FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=$1 ORDER BY c.title`, [req.user.id]);
    const completed = result.rows.filter(c=>c.status==='completed').length;
    return res.json({ role:'student', courses:result.rows, metrics:{ courses:result.rowCount, completed, averageProgress:result.rowCount ? Math.round(result.rows.reduce((n,c)=>n+c.progress,0)/result.rowCount) : 0 } });
  } catch (err) { next(err); }
};

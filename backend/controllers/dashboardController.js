const pool = require("../config/db");

// GET /api/dashboard/stats
async function getStats(req, res) {
    try {
        const { id, role } = req.user;

        if (role === "student") {
            const [courses, discussions, notifs] = await Promise.all([
                pool.query("SELECT COUNT(*) FROM enrollments WHERE student_id = $1", [id]),
                pool.query(`SELECT COUNT(*) FROM discussions WHERE course_id IN
                            (SELECT course_id FROM enrollments WHERE student_id = $1)`, [id]),
                pool.query("SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE", [id])
            ]);
            return res.json({
                enrolled_courses: parseInt(courses.rows[0].count, 10),
                active_discussions: parseInt(discussions.rows[0].count, 10),
                unread_notifications: parseInt(notifs.rows[0].count, 10)
            });
        }

        // teacher
        const [courses, discussions, notifs] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM courses WHERE teacher_id = $1", [id]),
            pool.query(`SELECT COUNT(*) FROM discussions WHERE course_id IN
                        (SELECT course_id FROM courses WHERE teacher_id = $1)`, [id]),
            pool.query("SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE", [id])
        ]);
        res.json({
            teaching_courses: parseInt(courses.rows[0].count, 10),
            active_discussions: parseInt(discussions.rows[0].count, 10),
            unread_notifications: parseInt(notifs.rows[0].count, 10)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
}

module.exports = { getStats };

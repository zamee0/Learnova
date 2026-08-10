const pool = require("../config/db");

// GET /api/announcements/course/:courseId
async function getAnnouncementsForCourse(req, res) {
    try {
        const { courseId } = req.params;
        const result = await pool.query(`
            SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS teacher_name
            FROM announcements a
            JOIN users u ON a.teacher_id = u.user_id
            WHERE a.course_id = $1
            ORDER BY a.created_at DESC
        `, [courseId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch announcements" });
    }
}

// POST /api/announcements (teacher only, must own the course)
// Also fans out a notification to every student enrolled in the course - this is the
// real "database work" here: one INSERT ... SELECT instead of a loop of individual inserts.
async function createAnnouncement(req, res) {
    const client = await pool.connect();
    try {
        const { course_id, title, content } = req.body;
        if (!course_id || !title || !content) {
            return res.status(400).json({ error: "course_id, title and content are required" });
        }

        const courseCheck = await client.query("SELECT teacher_id FROM courses WHERE course_id = $1", [course_id]);
        if (courseCheck.rows.length === 0) return res.status(404).json({ error: "Course not found" });
        if (courseCheck.rows[0].teacher_id !== req.user.id) {
            return res.status(403).json({ error: "Not your course" });
        }

        await client.query("BEGIN");

        const announcementResult = await client.query(
            `INSERT INTO announcements (course_id, teacher_id, title, content)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [course_id, req.user.id, title, content]
        );

        // Notify every enrolled student in one query
        await client.query(
            `INSERT INTO notifications (user_id, title, message, type)
             SELECT student_id, $1, $2, 'announcement'
             FROM enrollments WHERE course_id = $3`,
            [`New announcement: ${title}`, content, course_id]
        );

        await client.query("COMMIT");
        res.status(201).json({ message: "Announcement posted and students notified", announcement: announcementResult.rows[0] });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({ error: "Failed to post announcement" });
    } finally {
        client.release();
    }
}

module.exports = { getAnnouncementsForCourse, createAnnouncement };

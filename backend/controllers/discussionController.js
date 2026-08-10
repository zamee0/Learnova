const pool = require("../config/db");

// Checks the user is either the course's teacher or an enrolled student
async function canAccessCourse(courseId, userId) {
    const course = await pool.query("SELECT teacher_id FROM courses WHERE course_id = $1", [courseId]);
    if (course.rows.length === 0) return false;
    if (course.rows[0].teacher_id === userId) return true;

    const enrollment = await pool.query(
        "SELECT 1 FROM enrollments WHERE course_id = $1 AND student_id = $2", [courseId, userId]
    );
    return enrollment.rows.length > 0;
}

// GET /api/discussions/course/:courseId
async function getDiscussionsForCourse(req, res) {
    try {
        const { courseId } = req.params;
        const result = await pool.query(`
            SELECT d.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name, u.role AS author_role, u.avatar_url,
                   (SELECT COUNT(*) FROM discussion_replies r WHERE r.discussion_id = d.discussion_id) AS reply_count
            FROM discussions d
            JOIN users u ON d.user_id = u.user_id
            WHERE d.course_id = $1
            ORDER BY d.created_at DESC
        `, [courseId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch discussions" });
    }
}

// POST /api/discussions - start a new thread (must be enrolled or be the teacher)
async function createDiscussion(req, res) {
    try {
        const { course_id, title, content } = req.body;
        if (!course_id || !title || !content) {
            return res.status(400).json({ error: "course_id, title and content are required" });
        }

        const allowed = await canAccessCourse(course_id, req.user.id);
        if (!allowed) return res.status(403).json({ error: "You must be enrolled in this course to post" });

        const result = await pool.query(
            `INSERT INTO discussions (course_id, user_id, title, content) VALUES ($1, $2, $3, $4) RETURNING *`,
            [course_id, req.user.id, title, content]
        );
        res.status(201).json({ message: "Discussion posted", discussion: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to post discussion" });
    }
}

// GET /api/discussions/:id/replies
async function getReplies(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT r.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name, u.role AS author_role, u.avatar_url
            FROM discussion_replies r
            JOIN users u ON r.user_id = u.user_id
            WHERE r.discussion_id = $1
            ORDER BY r.created_at ASC
        `, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch replies" });
    }
}

// POST /api/discussions/:id/replies
async function postReply(req, res) {
    try {
        const { id } = req.params;
        const { content } = req.body;
        if (!content) return res.status(400).json({ error: "content is required" });

        const discussion = await pool.query("SELECT course_id FROM discussions WHERE discussion_id = $1", [id]);
        if (discussion.rows.length === 0) return res.status(404).json({ error: "Discussion not found" });

        const allowed = await canAccessCourse(discussion.rows[0].course_id, req.user.id);
        if (!allowed) return res.status(403).json({ error: "You must be enrolled in this course to reply" });

        const result = await pool.query(
            "INSERT INTO discussion_replies (discussion_id, user_id, content) VALUES ($1, $2, $3) RETURNING *",
            [id, req.user.id, content]
        );
        res.status(201).json({ message: "Reply posted", reply: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to post reply" });
    }
}

module.exports = { getDiscussionsForCourse, createDiscussion, getReplies, postReply };

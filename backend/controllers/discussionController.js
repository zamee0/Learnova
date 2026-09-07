const pool = require("../config/db");

// GET /api/discussions/course/:courseId - list all discussions for a course
async function getDiscussionsByCourse(req, res) {
    try {
        const courseId = req.params.courseId || req.query.courseId;
        const lessonId = req.query.lessonId;

        if (!courseId) {
            return res.status(400).json({ error: "courseId is required" });
        }

        let sql = `
            SELECT d.id, d.courseid, d.lesson_id, d.title, d.content, d.author_role,
                   d.student_id, d.instructor_id, d.created_at,
                   l.title AS lesson_title,
                   CASE
                       WHEN d.author_role = 'student' THEN CONCAT(s.first_name, ' ', s.last_name)
                       ELSE CONCAT(i.first_name, ' ', i.last_name)
                   END AS author_name,
                   COUNT(r.id)::int AS reply_count
            FROM discussions d
            LEFT JOIN lessons l ON d.lesson_id = l.id
            LEFT JOIN students s ON d.student_id = s.s_id
            LEFT JOIN instructors i ON d.instructor_id = i.i_id
            LEFT JOIN discussion_replies r ON r.discussion_id = d.id
            WHERE d.courseid = $1
        `;
        const params = [courseId];

        if (lessonId) {
            sql += " AND d.lesson_id = $2";
            params.push(lessonId);
        }

        sql += `
            GROUP BY d.id, d.courseid, d.lesson_id, d.title, d.content, d.author_role,
                     d.student_id, d.instructor_id, d.created_at, l.title, s.first_name, s.last_name, i.first_name, i.last_name
            ORDER BY d.created_at DESC
        `;

        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch discussions" });
    }
}

// GET /api/discussions/:id - get discussion thread and its replies
async function getDiscussionById(req, res) {
    try {
        const { id } = req.params;

        const discussionResult = await pool.query(`
            SELECT d.*, l.title AS lesson_title,
                   CASE
                       WHEN d.author_role = 'student' THEN CONCAT(s.first_name, ' ', s.last_name)
                       ELSE CONCAT(i.first_name, ' ', i.last_name)
                   END AS author_name
            FROM discussions d
            LEFT JOIN lessons l ON d.lesson_id = l.id
            LEFT JOIN students s ON d.student_id = s.s_id
            LEFT JOIN instructors i ON d.instructor_id = i.i_id
            WHERE d.id = $1
        `, [id]);

        if (discussionResult.rows.length === 0) {
            return res.status(404).json({ error: "Discussion not found" });
        }

        const discussion = discussionResult.rows[0];

        const repliesResult = await pool.query(`
            SELECT r.*,
                   CASE
                       WHEN r.author_role = 'student' THEN CONCAT(s.first_name, ' ', s.last_name)
                       ELSE CONCAT(i.first_name, ' ', i.last_name)
                   END AS author_name
            FROM discussion_replies r
            LEFT JOIN students s ON r.student_id = s.s_id
            LEFT JOIN instructors i ON r.instructor_id = i.i_id
            WHERE r.discussion_id = $1
            ORDER BY r.created_at ASC
        `, [id]);

        discussion.replies = repliesResult.rows;

        res.json(discussion);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch discussion details" });
    }
}

// POST /api/discussions - create new discussion thread
async function createDiscussion(req, res) {
    try {
        const { courseid, lesson_id, title, content } = req.body;

        if (!courseid || !title || !content) {
            return res.status(400).json({ error: "courseid, title, and content are required" });
        }

        const author_role = req.user.role;
        const student_id = author_role === "student" ? req.user.id : null;
        const instructor_id = author_role === "instructor" ? req.user.id : null;

        const result = await pool.query(
            `INSERT INTO discussions (courseid, lesson_id, title, content, author_role, student_id, instructor_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [courseid, lesson_id || null, title, content, author_role, student_id, instructor_id]
        );

        res.status(201).json({
            message: "Discussion thread created",
            discussion: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create discussion" });
    }
}

// POST /api/discussions/:id/replies - add a reply to thread
async function addReply(req, res) {
    try {
        const { id } = req.params;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: "Reply content is required" });
        }

        const discCheck = await pool.query("SELECT id FROM discussions WHERE id = $1", [id]);
        if (discCheck.rows.length === 0) {
            return res.status(404).json({ error: "Discussion thread not found" });
        }

        const author_role = req.user.role;
        const student_id = author_role === "student" ? req.user.id : null;
        const instructor_id = author_role === "instructor" ? req.user.id : null;
        const is_instructor_answer = author_role === "instructor";

        const result = await pool.query(
            `INSERT INTO discussion_replies (discussion_id, content, author_role, student_id, instructor_id, is_instructor_answer)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [id, content, author_role, student_id, instructor_id, is_instructor_answer]
        );

        res.status(201).json({
            message: "Reply added successfully",
            reply: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to post reply" });
    }
}

// DELETE /api/discussions/:id - delete thread (author or instructor)
async function deleteDiscussion(req, res) {
    try {
        const { id } = req.params;

        const discResult = await pool.query("SELECT * FROM discussions WHERE id = $1", [id]);
        if (discResult.rows.length === 0) {
            return res.status(404).json({ error: "Discussion not found" });
        }

        const discussion = discResult.rows[0];
        const isAuthor =
            (req.user.role === "student" && discussion.student_id === req.user.id) ||
            (req.user.role === "instructor" && discussion.instructor_id === req.user.id);

        if (!isAuthor && req.user.role !== "instructor") {
            return res.status(403).json({ error: "Not authorized to delete this discussion" });
        }

        await pool.query("DELETE FROM discussions WHERE id = $1", [id]);
        res.json({ message: "Discussion deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete discussion" });
    }
}

// DELETE /api/discussions/replies/:replyId - delete a reply
async function deleteReply(req, res) {
    try {
        const { replyId } = req.params;

        const replyResult = await pool.query("SELECT * FROM discussion_replies WHERE id = $1", [replyId]);
        if (replyResult.rows.length === 0) {
            return res.status(404).json({ error: "Reply not found" });
        }

        const reply = replyResult.rows[0];
        const isAuthor =
            (req.user.role === "student" && reply.student_id === req.user.id) ||
            (req.user.role === "instructor" && reply.instructor_id === req.user.id);

        if (!isAuthor && req.user.role !== "instructor") {
            return res.status(403).json({ error: "Not authorized to delete this reply" });
        }

        await pool.query("DELETE FROM discussion_replies WHERE id = $1", [replyId]);
        res.json({ message: "Reply deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete reply" });
    }
}

module.exports = {
    getDiscussionsByCourse,
    getDiscussionById,
    createDiscussion,
    addReply,
    deleteDiscussion,
    deleteReply
};

const pool = require("../config/db");

// POST /api/enrollments (student only)
async function enrollInCourse(req, res) {
    try {
        const { course_id } = req.body;
        if (!course_id) return res.status(400).json({ error: "course_id is required" });

        const result = await pool.query(
            "INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) RETURNING *",
            [req.user.id, course_id]
        );
        res.status(201).json({ message: "Enrolled successfully", enrollment: result.rows[0] });
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "Already enrolled in this course" });
        }
        console.error(err);
        res.status(500).json({ error: "Enrollment failed" });
    }
}

// GET /api/enrollments/course/:courseId - teacher: who's enrolled in my course
async function getEnrollmentsForCourse(req, res) {
    try {
        const { courseId } = req.params;
        const result = await pool.query(`
            SELECT u.user_id, u.first_name, u.last_name, u.email, u.avatar_url, e.enrolled_at
            FROM enrollments e
            JOIN users u ON e.student_id = u.user_id
            WHERE e.course_id = $1
        `, [courseId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch enrollments" });
    }
}

// DELETE /api/enrollments/:id (student only, must own the enrollment)
async function unenroll(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "DELETE FROM enrollments WHERE enrollment_id = $1 AND student_id = $2 RETURNING *",
            [id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Enrollment not found" });
        res.json({ message: "Unenrolled successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to unenroll" });
    }
}

module.exports = { enrollInCourse, getEnrollmentsForCourse, unenroll };

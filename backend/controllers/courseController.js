const pool = require("../config/db");

// GET /api/courses - browse all published courses (optionally filter by category)
async function getAllCourses(req, res) {
    try {
        const { category } = req.query;
        let sql = `
            SELECT c.course_id, c.title, c.description, c.category, c.thumbnail_url, c.level, c.created_at,
                   CONCAT(u.first_name, ' ', u.last_name) AS teacher_name,
                   u.user_id AS teacher_id,
                   COUNT(e.enrollment_id) AS enrolled_count
            FROM courses c
            JOIN users u ON c.teacher_id = u.user_id
            LEFT JOIN enrollments e ON e.course_id = c.course_id
            WHERE c.is_published = TRUE
        `;
        const params = [];
        if (category) {
            params.push(category);
            sql += ` AND c.category = $${params.length}`;
        }
        sql += " GROUP BY c.course_id, u.first_name, u.last_name, u.user_id ORDER BY c.created_at DESC";

        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch courses" });
    }
}

// GET /api/courses/:id
async function getCourseById(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT c.*, CONCAT(u.first_name, ' ', u.last_name) AS teacher_name, u.avatar_url AS teacher_avatar
            FROM courses c
            JOIN users u ON c.teacher_id = u.user_id
            WHERE c.course_id = $1
        `, [id]);

        if (result.rows.length === 0) return res.status(404).json({ error: "Course not found" });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch course" });
    }
}

// GET /api/courses/my - student: courses I'm enrolled in
async function getMyCourses(req, res) {
    try {
        const result = await pool.query(`
            SELECT c.course_id, c.title, c.description, c.thumbnail_url, e.enrolled_at
            FROM enrollments e
            JOIN courses c ON e.course_id = c.course_id
            WHERE e.student_id = $1
            ORDER BY e.enrolled_at DESC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch your courses" });
    }
}

// GET /api/courses/teaching - teacher: courses I created
async function getTeachingCourses(req, res) {
    try {
        const result = await pool.query(
            "SELECT * FROM courses WHERE teacher_id = $1 ORDER BY created_at DESC",
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch your courses" });
    }
}

// POST /api/courses (teacher only)
async function createCourse(req, res) {
    try {
        const { title, description, category, thumbnail_url, level } = req.body;
        if (!title) return res.status(400).json({ error: "title is required" });

        const result = await pool.query(
            `INSERT INTO courses (teacher_id, title, description, category, thumbnail_url, level)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [req.user.id, title, description || null, category || null, thumbnail_url || null, level || "Beginner"]
        );
        res.status(201).json({ message: "Course created", course: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create course" });
    }
}

module.exports = { getAllCourses, getCourseById, getMyCourses, getTeachingCourses, createCourse };

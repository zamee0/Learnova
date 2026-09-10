const pool = require("../config/db");

// Get all published courses
exports.getAllCourses = async (req, res, next) => {
  try {
    const currentUserId = req.user ? (req.user.user_id || req.user.id) : null;

    const query = `
      SELECT 
        c.course_id,
        c.course_id AS id,
        c.title,
        c.description,
        c.category,
        c.level,
        c.thumbnail_url,
        c.created_at,
        u.first_name || ' ' || u.last_name AS teacher_name,
        u.email AS teacher_email,
        COUNT(DISTINCT e.enrollment_id)::int AS enrolled_count,
        CASE 
          WHEN $1::int IS NOT NULL AND EXISTS (
            SELECT 1 FROM enrollments WHERE student_id = $1::int AND course_id = c.course_id
          ) THEN TRUE 
          ELSE FALSE 
        END AS is_enrolled
      FROM courses c
      JOIN users u ON c.teacher_id = u.user_id
      LEFT JOIN enrollments e ON c.course_id = e.course_id
      WHERE c.is_published = TRUE
      GROUP BY c.course_id, u.first_name, u.last_name, u.email
      ORDER BY c.created_at DESC
    `;

    const result = await pool.query(query, [currentUserId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Get single course details
exports.getCourseById = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const currentUserId = req.user ? (req.user.user_id || req.user.id) : null;

    if (isNaN(courseId)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }

    const query = `
      SELECT 
        c.course_id,
        c.course_id AS id,
        c.title,
        c.description,
        c.category,
        c.level,
        c.thumbnail_url,
        c.teacher_id,
        c.created_at,
        u.first_name || ' ' || u.last_name AS teacher_name,
        u.email AS teacher_email,
        u.bio AS teacher_bio,
        COUNT(DISTINCT e.enrollment_id)::int AS enrolled_count,
        CASE 
          WHEN $2::int IS NOT NULL AND EXISTS (
            SELECT 1 FROM enrollments WHERE student_id = $2::int AND course_id = c.course_id
          ) THEN TRUE 
          ELSE FALSE 
        END AS is_enrolled
      FROM courses c
      JOIN users u ON c.teacher_id = u.user_id
      LEFT JOIN enrollments e ON c.course_id = e.course_id
      WHERE c.course_id = $1
      GROUP BY c.course_id, u.first_name, u.last_name, u.email, u.bio
    `;

    const result = await pool.query(query, [courseId, currentUserId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Course not found." });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Get courses enrolled by the current student
exports.getMyCourses = async (req, res, next) => {
  try {
    const studentId = req.user.user_id || req.user.id;

    const query = `
      SELECT 
        c.course_id,
        c.course_id AS id,
        c.title,
        c.description,
        c.category,
        c.level,
        c.thumbnail_url,
        e.enrollment_id,
        e.enrollment_id AS id,
        e.enrolled_at,
        u.first_name || ' ' || u.last_name AS teacher_name
      FROM enrollments e
      JOIN courses c ON e.course_id = c.course_id
      JOIN users u ON c.teacher_id = u.user_id
      WHERE e.student_id = $1
      ORDER BY e.enrolled_at DESC
    `;

    const result = await pool.query(query, [studentId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Get courses created by the teacher
exports.getTeachingCourses = async (req, res, next) => {
  try {
    const teacherId = req.user.user_id || req.user.id;

    const query = `
      SELECT 
        c.course_id,
        c.course_id AS id,
        c.title,
        c.description,
        c.category,
        c.level,
        c.thumbnail_url,
        c.created_at,
        COUNT(DISTINCT e.enrollment_id)::int AS enrolled_count,
        COUNT(DISTINCT d.discussion_id)::int AS discussions_count
      FROM courses c
      LEFT JOIN enrollments e ON c.course_id = e.course_id
      LEFT JOIN discussions d ON c.course_id = d.course_id
      WHERE c.teacher_id = $1
      GROUP BY c.course_id
      ORDER BY c.created_at DESC
    `;

    const result = await pool.query(query, [teacherId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Create a new course (Teacher only)
exports.createCourse = async (req, res, next) => {
  try {
    const teacherId = req.user.user_id || req.user.id;
    const { title, description, category, level, thumbnail_url } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ error: "Title, description, and category are required." });
    }

    const result = await pool.query(
      `INSERT INTO courses (teacher_id, title, description, category, level, thumbnail_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *, course_id AS id`,
      [
        teacherId,
        title.trim(),
        description.trim(),
        category.trim(),
        level || "Beginner",
        thumbnail_url || "https://picsum.photos/seed/learnova/400/240"
      ]
    );

    return res.status(201).json({ message: "Course created successfully", course: result.rows[0] });
  } catch (err) {
    next(err);
  }
};
const pool = require("../config/db");

// Get all courses with instructor details & enrollment counts
exports.getAllCourses = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;

    const query = `
      SELECT 
        c.id, 
        c.title, 
        c.description, 
        c.category, 
        c.level, 
        c.thumbnail_url, 
        c.created_at,
        u.first_name || ' ' || u.last_name AS teacher_name,
        u.email AS teacher_email,
        COUNT(DISTINCT e.id)::int AS enrolled_count,
        CASE 
          WHEN $1::int IS NOT NULL AND EXISTS (
            SELECT 1 FROM enrollments WHERE user_id = $1::int AND course_id = c.id
          ) THEN TRUE 
          ELSE FALSE 
        END AS is_enrolled
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN enrollments e ON c.id = e.course_id
      GROUP BY c.id, u.first_name, u.last_name, u.email
      ORDER BY c.created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Get single course details
exports.getCourseById = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const userId = req.user ? req.user.id : null;

    if (isNaN(courseId)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }

    const query = `
      SELECT 
        c.id, 
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
        COUNT(DISTINCT e.id)::int AS enrolled_count,
        CASE 
          WHEN $2::int IS NOT NULL AND EXISTS (
            SELECT 1 FROM enrollments WHERE user_id = $2::int AND course_id = c.id
          ) THEN TRUE 
          ELSE FALSE 
        END AS is_enrolled
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN enrollments e ON c.id = e.course_id
      WHERE c.id = $1
      GROUP BY c.id, u.first_name, u.last_name, u.email, u.bio
    `;

    const result = await pool.query(query, [courseId, userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Course not found." });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Get student's enrolled courses
exports.getMyCourses = async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const query = `
      SELECT 
        c.id,
        c.title,
        c.description,
        c.category,
        c.level,
        c.thumbnail_url,
        e.id AS enrollment_id,
        e.enrolled_at,
        e.status AS enrollment_status,
        u.first_name || ' ' || u.last_name AS teacher_name
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      JOIN users u ON c.teacher_id = u.id
      WHERE e.user_id = $1
      ORDER BY e.enrolled_at DESC
    `;

    const result = await pool.query(query, [studentId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Get teacher's created courses
exports.getTeachingCourses = async (req, res, next) => {
  try {
    const teacherId = req.user.id;

    const query = `
      SELECT 
        c.id,
        c.title,
        c.description,
        c.category,
        c.level,
        c.thumbnail_url,
        c.created_at,
        COUNT(DISTINCT e.id)::int AS enrolled_count,
        COUNT(DISTINCT d.id)::int AS discussions_count
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN discussions d ON c.id = d.course_id
      WHERE c.teacher_id = $1
      GROUP BY c.id
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
    const teacherId = req.user.id;
    const { title, description, category, level, thumbnail_url } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ error: "Title, description, and category are required." });
    }

    const courseLevel = level || "Beginner";
    const thumb = thumbnail_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop";

    const result = await pool.query(
      `INSERT INTO courses (teacher_id, title, description, category, level, thumbnail_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [teacherId, title.trim(), description.trim(), category.trim(), courseLevel, thumb]
    );

    return res.status(201).json({
      message: "Course published successfully",
      course: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
};
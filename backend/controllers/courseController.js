const pool = require("../config/db");

exports.getAllCourses = async (req, res, next) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const query = `
      SELECT 
        c.id, c.title, c.description, c.category, c.level, c.thumbnail_url, c.created_at,
        u.first_name || ' ' || u.last_name AS teacher_name,
        u.avatar_url AS teacher_avatar,
        COUNT(DISTINCT e.id)::int AS enrolled_count,
        COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0.0) AS avg_rating,
        COUNT(DISTINCT r.id)::int AS review_count,
        CASE 
          WHEN $1::int IS NOT NULL AND EXISTS (
            SELECT 1 FROM enrollments WHERE user_id = $1::int AND course_id = c.id AND status IN ('active', 'completed')
          ) THEN TRUE ELSE FALSE 
        END AS is_enrolled,
        CASE 
          WHEN $1::int IS NOT NULL AND EXISTS (
            SELECT 1 FROM course_bans WHERE user_id = $1::int AND course_id = c.id
          ) THEN TRUE ELSE FALSE 
        END AS is_banned
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN course_reviews r ON c.id = r.course_id
      WHERE c.is_published = TRUE
      GROUP BY c.id, u.first_name, u.last_name, u.avatar_url
      ORDER BY c.created_at DESC
    `;
    const result = await pool.query(query, [currentUserId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getCourseById = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const currentUserId = req.user ? req.user.id : null;

    if (isNaN(courseId)) return res.status(400).json({ error: "Invalid course ID" });

    const query = `
      SELECT 
        c.id, c.title, c.description, c.category, c.level, c.thumbnail_url, c.teacher_id, c.is_published, c.created_at,
        u.first_name || ' ' || u.last_name AS teacher_name,
        u.email AS teacher_email,
        u.bio AS teacher_bio,
        tp.designation AS teacher_designation,
        tp.qualification AS teacher_qualification,
        COUNT(DISTINCT e.id)::int AS enrolled_count,
        COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0.0) AS avg_rating,
        COUNT(DISTINCT r.id)::int AS review_count,
        CASE 
          WHEN $2::int IS NOT NULL AND EXISTS (
            SELECT 1 FROM enrollments WHERE user_id = $2::int AND course_id = c.id AND status IN ('active','completed')
          ) THEN TRUE ELSE FALSE 
        END AS is_enrolled,
        CASE 
          WHEN $2::int IS NOT NULL AND EXISTS (
            SELECT 1 FROM enrollments WHERE user_id = $2::int AND course_id = c.id AND status = 'completed'
          ) THEN TRUE ELSE FALSE 
        END AS is_completed,
        CASE 
          WHEN $2::int IS NOT NULL AND EXISTS (
            SELECT 1 FROM course_bans WHERE user_id = $2::int AND course_id = c.id
          ) THEN TRUE ELSE FALSE 
        END AS is_banned
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN teacher_profiles tp ON u.id = tp.user_id
      LEFT JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN course_reviews r ON c.id = r.course_id
      WHERE c.id = $1
      GROUP BY c.id, u.first_name, u.last_name, u.email, u.bio, tp.designation, tp.qualification
    `;
    const result = await pool.query(query, [courseId, currentUserId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Course not found." });
    if (!result.rows[0].is_published && result.rows[0].teacher_id !== currentUserId && req.user?.role !== 'admin') return res.status(404).json({ error: "Course not found." });

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.createCourse = async (req, res, next) => {
  try {
    const { title, description, category, level, thumbnail_url, is_published = true } = req.body;
    if (![title, description, category].every(v => typeof v === 'string' && v.trim()) || (level && !['Beginner', 'Intermediate', 'Advanced', 'All Levels'].includes(level)) || (typeof is_published !== 'boolean')) {
      return res.status(400).json({ error: "Title, description, and category are required." });
    }

    const result = await pool.query(
      `INSERT INTO courses (teacher_id, title, description, category, level, thumbnail_url, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, title.trim(), description.trim(), category.trim(), level || 'Beginner', thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800', Boolean(is_published)]
    );

    await pool.query(
      `INSERT INTO activity_log (user_id, activity_type, description, course_id)
       VALUES ($1, 'course_created', $2, $3)`,
      [req.user.id, `Created new course: ${title}`, result.rows[0].id]
    );

    return res.status(201).json({ message: result.rows[0].is_published ? "Course published successfully" : "Draft saved successfully", course: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.updateCourse = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const { title, description, category, level, thumbnail_url, is_published } = req.body;
    if ((title != null && (typeof title !== 'string' || !title.trim())) || (description != null && (typeof description !== 'string' || !description.trim())) || (category != null && (typeof category !== 'string' || !category.trim())) || (level != null && !['Beginner', 'Intermediate', 'Advanced', 'All Levels'].includes(level)) || (is_published != null && typeof is_published !== 'boolean')) return res.status(400).json({ error: "Invalid course fields." });

    const owner = await pool.query("SELECT teacher_id FROM courses WHERE id = $1", [courseId]);
    if (owner.rows.length === 0) return res.status(404).json({ error: "Course not found." });
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: "Teacher privileges required." });
    if (owner.rows[0].teacher_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized to modify this course." });
    }

    const updated = await pool.query(
      `UPDATE courses
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           level = COALESCE($4, level),
           thumbnail_url = COALESCE($5, thumbnail_url),
           is_published = COALESCE($6, is_published),
           updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
       RETURNING *`,
      [title, description, category, level, thumbnail_url, is_published, courseId]
    );

    return res.status(200).json({ message: "Course updated successfully", course: updated.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.deleteCourseBanner = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const defaultBanner = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800";

    const owner = await pool.query("SELECT teacher_id FROM courses WHERE id = $1", [courseId]);
    if (owner.rows.length === 0) return res.status(404).json({ error: "Course not found." });
    if (owner.rows[0].teacher_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized." });
    }

    await pool.query("UPDATE courses SET thumbnail_url = $1 WHERE id = $2", [defaultBanner, courseId]);
    return res.status(200).json({ message: "Course banner reset to default.", thumbnail_url: defaultBanner });
  } catch (err) {
    next(err);
  }
};

exports.getEnrolledStudents = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const owner = await pool.query("SELECT teacher_id FROM courses WHERE id = $1", [courseId]);
    if (owner.rows.length === 0) return res.status(404).json({ error: "Course not found." });
    if (owner.rows[0].teacher_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized." });
    }

    const students = await pool.query(
      `SELECT u.id AS user_id, u.first_name || ' ' || u.last_name AS name, u.email, u.avatar_url,
              e.id AS enrollment_id, e.status, e.progress_percent, e.enrolled_at,
              sp.institution, sp.semester,
              (CURRENT_TIMESTAMP - u.last_active_at < INTERVAL '5 minutes') AS is_online
       FROM enrollments e
       JOIN users u ON e.user_id = u.id
       LEFT JOIN student_profiles sp ON u.id = sp.user_id
       WHERE e.course_id = $1
       ORDER BY e.enrolled_at DESC`,
      [courseId]
    );

    return res.status(200).json(students.rows);
  } catch (err) {
    next(err);
  }
};

exports.banOrRemoveStudent = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const courseId = parseInt(req.params.id, 10);
    const targetStudentId = parseInt(req.params.studentId, 10);
    const { action, reason } = req.body;

    const owner = await client.query("SELECT teacher_id, title FROM courses WHERE id = $1", [courseId]);
    if (owner.rows.length === 0) return res.status(404).json({ error: "Course not found." });
    if (owner.rows[0].teacher_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized." });
    }

    await client.query("BEGIN");
    await client.query("DELETE FROM enrollments WHERE course_id = $1 AND user_id = $2", [courseId, targetStudentId]);

    if (action === "ban") {
      await client.query(
        `INSERT INTO course_bans (course_id, user_id, banned_by, reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (course_id, user_id) DO UPDATE SET reason = EXCLUDED.reason`,
        [courseId, targetStudentId, req.user.id, reason || "Disciplinary removal by course instructor."]
      );

      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, 'Course Ban Notice', $2, 'general')`,
        [targetStudentId, `You have been banned from "${owner.rows[0].title}". Reason: ${reason || 'Instructor policy violation.'}`]
      );
    } else {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, 'Course Enrollment Update', $2, 'general')`,
        [targetStudentId, `Your enrollment in "${owner.rows[0].title}" was removed by the instructor.`]
      );
    }

    await client.query("COMMIT");
    return res.status(200).json({ message: `Student ${action === 'ban' ? 'banned' : 'removed'} successfully.` });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

exports.addReview = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const { rating, review } = req.body;
    if (!Number.isInteger(courseId) || courseId <= 0 || (review != null && (typeof review !== 'string' || review.length > 3000))) return res.status(400).json({ error: "Invalid course review." });
    const numRating = parseFloat(rating);

    if (isNaN(numRating) || numRating < 0 || numRating > 10) {
      return res.status(400).json({ error: "Rating must be a score from 0.0 to 10.0" });
    }

    const check = await pool.query("SELECT 1 FROM enrollments WHERE course_id = $1 AND user_id = $2", [courseId, req.user.id]);
    if (check.rows.length === 0) {
      return res.status(403).json({ error: "You must be enrolled in this course to leave a review." });
    }

    if (req.user.role !== 'student') return res.status(403).json({ error: "Only students can review courses." });
    try {
      const result = await pool.query(
        `INSERT INTO course_reviews (course_id, student_id, rating, review) VALUES ($1, $2, $3, $4) RETURNING *`,
        [courseId, req.user.id, numRating, typeof review === 'string' ? review.trim() : null]
      );
      return res.status(201).json({ message: "Course review submitted successfully!", review: result.rows[0] });
    } catch (err) {
      if (err.code !== '23505') throw err;
      if (req.method !== 'PUT') return res.status(409).json({ error: "You have already reviewed this course." });
      const updated = await pool.query(`UPDATE course_reviews SET rating = $1, review = $2, updated_at = CURRENT_TIMESTAMP WHERE course_id = $3 AND student_id = $4 RETURNING *`, [numRating, typeof review === 'string' ? review.trim() : null, courseId, req.user.id]);
      return res.status(200).json({ message: "Course review updated.", review: updated.rows[0] });
    }
  } catch (err) {
    next(err);
  }
};

exports.getReviews = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const reviews = await pool.query(
      `SELECT r.id, r.student_id, r.rating, r.review, r.created_at, u.first_name || ' ' || u.last_name AS student_name, u.avatar_url
       FROM course_reviews r
       JOIN users u ON r.student_id = u.id
       WHERE r.course_id = $1
       ORDER BY r.created_at DESC`,
      [courseId]
    );
    return res.status(200).json(reviews.rows);
  } catch (err) {
    next(err);
  }
};

exports.completeCourse = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const courseId = parseInt(req.params.id, 10);
    const studentId = req.user.id;

    const check = await client.query("SELECT title FROM courses WHERE id = $1", [courseId]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Course not found." });

    const code = `LN-${courseId}-${studentId}-${Date.now().toString(36).toUpperCase()}`;

    await client.query("BEGIN");
    await client.query(
      `UPDATE enrollments SET status = 'completed', progress_percent = 100, completed_at = CURRENT_TIMESTAMP WHERE course_id = $1 AND user_id = $2`,
      [courseId, studentId]
    );

    await client.query(
      `INSERT INTO course_completions (student_id, course_id, checkpoint_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (student_id, course_id) DO UPDATE SET checkpoint_code = EXCLUDED.checkpoint_code`,
      [studentId, courseId, code]
    );

    await client.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Course Completed!', $2, 'course_completion')`,
      [studentId, `Congratulations! You successfully finished ${check.rows[0].title}. Your checkpoint code is ${code}.`]
    );

    await client.query(
      `INSERT INTO activity_log (user_id, activity_type, description, course_id)
       VALUES ($1, 'course_completed', $2, $3)`,
      [studentId, `Completed course: ${check.rows[0].title}`, courseId]
    );

    await client.query("COMMIT");
    return res.status(200).json({ message: "Course completion checkpoint granted!", checkpoint_code: code });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

exports.getMyCourses = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.category, c.level, c.thumbnail_url,
              e.id AS enrollment_id, e.status, e.progress_percent, e.enrolled_at, e.completed_at,
              u.first_name || ' ' || u.last_name AS teacher_name,
              cc.checkpoint_code
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN users u ON c.teacher_id = u.id
       LEFT JOIN course_completions cc ON cc.student_id = e.user_id AND cc.course_id = c.id
       WHERE e.user_id = $1
       ORDER BY e.enrolled_at DESC`,
      [req.user.id]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getTeachingCourses = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.category, c.level, c.thumbnail_url, c.created_at,
              COUNT(DISTINCT e.id)::int AS enrolled_count,
              COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0.0) AS avg_rating
       FROM courses c
       LEFT JOIN enrollments e ON c.id = e.course_id
       LEFT JOIN course_reviews r ON c.id = r.course_id
       WHERE c.teacher_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

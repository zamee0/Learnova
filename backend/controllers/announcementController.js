const pool = require("../config/db");

// Get recent announcements for dashboard
exports.getRecentAnnouncements = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;

    const query = `
      SELECT 
        a.announcement_id,
        a.announcement_id AS id,
        a.title,
        a.content,
        a.created_at,
        c.course_id,
        c.title AS course_title,
        u.first_name || ' ' || u.last_name AS teacher_name
      FROM announcements a
      JOIN courses c ON a.course_id = c.course_id
      JOIN users u ON a.teacher_id = u.user_id
      WHERE a.course_id IN (
        SELECT course_id FROM enrollments WHERE student_id = $1
        UNION
        SELECT course_id FROM courses WHERE teacher_id = $1
      )
      ORDER BY a.created_at DESC
      LIMIT 6
    `;

    const result = await pool.query(query, [userId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Get announcements for a specific course
exports.getAnnouncementsByCourse = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    if (isNaN(courseId)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }

    const query = `
      SELECT 
        a.announcement_id,
        a.announcement_id AS id,
        a.title,
        a.content,
        a.created_at,
        u.first_name || ' ' || u.last_name AS teacher_name
      FROM announcements a
      JOIN users u ON a.teacher_id = u.user_id
      WHERE a.course_id = $1
      ORDER BY a.created_at DESC
    `;

    const result = await pool.query(query, [courseId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Post an announcement (Teacher only)
exports.createAnnouncement = async (req, res, next) => {
  try {
    const teacherId = req.user.user_id || req.user.id;
    const { course_id, title, content } = req.body;
    const courseId = parseInt(course_id, 10);

    if (isNaN(courseId) || !title || !content) {
      return res.status(400).json({ error: "Course ID, title, and content are required." });
    }

    const courseCheck = await pool.query(
      "SELECT course_id, title FROM courses WHERE course_id = $1 AND teacher_id = $2",
      [courseId, teacherId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(403).json({ error: "You can only post announcements for courses you teach." });
    }

    const courseTitle = courseCheck.rows[0].title;

    const result = await pool.query(
      `INSERT INTO announcements (course_id, teacher_id, title, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *, announcement_id AS id`,
      [courseId, teacherId, title.trim(), content.trim()]
    );

    // Notify all enrolled students
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       SELECT student_id, $1, $2, 'announcement'
       FROM enrollments WHERE course_id = $3`,
      [`New Announcement: ${courseTitle}`, title.trim(), courseId]
    );

    return res.status(201).json({
      message: "Announcement posted successfully",
      announcement: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
};
const pool = require("../config/db");

// Get recent announcements for dashboard
exports.getRecentAnnouncements = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        a.id,
        a.title,
        a.content,
        a.created_at,
        c.title AS course_title,
        c.id AS course_id,
        u.first_name || ' ' || u.last_name AS teacher_name
      FROM announcements a
      JOIN courses c ON a.course_id = c.id
      JOIN users u ON a.teacher_id = u.id
      WHERE a.course_id IN (
        SELECT course_id FROM enrollments WHERE user_id = $1
        UNION
        SELECT id FROM courses WHERE teacher_id = $1
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

// Get announcements for a single course
exports.getAnnouncementsByCourse = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);

    if (isNaN(courseId)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }

    const query = `
      SELECT 
        a.id,
        a.title,
        a.content,
        a.created_at,
        u.first_name || ' ' || u.last_name AS teacher_name
      FROM announcements a
      JOIN users u ON a.teacher_id = u.id
      WHERE a.course_id = $1
      ORDER BY a.created_at DESC
    `;

    const result = await pool.query(query, [courseId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Post a course announcement (Teacher only)
exports.createAnnouncement = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const { course_id, title, content } = req.body;
    const courseId = parseInt(course_id, 10);

    if (isNaN(courseId) || !title || !content) {
      return res.status(400).json({ error: "Course ID, title, and content are required." });
    }

    // Verify teacher owns course
    const courseCheck = await pool.query(
      "SELECT id, title FROM courses WHERE id = $1 AND teacher_id = $2",
      [courseId, teacherId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(403).json({ error: "You can only post announcements to courses you teach." });
    }

    const courseTitle = courseCheck.rows[0].title;

    const result = await pool.query(
      `INSERT INTO announcements (course_id, teacher_id, title, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [courseId, teacherId, title.trim(), content.trim()]
    );

    // Notify all enrolled students
    const enrolledStudents = await pool.query(
      "SELECT user_id FROM enrollments WHERE course_id = $1",
      [courseId]
    );

    for (const student of enrolledStudents.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, 'announcement')`,
        [student.user_id, `Announcement in ${courseTitle}`, title.trim()]
      );
    }

    return res.status(201).json({
      message: "Announcement published successfully",
      announcement: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
};
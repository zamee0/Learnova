const pool = require("../config/db");

exports.getRecentAnnouncements = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT 
        a.id, a.title, a.content, a.created_at,
        c.id AS course_id, c.title AS course_title,
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

exports.getAnnouncementsByCourse = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    const query = `
      SELECT a.id, a.title, a.content, a.created_at,
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

exports.createAnnouncement = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const { course_id, title, content } = req.body;
    const courseId = parseInt(course_id, 10);

    const courseCheck = await pool.query("SELECT id, title FROM courses WHERE id = $1 AND teacher_id = $2", [courseId, teacherId]);
    if (courseCheck.rows.length === 0) {
      return res.status(403).json({ error: "You can only post announcements for courses you teach." });
    }

    const courseTitle = courseCheck.rows[0].title;
    const result = await pool.query(
      `INSERT INTO announcements (course_id, teacher_id, title, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [courseId, teacherId, title.trim(), content.trim()]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       SELECT user_id, $1, $2, 'announcement'
       FROM enrollments WHERE course_id = $3`,
      [`New Announcement: ${courseTitle}`, title.trim(), courseId]
    );

    return res.status(201).json({ message: "Announcement posted successfully", announcement: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const pool = require("../config/db");

async function checkCourseAccess(userId, courseId) {
  const check = await pool.query(
    `SELECT 1 FROM courses WHERE id = $1 AND teacher_id = $2
     UNION
     SELECT 1 FROM enrollments WHERE course_id = $1 AND user_id = $2`,
    [courseId, userId]
  );
  return check.rows.length > 0;
}

exports.getAllMyDiscussions = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        d.id, d.course_id, d.title, d.content, d.created_at,
        c.title AS course_title,
        u.first_name || ' ' || u.last_name AS author_name,
        u.role AS author_role,
        COUNT(r.id)::int AS reply_count
      FROM discussions d
      JOIN courses c ON d.course_id = c.id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN discussion_replies r ON d.id = r.discussion_id
      WHERE d.course_id IN (
        SELECT course_id FROM enrollments WHERE user_id = $1
        UNION
        SELECT id FROM courses WHERE teacher_id = $1
      )
      GROUP BY d.id, c.title, u.first_name, u.last_name, u.role
      ORDER BY d.created_at DESC
    `;
    const result = await pool.query(query, [req.user.id]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getDiscussionsByCourse = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    const hasAccess = await checkCourseAccess(req.user.id, courseId);
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({ error: "You must be enrolled in this course to view discussions." });
    }

    const query = `
      SELECT 
        d.id, d.course_id, d.title, d.content, d.created_at,
        u.id AS author_id,
        u.first_name || ' ' || u.last_name AS author_name,
        u.role AS author_role,
        u.avatar_url AS author_avatar,
        COUNT(r.id)::int AS reply_count
      FROM discussions d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN discussion_replies r ON d.id = r.discussion_id
      WHERE d.course_id = $1
      GROUP BY d.id, u.id, u.first_name, u.last_name, u.role, u.avatar_url
      ORDER BY d.created_at DESC
    `;
    const result = await pool.query(query, [courseId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.createDiscussion = async (req, res, next) => {
  try {
    const { course_id, title, content } = req.body;
    const courseId = parseInt(course_id, 10);

    const hasAccess = await checkCourseAccess(req.user.id, courseId);
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. You must be enrolled or teaching this course to post." });
    }

    const insertResult = await pool.query(
      `INSERT INTO discussions (course_id, user_id, title, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [courseId, req.user.id, title.trim(), content.trim()]
    );

    return res.status(201).json({ message: "Discussion created successfully", discussion: insertResult.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.getReplies = async (req, res, next) => {
  try {
    const discussionId = parseInt(req.params.id, 10);
    const disc = (await pool.query("SELECT course_id FROM discussions WHERE id = $1", [discussionId])).rows[0];
    if (!disc) return res.status(404).json({ error: "Discussion thread not found." });

    const hasAccess = await checkCourseAccess(req.user.id, disc.course_id);
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({ error: "You must be enrolled in this course to view replies." });
    }

    const result = await pool.query(
      `SELECT r.id, r.discussion_id, r.content, r.created_at,
              u.id AS author_id, u.first_name || ' ' || u.last_name AS author_name, u.role AS author_role, u.avatar_url AS author_avatar
       FROM discussion_replies r
       JOIN users u ON r.user_id = u.id
       WHERE r.discussion_id = $1
       ORDER BY r.created_at ASC`,
      [discussionId]
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.createReply = async (req, res, next) => {
  try {
    const discussionId = parseInt(req.params.id, 10);
    const { content } = req.body;

    const disc = (await pool.query("SELECT course_id FROM discussions WHERE id = $1", [discussionId])).rows[0];
    if (!disc) return res.status(404).json({ error: "Discussion thread not found." });

    const hasAccess = await checkCourseAccess(req.user.id, disc.course_id);
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({ error: "You must be enrolled in this course to reply." });
    }

    const result = await pool.query(
      `INSERT INTO discussion_replies (discussion_id, user_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [discussionId, req.user.id, content.trim()]
    );

    return res.status(201).json({ message: "Reply posted successfully", reply: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const pool = require("../config/db");

// Helper: Ensure user is course instructor OR an enrolled student
async function checkCourseAccess(userId, courseId) {
  const check = await pool.query(
    `SELECT 1 FROM courses WHERE course_id = $1 AND teacher_id = $2
     UNION
     SELECT 1 FROM enrollments WHERE course_id = $1 AND student_id = $2`,
    [courseId, userId]
  );
  return check.rows.length > 0;
}

// Get all discussions across user's active courses
exports.getAllMyDiscussions = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;

    const query = `
      SELECT 
        d.discussion_id,
        d.discussion_id AS id,
        d.course_id,
        d.title,
        d.content,
        d.created_at,
        c.title AS course_title,
        u.first_name || ' ' || u.last_name AS author_name,
        u.role AS author_role,
        COUNT(r.reply_id)::int AS reply_count
      FROM discussions d
      JOIN courses c ON d.course_id = c.course_id
      JOIN users u ON d.user_id = u.user_id
      LEFT JOIN discussion_replies r ON d.discussion_id = r.discussion_id
      WHERE d.course_id IN (
        SELECT course_id FROM enrollments WHERE student_id = $1
        UNION
        SELECT course_id FROM courses WHERE teacher_id = $1
      )
      GROUP BY d.discussion_id, c.title, u.first_name, u.last_name, u.role
      ORDER BY d.created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Get discussions for a specific course
exports.getDiscussionsByCourse = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const courseId = parseInt(req.params.courseId, 10);

    if (isNaN(courseId)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }

    const hasAccess = await checkCourseAccess(userId, courseId);
    if (!hasAccess) {
      return res.status(403).json({ error: "You must be enrolled in this course to view discussions." });
    }

    const query = `
      SELECT 
        d.discussion_id,
        d.discussion_id AS id,
        d.course_id,
        d.title,
        d.content,
        d.created_at,
        u.user_id AS author_id,
        u.first_name || ' ' || u.last_name AS author_name,
        u.role AS author_role,
        u.avatar_url AS author_avatar,
        COUNT(r.reply_id)::int AS reply_count
      FROM discussions d
      JOIN users u ON d.user_id = u.user_id
      LEFT JOIN discussion_replies r ON d.discussion_id = r.discussion_id
      WHERE d.course_id = $1
      GROUP BY d.discussion_id, u.user_id, u.first_name, u.last_name, u.role, u.avatar_url
      ORDER BY d.created_at DESC
    `;

    const result = await pool.query(query, [courseId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Create a discussion thread
exports.createDiscussion = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const { course_id, title, content } = req.body;
    const courseId = parseInt(course_id, 10);

    if (isNaN(courseId) || !title || !content) {
      return res.status(400).json({ error: "Course ID, title, and content are required." });
    }

    const hasAccess = await checkCourseAccess(userId, courseId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied. You must be enrolled or teaching this course to post." });
    }

    const insertResult = await pool.query(
      `INSERT INTO discussions (course_id, user_id, title, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *, discussion_id AS id`,
      [courseId, userId, title.trim(), content.trim()]
    );

    return res.status(201).json({
      message: "Discussion created successfully",
      discussion: insertResult.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

// Get replies for a discussion
exports.getReplies = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const discussionId = parseInt(req.params.id, 10);

    if (isNaN(discussionId)) {
      return res.status(400).json({ error: "Invalid discussion ID." });
    }

    const discCheck = await pool.query("SELECT course_id FROM discussions WHERE discussion_id = $1", [discussionId]);
    if (discCheck.rows.length === 0) {
      return res.status(404).json({ error: "Discussion thread not found." });
    }

    const courseId = discCheck.rows[0].course_id;
    const hasAccess = await checkCourseAccess(userId, courseId);
    if (!hasAccess) {
      return res.status(403).json({ error: "You must be enrolled in this course to view replies." });
    }

    const query = `
      SELECT 
        r.reply_id,
        r.reply_id AS id,
        r.discussion_id,
        r.content,
        r.created_at,
        u.user_id AS author_id,
        u.first_name || ' ' || u.last_name AS author_name,
        u.role AS author_role,
        u.avatar_url AS author_avatar
      FROM discussion_replies r
      JOIN users u ON r.user_id = u.user_id
      WHERE r.discussion_id = $1
      ORDER BY r.created_at ASC
    `;

    const result = await pool.query(query, [discussionId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Post a reply
exports.createReply = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const discussionId = parseInt(req.params.id, 10);
    const { content } = req.body;

    if (isNaN(discussionId) || !content || !content.trim()) {
      return res.status(400).json({ error: "Discussion ID and reply content are required." });
    }

    const discCheck = await pool.query(
      `SELECT d.course_id, d.user_id AS op_id, d.title 
       FROM discussions d WHERE d.discussion_id = $1`,
      [discussionId]
    );

    if (discCheck.rows.length === 0) {
      return res.status(404).json({ error: "Discussion not found." });
    }

    const { course_id } = discCheck.rows[0];
    const hasAccess = await checkCourseAccess(userId, course_id);
    if (!hasAccess) {
      return res.status(403).json({ error: "You must be enrolled in this course to reply." });
    }

    const insertResult = await pool.query(
      `INSERT INTO discussion_replies (discussion_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *, reply_id AS id`,
      [discussionId, userId, content.trim()]
    );

    return res.status(201).json({
      message: "Reply posted successfully",
      reply: insertResult.rows[0]
    });
  } catch (err) {
    next(err);
  }
};
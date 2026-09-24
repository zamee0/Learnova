const pool = require("../config/db");

exports.getClassroomPosts = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    const access = await pool.query("SELECT teacher_id FROM courses c WHERE id=$1 AND (teacher_id=$2 OR EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id=c.id AND e.user_id=$2 AND e.status IN ('active','completed')))", [courseId, req.user.id]);
    if (!access.rowCount) return res.status(403).json({ error: "Enroll in this course to access class notes." });
    const result = await pool.query(
      `SELECT p.id, p.title, p.content, p.attachment_data, p.attachment_name, p.attachment_type, p.created_at, p.updated_at,
              u.first_name || ' ' || u.last_name AS teacher_name, u.avatar_url AS teacher_avatar
       FROM classroom_posts p
       JOIN users u ON p.teacher_id = u.id
       WHERE p.course_id = $1
       ORDER BY p.created_at DESC`,
      [courseId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.createClassroomPost = async (req, res, next) => {
  try {
    const { course_id, title, content, file } = req.body;
    const courseId = parseInt(course_id, 10);

    const owner = await pool.query("SELECT teacher_id, title FROM courses WHERE id = $1", [courseId]);
    if (owner.rows.length === 0) return res.status(404).json({ error: "Course not found." });
    if (owner.rows[0].teacher_id !== req.user.id) return res.status(403).json({ error: "Only the instructor can post notes." });
    if (typeof title !== 'string' || !title.trim() || typeof content !== 'string' || !content.trim() || (file && !validUpload(file))) return res.status(400).json({ error: "Provide a note title, content, and supported file under 5 MB." });

    const result = await pool.query(
      `INSERT INTO classroom_posts (course_id, teacher_id, title, content, attachment_data, attachment_name, attachment_type) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [courseId, req.user.id, title.trim(), content.trim(), file?.data || null, file?.name || null, file?.type || null]
    );

    return res.status(201).json({ message: "Classroom note published", post: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

function validUpload(file) {
  const allowed = ['application/pdf','text/plain','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip','application/x-zip-compressed'];
  return file && typeof file.name === 'string' && file.name.length <= 255 && allowed.includes(file.type) && typeof file.data === 'string' && file.data.startsWith(`data:${file.type};base64,`) && Buffer.byteLength(file.data.split(',')[1] || '', 'base64') <= 5 * 1024 * 1024;
}

exports.getCourseVideos = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    const result = await pool.query(
      `SELECT v.id, v.title, v.description, v.video_url, v.platform, v.created_at,
              u.first_name || ' ' || u.last_name AS teacher_name
       FROM course_videos v
       JOIN users u ON v.teacher_id = u.id
       WHERE v.course_id = $1
       ORDER BY v.created_at DESC`,
      [courseId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.createCourseVideo = async (req, res, next) => {
  try {
    const { course_id, title, description, video_url } = req.body;
    const courseId = parseInt(course_id, 10);

    const owner = await pool.query("SELECT teacher_id FROM courses WHERE id = $1", [courseId]);
    if (owner.rows.length === 0 || owner.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    const result = await pool.query(
      `INSERT INTO course_videos (course_id, teacher_id, title, description, video_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [courseId, req.user.id, title.trim(), description || null, video_url.trim()]
    );

    return res.status(201).json({ message: "Video resource published", video: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.getLiveClasses = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    const result = await pool.query(
      `SELECT l.id, l.title, l.platform, l.meeting_url, l.description, l.starts_at, l.ends_at,
              u.first_name || ' ' || u.last_name AS teacher_name
       FROM live_classes l
       JOIN users u ON l.teacher_id = u.id
       WHERE l.course_id = $1
       ORDER BY l.starts_at ASC`,
      [courseId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.createLiveClass = async (req, res, next) => {
  try {
    const { course_id, title, platform, meeting_url, description, starts_at, ends_at } = req.body;
    const courseId = parseInt(course_id, 10);

    const owner = await pool.query("SELECT teacher_id, title FROM courses WHERE id = $1", [courseId]);
    if (owner.rows.length === 0 || owner.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    const result = await pool.query(
      `INSERT INTO live_classes (course_id, teacher_id, title, platform, meeting_url, description, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [courseId, req.user.id, title.trim(), platform || 'google_meet', meeting_url.trim(), description || null, starts_at, ends_at || null]
    );

    return res.status(201).json({ message: "Live meeting scheduled", liveClass: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const pool = require("../config/db");
const { validImageDataUrl } = require("../utils/imageValidation");

exports.heartbeat = async (req, res, next) => {
  try {
    await pool.query("UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1", [req.user.id]);
    return res.sendStatus(204);
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const userQuery = `
      SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.bio, u.phone, u.address, u.avatar_url, u.last_active_at, u.created_at,
             sp.institution, sp.semester, sp.student_code,
             tp.designation, tp.qualification, tp.experience_years, COALESCE(tp.qualifications, '[]'::jsonb) AS qualifications
      FROM users u
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN teacher_profiles tp ON u.id = tp.user_id
      WHERE u.id = $1
    `;
    const userResult = await pool.query(userQuery, [req.user.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found." });

    const completions = await pool.query(
      `SELECT cc.completed_at, cc.checkpoint_code, c.title AS course_title, c.category 
       FROM course_completions cc
       JOIN courses c ON cc.course_id = c.id
       WHERE cc.student_id = $1`,
      [req.user.id]
    );

    const user = userResult.rows[0];
    user.checkpoints = completions.rows;
    return res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { first_name, last_name, bio, phone, address, avatar_url, institution, semester, designation, qualification, qualifications } = req.body;
    if (bio != null && (typeof bio !== 'string' || bio.length > 2000)) return res.status(400).json({ error: "Bio must be under 2000 characters." });
    let validAvatar = false;
    if (typeof avatar_url === 'string' && avatar_url.length <= 6000000) {
      if (avatar_url.startsWith('data:')) validAvatar = validImageDataUrl(avatar_url);
      else try { validAvatar = ['http:', 'https:'].includes(new URL(avatar_url).protocol); } catch { /* Invalid image URL. */ }
    }
    if (avatar_url != null && !validAvatar) return res.status(400).json({ error: "Profile picture must be a valid JPEG, PNG, WebP image, or HTTP image URL." });
    if (qualifications != null && (!Array.isArray(qualifications) || qualifications.length > 20 || (req.user.role === 'teacher' && !qualifications.length) || qualifications.some(q => !q || typeof q !== 'object' || ['degree', 'institute', 'experience', 'certifications'].some(key => typeof q[key] !== 'string' || q[key].length > 250) || ['degree', 'institute', 'experience'].some(key => !q[key].trim())))) return res.status(400).json({ error: "Add up to 20 qualifications; each needs a degree, institute, and experience." });
    await client.query("BEGIN");

    const userUpdate = await client.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           bio = COALESCE($3, bio),
           phone = COALESCE($4, phone),
           address = COALESCE($5, address),
           avatar_url = COALESCE($6, avatar_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING id, first_name, last_name, email, role, bio, phone, address, avatar_url`,
      [first_name, last_name, bio, phone, address, avatar_url, req.user.id]
    );

    if (req.user.role === "student") {
      await client.query(
        `UPDATE student_profiles SET institution = COALESCE($1, institution), semester = COALESCE($2, semester) WHERE user_id = $3`,
        [institution, semester, req.user.id]
      );
    } else if (req.user.role === "teacher") {
      await client.query(
        `UPDATE teacher_profiles SET designation = COALESCE($1, designation), qualification = COALESCE($2, qualification), qualifications = COALESCE($3::jsonb, qualifications) WHERE user_id = $4`,
        [designation, qualification, qualifications == null ? null : JSON.stringify(qualifications), req.user.id]
      );
    }

    await client.query(
      `INSERT INTO activity_log (user_id, activity_type, description) VALUES ($1, 'profile_updated', 'Updated personal profile details.')`,
      [req.user.id]
    );

    await client.query("COMMIT");
    return res.status(200).json({ message: "Profile updated successfully", user: userUpdate.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

exports.searchUser = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) return res.status(200).json([]);

    const users = await pool.query(
      `SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.email, u.role, u.avatar_url, u.bio,
              (CURRENT_TIMESTAMP - u.last_active_at < INTERVAL '5 minutes') AS is_online,
              u.last_active_at,
              COALESCE(json_agg(DISTINCT jsonb_build_object('id', c.id, 'title', c.title, 'category', c.category)) FILTER (WHERE c.id IS NOT NULL), '[]') AS enrolled_courses
       FROM users u
       LEFT JOIN enrollments e ON u.id = e.user_id AND e.status = 'active'
       LEFT JOIN courses c ON e.course_id = c.id
      WHERE u.id <> $2 AND (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR (u.first_name || ' ' || u.last_name) ILIKE $1 OR u.email ILIKE $1 OR u.role ILIKE $1)
       GROUP BY u.id
       LIMIT 10`,
      [`%${q.trim()}%`, req.user.id]
    );

    return res.status(200).json(users.rows);
  } catch (err) {
    next(err);
  }
};

exports.getPublicProfile = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid user ID." });
    const result = await pool.query(`SELECT u.id, u.first_name, u.last_name, u.role, u.bio, u.avatar_url,
      COALESCE((SELECT json_agg(json_build_object('id', f.id, 'name', f.first_name || ' ' || f.last_name))
        FROM users f WHERE f.id NOT IN ($1, $2)
        AND EXISTS (SELECT 1 FROM friendships a WHERE a.status = 'accepted' AND ((a.user_id = $1 AND a.friend_id = f.id) OR (a.friend_id = $1 AND a.user_id = f.id)))
        AND EXISTS (SELECT 1 FROM friendships b WHERE b.status = 'accepted' AND ((b.user_id = $2 AND b.friend_id = f.id) OR (b.friend_id = $2 AND b.user_id = f.id)))), '[]') AS mutual_connections
      FROM users u WHERE u.id = $1`, [id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: "User not found." });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.getUserActivity = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const logs = await pool.query(
      `SELECT a.id, a.activity_type, a.description, a.created_at, c.title AS course_title
       FROM activity_log a
       LEFT JOIN courses c ON a.course_id = c.id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC
       LIMIT 15`,
      [targetUserId]
    );
    return res.status(200).json(logs.rows);
  } catch (err) {
    next(err);
  }
};

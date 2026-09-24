const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "learnova_jwt_secret_2026";

exports.signup = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { first_name, last_name, email, password, role, bio, phone, address, avatar_url, institution, semester, designation, qualification, qualifications } = req.body;

    if (![first_name, last_name, email, password].every(v => typeof v === 'string' && v.trim())) {
      return res.status(400).json({ error: "First name, last name, email, and password are required." });
    }

    const assignedRole = ['student', 'teacher'].includes(role) ? role : 'student';
    const teacherQualifications = Array.isArray(qualifications) ? qualifications : qualification ? [{ degree: qualification, institute: '', experience: '', certifications: '' }] : [];
    if (assignedRole === 'teacher' && (typeof bio !== 'string' || !bio.trim() || !teacherQualifications.length || teacherQualifications.some(q => !q || ['degree', 'institute', 'experience', 'certifications'].some(key => typeof q[key] !== 'string' || !q[key].trim())))) {
      return res.status(400).json({ error: "Teachers must provide a bio and degree, institute, experience, and certifications." });
    }
    const cleanEmail = email.toLowerCase().trim();

    const existing = await client.query("SELECT id FROM users WHERE email = $1", [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, bio, phone, address, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, first_name, last_name, email, role, bio, avatar_url, created_at`,
      [first_name.trim(), last_name.trim(), cleanEmail, password_hash, assignedRole, bio || null, phone || null, address || null, avatar_url || null]
    );

    const user = userResult.rows[0];

    if (assignedRole === "student") {
      await client.query(
        `INSERT INTO student_profiles (user_id, institution, semester) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET institution = EXCLUDED.institution, semester = EXCLUDED.semester`,
        [user.id, institution || null, semester || null]
      );
    } else if (assignedRole === "teacher") {
      await client.query(
        `INSERT INTO teacher_profiles (user_id, designation, qualification, qualifications) VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (user_id) DO UPDATE SET designation = EXCLUDED.designation, qualification = EXCLUDED.qualification, qualifications = EXCLUDED.qualifications`,
        [user.id, designation || 'Instructor', teacherQualifications[0]?.degree || null, JSON.stringify(teacherQualifications)]
      );
    }

    await client.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Welcome to Learnova!', 'Your account has been successfully created.', 'general')`,
      [user.id]
    );

    await client.query(
      `INSERT INTO activity_log (user_id, activity_type, description)
       VALUES ($1, 'account_created', 'Signed up for a Learnova account.')`,
      [user.id]
    );

    await client.query("COMMIT");

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    return res.status(201).json({ message: "Registration successful", token, user });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: "This account has been deactivated. Please contact support." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    await pool.query("UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    delete user.password_hash;

    return res.status(200).json({ message: "Login successful", token, user });
  } catch (err) {
    next(err);
  }
};

const pool = require("../config/db");

exports.enroll = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const courseId = parseInt(req.body.course_id, 10);

    if (isNaN(courseId)) {
      return res.status(400).json({ error: "Valid course_id is required." });
    }

    if (req.user.role !== "student") {
      return res.status(403).json({ error: "Only student accounts can enroll in courses." });
    }

    // Check if student is banned from this course
    const banCheck = await pool.query(
      "SELECT 1 FROM course_bans WHERE user_id = $1 AND course_id = $2",
      [studentId, courseId]
    );
    if (banCheck.rows.length > 0) {
      return res.status(403).json({ error: "You are banned from enrolling in this course by the instructor." });
    }

    // Check course existence
    const courseCheck = await pool.query(
      `SELECT c.id, c.title, c.teacher_id, u.first_name || ' ' || u.last_name AS student_name
       FROM courses c
       CROSS JOIN users u
       WHERE c.id = $1 AND u.id = $2`,
      [courseId, studentId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: "Course not found." });
    }

    const { title, teacher_id, student_name } = courseCheck.rows[0];

    // Check existing enrollment
    const existing = await pool.query(
      "SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2",
      [studentId, courseId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "You are already enrolled in this course." });
    }

    const result = await pool.withTransaction(async client => {
      const enrollment = await client.query(
        `INSERT INTO enrollments (user_id, course_id, status, progress_percent) VALUES ($1, $2, 'active', 0) RETURNING *`,
        [studentId, courseId]
      );
      await client.query(`INSERT INTO notifications (user_id, title, message, type) VALUES ($1, 'Course Enrolled Successfully', $2, 'enrollment')`, [studentId, `You have successfully joined "${title}". Start learning now!`]);
      await client.query(`INSERT INTO notifications (user_id, title, message, type) VALUES ($1, 'New Student Enrolled', $2, 'enrollment')`, [teacher_id, `${student_name} just enrolled in "${title}".`]);
      await client.query(`INSERT INTO activity_log (user_id, activity_type, description, course_id) VALUES ($1, 'course_enrollment', $2, $3)`, [studentId, `Enrolled in course: ${title}`, courseId]);
      return enrollment;
    });

    return res.status(201).json({ 
      message: "Successfully enrolled in course!", 
      enrollment: result.rows[0] 
    });
  } catch (err) {
    next(err);
  }
};

exports.unenroll = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const targetId = parseInt(req.params.id, 10);

    const result = await pool.query(
      `DELETE FROM enrollments 
       WHERE user_id = $1 AND (id = $2 OR course_id = $2) 
       RETURNING id`,
      [studentId, targetId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Active enrollment record not found." });
    }

    return res.status(200).json({ message: "Successfully unenrolled from course." });
  } catch (err) {
    next(err);
  }
};

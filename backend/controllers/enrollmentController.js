const pool = require("../config/db");

// Enroll a student in a course
exports.enroll = async (req, res, next) => {
  try {
    const studentId = req.user.user_id || req.user.id;
    const courseId = parseInt(req.body.course_id, 10);

    if (isNaN(courseId)) {
      return res.status(400).json({ error: "Valid course_id is required." });
    }

    // Verify course exists
    const courseCheck = await pool.query(
      `SELECT c.course_id, c.title, c.teacher_id, u.first_name || ' ' || u.last_name AS student_name
       FROM courses c
       CROSS JOIN users u
       WHERE c.course_id = $1 AND u.user_id = $2`,
      [courseId, studentId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: "Course not found." });
    }

    const { title, teacher_id, student_name } = courseCheck.rows[0];

    // Prevent duplicate enrollment
    const existing = await pool.query(
      "SELECT enrollment_id FROM enrollments WHERE student_id = $1 AND course_id = $2",
      [studentId, courseId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "You are already enrolled in this course." });
    }

    const result = await pool.query(
      `INSERT INTO enrollments (student_id, course_id)
       VALUES ($1, $2)
       RETURNING *, enrollment_id AS id`,
      [studentId, courseId]
    );

    // Notify student
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Course Enrolled Successfully', $2, 'enrollment')`,
      [studentId, `You are now enrolled in "${title}".`]
    );

    // Notify teacher
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'New Student Enrolled', $2, 'enrollment')`,
      [teacher_id, `${student_name} enrolled in "${title}".`]
    );

    return res.status(201).json({
      message: "Successfully enrolled in course",
      enrollment: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

// Unenroll a student from a course
exports.unenroll = async (req, res, next) => {
  try {
    const studentId = req.user.user_id || req.user.id;
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      return res.status(400).json({ error: "Invalid ID provided." });
    }

    const result = await pool.query(
      `DELETE FROM enrollments 
       WHERE student_id = $1 AND (enrollment_id = $2 OR course_id = $2)
       RETURNING enrollment_id`,
      [studentId, targetId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Enrollment record not found." });
    }

    return res.status(200).json({ message: "Successfully unenrolled from course." });
  } catch (err) {
    next(err);
  }
};
const pool = require("../config/db");

// Enroll a student in a course
exports.enroll = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const courseId = parseInt(req.body.course_id, 10);

    if (isNaN(courseId)) {
      return res.status(400).json({ error: "Valid course_id is required." });
    }

    // Verify course exists
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

    const courseInfo = courseCheck.rows[0];

    // Prevent duplicate enrollment
    const existing = await pool.query(
      "SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2",
      [studentId, courseId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "You are already enrolled in this course." });
    }

    // Insert enrollment
    const result = await pool.query(
      `INSERT INTO enrollments (user_id, course_id)
       VALUES ($1, $2)
       RETURNING *`,
      [studentId, courseId]
    );

    // Notify student
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, 'enrollment')`,
      [studentId, 'Enrolled Successfully', `You have successfully enrolled in "${courseInfo.title}".`]
    );

    // Notify instructor
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, 'enrollment')`,
      [courseInfo.teacher_id, 'New Student Enrollment', `${courseInfo.student_name} enrolled in your course "${courseInfo.title}".`]
    );

    return res.status(201).json({
      message: "Successfully enrolled in the course",
      enrollment: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

// Unenroll student from a course
exports.unenroll = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const enrollmentIdOrCourseId = parseInt(req.params.id, 10);

    if (isNaN(enrollmentIdOrCourseId)) {
      return res.status(400).json({ error: "Invalid ID supplied." });
    }

    const deleteResult = await pool.query(
      `DELETE FROM enrollments 
       WHERE user_id = $1 AND (id = $2 OR course_id = $2)
       RETURNING id, course_id`,
      [studentId, enrollmentIdOrCourseId]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Active enrollment record not found." });
    }

    return res.status(200).json({
      message: "Successfully unenrolled from the course."
    });
  } catch (err) {
    next(err);
  }
};
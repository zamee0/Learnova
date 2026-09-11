const pool = require("../config/db");

// Assignments
exports.getAssignments = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    const result = await pool.query(
      `SELECT a.id, a.title, a.description, a.instructions, a.total_marks, a.deadline, a.allow_late,
              s.id AS submission_id, s.submission_url, s.answer_text, s.marks AS student_marks, s.status AS submission_status, s.submitted_at
       FROM assignments a
       LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.student_id = $2
       WHERE a.course_id = $1
       ORDER BY a.deadline ASC`,
      [courseId, req.user.id]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.createAssignment = async (req, res, next) => {
  try {
    const { course_id, title, description, instructions, total_marks, deadline } = req.body;
    const courseId = parseInt(course_id, 10);

    const owner = await pool.query("SELECT teacher_id FROM courses WHERE id = $1", [courseId]);
    if (owner.rows.length === 0 || owner.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    const result = await pool.query(
      `INSERT INTO assignments (course_id, teacher_id, title, description, instructions, total_marks, deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [courseId, req.user.id, title.trim(), description || null, instructions || null, total_marks || 100, deadline]
    );

    return res.status(201).json({ message: "Assignment published", assignment: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.submitAssignment = async (req, res, next) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const { submission_url, answer_text } = req.body;

    const a = (await pool.query("SELECT deadline FROM assignments WHERE id = $1", [assignmentId])).rows[0];
    if (!a) return res.status(404).json({ error: "Assignment not found." });

    const isLate = new Date() > new Date(a.deadline);
    const status = isLate ? 'late' : 'submitted';

    const result = await pool.query(
      `INSERT INTO assignment_submissions (assignment_id, student_id, submission_url, answer_text, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (assignment_id, student_id) DO UPDATE SET submission_url = EXCLUDED.submission_url, answer_text = EXCLUDED.answer_text, status = $5, submitted_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [assignmentId, req.user.id, submission_url || null, answer_text || null, status]
    );

    return res.status(200).json({ message: "Assignment submitted successfully", submission: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// Exams
exports.getExams = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    const result = await pool.query(
      `SELECT e.id, e.title, e.description, e.instructions, e.starts_at, e.ends_at, e.duration_minutes, e.total_marks,
              ea.id AS attempt_id, ea.started_at, ea.submitted_at, ea.marks AS student_marks, ea.status AS attempt_status
       FROM exams e
       LEFT JOIN exam_attempts ea ON e.id = ea.exam_id AND ea.student_id = $2
       WHERE e.course_id = $1 AND e.is_published = TRUE
       ORDER BY e.starts_at ASC`,
      [courseId, req.user.id]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.createExam = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { course_id, title, description, instructions, starts_at, ends_at, duration_minutes, total_marks, questions } = req.body;
    const courseId = parseInt(course_id, 10);

    const owner = await client.query("SELECT teacher_id FROM courses WHERE id = $1", [courseId]);
    if (owner.rows.length === 0 || owner.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    await client.query("BEGIN");
    const examRes = await client.query(
      `INSERT INTO exams (course_id, teacher_id, title, description, instructions, starts_at, ends_at, duration_minutes, total_marks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [courseId, req.user.id, title.trim(), description || null, instructions || null, starts_at, ends_at, duration_minutes, total_marks || 100]
    );
    const examId = examRes.rows[0].id;

    if (Array.isArray(questions)) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qRes = await client.query(
          `INSERT INTO exam_questions (exam_id, question_text, question_type, marks, position)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [examId, q.question_text, q.question_type || 'mcq', q.marks || 5, i + 1]
        );
        const qId = qRes.rows[0].id;

        if (Array.isArray(q.options)) {
          for (let j = 0; j < q.options.length; j++) {
            const opt = q.options[j];
            await client.query(
              `INSERT INTO exam_options (question_id, option_text, position, is_correct)
               VALUES ($1, $2, $3, $4)`,
              [qId, opt.text, j + 1, !!opt.is_correct]
            );
          }
        }
      }
    }

    await client.query("COMMIT");
    return res.status(201).json({ message: "Exam created successfully", exam: examRes.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

exports.startExam = async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id, 10);
    const studentId = req.user.id;

    const exam = (await pool.query("SELECT * FROM exams WHERE id = $1", [examId])).rows[0];
    if (!exam) return res.status(404).json({ error: "Exam not found." });

    if (new Date() < new Date(exam.starts_at)) return res.status(400).json({ error: "Exam has not started yet." });
    if (new Date() > new Date(exam.ends_at)) return res.status(400).json({ error: "Exam window has closed." });

    await pool.query(
      `INSERT INTO exam_attempts (exam_id, student_id, attempt_number, started_at, status)
       VALUES ($1, $2, 1, CURRENT_TIMESTAMP, 'in_progress')
       ON CONFLICT (exam_id, student_id, attempt_number) DO NOTHING`,
      [examId, studentId]
    );

    const questions = await pool.query(
      `SELECT q.id, q.question_text, q.marks, q.position,
              COALESCE(json_agg(
                json_build_object('id', o.id, 'text', o.option_text, 'position', o.position)
                ORDER BY o.position
              ) FILTER (WHERE o.id IS NOT NULL), '[]') AS options
       FROM exam_questions q
       LEFT JOIN exam_options o ON q.id = o.question_id
       WHERE q.exam_id = $1
       GROUP BY q.id
       ORDER BY q.position ASC`,
      [examId]
    );

    return res.status(200).json({ exam, questions: questions.rows });
  } catch (err) {
    next(err);
  }
};

exports.submitExam = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const examId = parseInt(req.params.id, 10);
    const studentId = req.user.id;
    const { answers } = req.body;

    const attempt = (await client.query(
      "SELECT id, started_at FROM exam_attempts WHERE exam_id = $1 AND student_id = $2",
      [examId, studentId]
    )).rows[0];

    if (!attempt) return res.status(400).json({ error: "No active exam session found." });

    const correctOptions = (await client.query(
      `SELECT o.id AS option_id, q.id AS question_id, q.marks
       FROM exam_options o
       JOIN exam_questions q ON o.question_id = q.id
       WHERE q.exam_id = $1 AND o.is_correct = TRUE`,
      [examId]
    )).rows;

    let totalEarnedMarks = 0;
    await client.query("BEGIN");

    if (answers && typeof answers === "object") {
      for (const [qId, optId] of Object.entries(answers)) {
        const correct = correctOptions.find(c => c.question_id === parseInt(qId, 10) && c.option_id === parseInt(optId, 10));
        const marksAwarded = correct ? parseFloat(correct.marks) : 0;
        totalEarnedMarks += marksAwarded;

        await client.query(
          `INSERT INTO exam_answers (attempt_id, question_id, selected_option_id, marks_awarded)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected_option_id = $3, marks_awarded = $4`,
          [attempt.id, parseInt(qId, 10), parseInt(optId, 10), marksAwarded]
        );
      }
    }

    await client.query(
      `UPDATE exam_attempts SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, marks = $1 WHERE id = $2`,
      [totalEarnedMarks, attempt.id]
    );

    await client.query("COMMIT");
    return res.status(200).json({ message: "Exam submitted successfully!", marks: totalEarnedMarks });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};
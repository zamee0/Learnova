const pool = require("../config/db");

// Assignments
exports.getAssignments = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    const access = await pool.query(`SELECT teacher_id FROM courses c WHERE id=$1 AND (teacher_id=$2 OR EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id=c.id AND e.user_id=$2 AND e.status IN ('active','completed')))`, [courseId, req.user.id]);
    if (!access.rowCount) return res.status(403).json({ error: "Enroll in this course to access its assignments." });
    const result = await pool.query(
      `SELECT a.id, a.title, a.description, a.instructions, a.total_marks, a.deadline, a.allow_late, a.attachments,
              s.id AS submission_id, s.submission_url, s.answer_text, s.file_name, s.file_data, s.file_type, s.marks AS student_marks, s.feedback AS teacher_feedback, s.status AS submission_status, s.submitted_at
       FROM assignments a
       LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.student_id = $2 AND $3='student'
       WHERE a.course_id = $1
       ORDER BY a.deadline ASC`,
      [courseId, req.user.id, req.user.role]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.createAssignment = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { course_id, assignments } = req.body;
    const batch = Array.isArray(assignments) ? assignments : [req.body];
    const courseId = Number(course_id);
    if (!Number.isInteger(courseId) || !batch.length || batch.length > 20 || batch.some(a => !a || typeof a.title !== 'string' || !a.title.trim() || a.title.length>200 || (a.description!=null && (typeof a.description!=='string' || a.description.length>10000)) || !Number.isFinite(Number(a.total_marks ?? 100)) || Number(a.total_marks ?? 100) <= 0 || !a.deadline || !Number.isFinite(Date.parse(a.deadline)) || !Array.isArray(a.attachments || []))) return res.status(400).json({ error: "Add up to 20 assignments with a title, optional instructions, positive marks, deadline, and valid attachments." });
    if (batch.some(a => (a.attachments || []).some(f => !validFile(f)))) return res.status(400).json({ error: "Assignment files must be supported files under 5 MB each." });
    if (batch.reduce((sum,a)=>sum+(a.attachments||[]).reduce((n,f)=>n+Buffer.byteLength(f.data.split(',')[1]||'','base64'),0),0) > 15*1024*1024) return res.status(400).json({ error: "Keep combined assignment files under 15 MB per publish." });
    const owner = await client.query("SELECT teacher_id FROM courses WHERE id = $1", [courseId]);
    if (!owner.rowCount) return res.status(404).json({ error: "Course not found." });
    if (owner.rows[0].teacher_id !== req.user.id) return res.status(403).json({ error: "Only the course teacher can publish assignments." });
    await client.query('BEGIN');
    const call = await client.query(
      "CALL publish_course_assignments($1, $2, $3::jsonb, '[]'::jsonb)",
      [courseId, req.user.id, JSON.stringify(batch.map(a => ({ ...a, title: a.title.trim(), total_marks: Number(a.total_marks ?? 100), attachments: a.attachments || [] })))]
    );
    const published = call.rows[0]?.p_created || [];
    await client.query('COMMIT');
      return res.status(201).json({ message: `${published.length} assignment(s) published`, assignments: published });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
};

exports.submitAssignment = async (req, res, next) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const { submission_url, answer_text, file } = req.body;
    if (!Number.isInteger(assignmentId) || assignmentId <= 0 || (file && !validFile(file, 8)) || (submission_url != null && !validLink(submission_url)) || (answer_text != null && (typeof answer_text !== 'string' || answer_text.length>10000))) return res.status(400).json({ error: "Invalid assignment submission." });

    const a = (await pool.query("SELECT a.deadline,a.allow_late,c.id AS course_id FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.id = $1", [assignmentId])).rows[0];
    if (!a) return res.status(404).json({ error: "Assignment not found." });
    const enrolled = await pool.query("SELECT 1 FROM enrollments WHERE course_id=$1 AND user_id=$2 AND status IN ('active','completed')", [a.course_id, req.user.id]);
    if (!enrolled.rowCount || req.user.role !== 'student') return res.status(403).json({ error: "Only enrolled students can submit this assignment." });

    const isLate = new Date() > new Date(a.deadline);
    if (isLate && !a.allow_late) return res.status(400).json({ error: "The assignment deadline has passed." });
    const status = isLate ? 'late' : 'submitted';

    const result = await pool.query(
      `INSERT INTO assignment_submissions (assignment_id, student_id, submission_url, answer_text, file_data, file_name, file_type, status, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)
       ON CONFLICT (assignment_id, student_id) DO UPDATE SET submission_url = EXCLUDED.submission_url, answer_text = EXCLUDED.answer_text, file_data=EXCLUDED.file_data, file_name=EXCLUDED.file_name, file_type=EXCLUDED.file_type, marks=NULL,feedback=NULL,status = $8, submitted_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [assignmentId, req.user.id, submission_url || null, answer_text || null, file?.data || null, file?.name || null, file?.type || null, status]
    );

    return res.status(200).json({ message: "Assignment submitted successfully", submission: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

function validFile(file, maxMb = 5) {
  return file && typeof file.name === 'string' && file.name.length <= 255 && ['application/pdf','text/plain','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip','application/x-zip-compressed'].includes(file.type) && typeof file.data === 'string' && file.data.startsWith(`data:${file.type};base64,`) && Buffer.byteLength(file.data.slice(file.data.indexOf(',') + 1), 'base64') <= maxMb * 1024 * 1024;
}
function validLink(value) { if (typeof value!=='string' || value.length>2048) return false; try { return ['http:','https:'].includes(new URL(value).protocol); } catch { return false; } }

exports.getAssignmentSubmissions = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id<=0) return res.status(400).json({ error: "Invalid assignment ID." });
    const owner = await pool.query("SELECT c.teacher_id FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.id=$1", [id]);
    if (!owner.rowCount) return res.status(404).json({ error: "Assignment not found." });
    if (owner.rows[0].teacher_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: "Only the course teacher can view submissions." });
    const result = await pool.query(`SELECT s.student_id, u.first_name || ' ' || u.last_name AS student_name, u.email, u.avatar_url,
      s.submission_url, s.answer_text, s.file_data, s.file_name, s.file_type, s.marks, s.feedback, s.status, s.submitted_at
      FROM assignment_submissions s JOIN users u ON u.id=s.student_id WHERE s.assignment_id=$1 ORDER BY s.submitted_at`, [id]);
    res.json(result.rows);
  } catch (err) { next(err); }
};

exports.gradeAssignment = async (req, res, next) => {
  try {
    const assignmentId=Number(req.params.id), studentId=Number(req.params.studentId), { marks, feedback }=req.body;
    if (!Number.isInteger(assignmentId) || assignmentId<=0 || !Number.isInteger(studentId) || studentId<=0 || marks==null || !Number.isFinite(Number(marks)) || (typeof feedback !== 'string' && feedback != null) || (feedback && feedback.length>3000)) return res.status(400).json({ error: "Provide valid marks and feedback." });
    const row = await pool.query(`UPDATE assignment_submissions s SET marks=$1,feedback=$2,status='graded'
      FROM assignments a JOIN courses c ON c.id=a.course_id
      WHERE s.assignment_id=a.id AND a.id=$3 AND s.student_id=$4 AND c.teacher_id=$5 AND $1 BETWEEN 0 AND a.total_marks
      RETURNING s.assignment_id,s.student_id,s.marks,s.feedback,s.status`, [Number(marks), feedback || null, assignmentId, studentId, req.user.id]);
    if (!row.rowCount) return res.status(404).json({ error: "Submission not found, or marks exceed the assignment total." });
    res.json({ submission: row.rows[0] });
  } catch (err) { next(err); }
};

// Exams
exports.getExams = async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    const access = await pool.query("SELECT teacher_id FROM courses c WHERE id=$1 AND (teacher_id=$2 OR EXISTS (SELECT 1 FROM enrollments en WHERE en.course_id=c.id AND en.user_id=$2 AND en.status IN ('active','completed')))", [courseId, req.user.id]);
    if (!access.rowCount) return res.status(403).json({ error: "Enroll in this course to access exams." });
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
    const start = Date.parse(starts_at), end = Date.parse(ends_at), now = Date.now();
    if (!Number.isInteger(courseId) || typeof title !== 'string' || !title.trim() || title.length>200 || !Array.isArray(questions) || !questions.length || questions.length > 100 || !Number.isInteger(Number(duration_minutes)) || Number(duration_minutes) < 1 || !Number.isFinite(start) || !Number.isFinite(end) || start <= now || end <= start || Number(duration_minutes) > (end-start)/60000 || questions.some(q => typeof q.question_text !== 'string' || !q.question_text.trim() || (q.question_type && q.question_type!=='mcq') || !Number.isFinite(Number(q.marks)) || Number(q.marks) <= 0 || Number(q.marks)>999999 || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 10 || q.options.some(o => typeof o.text !== 'string' || !o.text.trim()) || q.options.filter(o => o.is_correct).length !== 1)) return res.status(400).json({ error: "Add at least one valid multiple-choice question and a future exam window long enough for its duration." });
    const examTotalMarks=questions.reduce((sum,q)=>sum+Number(q.marks),0);

    const owner = await client.query("SELECT teacher_id FROM courses WHERE id = $1", [courseId]);
    if (owner.rows.length === 0 || owner.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    await client.query("BEGIN");
    const examRes = await client.query(
      `INSERT INTO exams (course_id, teacher_id, title, description, instructions, starts_at, ends_at, duration_minutes, total_marks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [courseId, req.user.id, title.trim(), description || null, instructions || null, starts_at, ends_at, duration_minutes, examTotalMarks]
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

    if (!Number.isInteger(examId) || examId<=0) return res.status(400).json({ error: "Invalid exam ID." });
    const exam = (await pool.query("SELECT * FROM exams WHERE id = $1 AND is_published=TRUE", [examId])).rows[0];
    if (!exam) return res.status(404).json({ error: "Exam not found." });
    if (req.user.role !== 'student') return res.status(403).json({ error: "Only enrolled students can take exams." });
    const enrolled = await pool.query("SELECT 1 FROM enrollments WHERE course_id=$1 AND user_id=$2 AND status IN ('active','completed')", [exam.course_id, studentId]);
    if (!enrolled.rowCount) return res.status(403).json({ error: "Enroll in this course before taking its exam." });

    if (new Date() < new Date(exam.starts_at)) return res.status(400).json({ error: "Exam has not started yet." });
    if (new Date() > new Date(exam.ends_at)) return res.status(400).json({ error: "Exam window has closed." });

    const attemptResult = await pool.query(`INSERT INTO exam_attempts (exam_id, student_id, attempt_number, started_at, status)
      VALUES ($1,$2,1,CURRENT_TIMESTAMP,'in_progress') ON CONFLICT (exam_id,student_id,attempt_number) DO UPDATE SET exam_id=EXCLUDED.exam_id RETURNING id,started_at,status`, [examId, studentId]);
    const attempt = attemptResult.rows[0];
    if (attempt.status !== 'in_progress') return res.status(409).json({ error: "This exam has already been submitted." });
    const expiryResult = await pool.query("SELECT LEAST($1::timestamptz, $2::timestamptz + ($3::int * INTERVAL '1 minute')) AS expires_at", [exam.ends_at, attempt.started_at, exam.duration_minutes]);
    const expiresAt = expiryResult.rows[0].expires_at;
    if (Date.now() >= new Date(expiresAt).getTime()) {
      await pool.query("UPDATE exam_attempts SET status='submitted',submitted_at=CURRENT_TIMESTAMP,marks=0 WHERE id=$1", [attempt.id]);
      return res.status(409).json({ error: "The exam timer has expired." });
    }

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

    return res.status(200).json({ exam, questions: questions.rows, attempt_id: attempt.id, expires_at: expiresAt });
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

    if (!Number.isInteger(examId) || examId<=0 || !Array.isArray(answers) && (answers == null || typeof answers !== 'object')) return res.status(400).json({ error: "Invalid exam ID or answers." });
    const attempt = (await client.query(
      `SELECT a.id,a.started_at,a.status,e.ends_at,e.duration_minutes,
        CURRENT_TIMESTAMP >= LEAST(e.ends_at,a.started_at + e.duration_minutes * INTERVAL '1 minute') AS expired
       FROM exam_attempts a JOIN exams e ON e.id=a.exam_id WHERE a.exam_id=$1 AND a.student_id=$2`,
      [examId, studentId]
    )).rows[0];

    if (!attempt) return res.status(400).json({ error: "No active exam session found." });
    if (attempt.status !== 'in_progress') return res.status(409).json({ error: "This exam attempt is already submitted." });
    if (attempt.expired) {
      await client.query("BEGIN");
      await client.query("UPDATE exam_attempts SET status='submitted',submitted_at=CURRENT_TIMESTAMP,marks=0 WHERE id=$1", [attempt.id]);
      await client.query("COMMIT");
      return res.status(409).json({ error: "Time expired. The exam has been submitted." });
    }

    const correctOptions = (await client.query(
      `SELECT o.id AS option_id, q.id AS question_id, q.marks
       FROM exam_options o
       JOIN exam_questions q ON o.question_id = q.id
       WHERE q.exam_id = $1 AND o.is_correct = TRUE`,
      [examId]
    )).rows;

    let totalEarnedMarks = 0;
    await client.query("BEGIN");

    if (answers && typeof answers === "object" && !Array.isArray(answers)) {
      for (const [qId, optId] of Object.entries(answers)) {
        if (!/^\d+$/.test(qId) || !/^\d+$/.test(String(optId))) continue;
        const validQuestion = await client.query("SELECT 1 FROM exam_questions WHERE id=$1 AND exam_id=$2", [Number(qId),examId]);
        const validOption = await client.query("SELECT 1 FROM exam_options o JOIN exam_questions q ON q.id=o.question_id WHERE o.id=$1 AND q.id=$2 AND q.exam_id=$3", [Number(optId),Number(qId),examId]);
        if (!validQuestion.rowCount || !validOption.rowCount) continue;
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

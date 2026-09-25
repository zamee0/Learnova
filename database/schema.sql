DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;

-- 1. USERS
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    first_name      VARCHAR(50) NOT NULL,
    last_name       VARCHAR(50) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    phone           VARCHAR(30),
    address         TEXT,
    bio             TEXT,
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_name ON users (lower(last_name), lower(first_name));
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_last_active ON users (last_active_at);

-- 2. STUDENT & TEACHER PROFILES
CREATE TABLE student_profiles (
    user_id         INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    institution     VARCHAR(200),
    semester        VARCHAR(100),
    student_code    VARCHAR(100) UNIQUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teacher_profiles (
    user_id         INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    qualification   VARCHAR(255),
    designation     VARCHAR(150),
    experience_years NUMERIC(4,1) CHECK (experience_years IS NULL OR experience_years >= 0),
    qualifications   JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(qualifications) = 'array'),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION create_role_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'student' THEN
        INSERT INTO student_profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
    ELSIF NEW.role = 'teacher' THEN
        INSERT INTO teacher_profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_role_profile
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_role_profile();

-- 3. CATEGORIES & COURSES
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
    id              SERIAL PRIMARY KEY,
    teacher_id      INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title           VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL,
    category        VARCHAR(100) NOT NULL,
    level           VARCHAR(50) NOT NULL DEFAULT 'Beginner' CHECK (level IN ('Beginner', 'Intermediate', 'Advanced', 'All Levels')),
    thumbnail_url   TEXT,
    is_published    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_courses_teacher ON courses(teacher_id);
CREATE INDEX idx_courses_category ON courses(lower(category));

-- 4. ENROLLMENTS & COURSE BANS
CREATE TABLE enrollments (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id       INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
    progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
);

CREATE TABLE course_bans (
    id          SERIAL PRIMARY KEY,
    course_id   INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_by   INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, user_id)
);

-- 5. ANNOUNCEMENTS & DISCUSSIONS
CREATE TABLE announcements (
    id          SERIAL PRIMARY KEY,
    course_id   INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id  INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE discussions (
    id          SERIAL PRIMARY KEY,
    course_id   INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE discussion_replies (
    id              SERIAL PRIMARY KEY,
    discussion_id   INT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. FRIENDSHIPS, MESSAGES, NOTIFICATIONS & AUDIT LOG
CREATE TABLE friendships (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (user_id <> friend_id)
);

CREATE UNIQUE INDEX uq_friendships_pair ON friendships (LEAST(user_id, friend_id), GREATEST(user_id, friend_id));

CREATE TABLE messages (
    id          SERIAL PRIMARY KEY,
    sender_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL CHECK (length(trim(content)) > 0),
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at     TIMESTAMPTZ,
    CHECK (sender_id <> receiver_id)
);

CREATE TABLE notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    message     TEXT,
    type        VARCHAR(50) NOT NULL DEFAULT 'general',
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at     TIMESTAMPTZ
);

CREATE TABLE activity_log (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type   VARCHAR(60) NOT NULL,
    description     TEXT NOT NULL,
    course_id       INT REFERENCES courses(id) ON DELETE SET NULL,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. CLASSROOM POSTS (NOTES), VIDEOS & LIVE CLASSES
CREATE TABLE classroom_posts (
    id          SERIAL PRIMARY KEY,
    course_id   INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id  INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL,
    attachment_data TEXT,
    attachment_name VARCHAR(255),
    attachment_type VARCHAR(100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE course_videos (
    id              SERIAL PRIMARY KEY,
    course_id       INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id      INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    video_url       TEXT NOT NULL,
    platform        VARCHAR(30) NOT NULL DEFAULT 'youtube' CHECK (platform IN ('youtube', 'vimeo', 'other')),
    thumbnail_url   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE live_classes (
    id              SERIAL PRIMARY KEY,
    course_id       INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id      INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title           VARCHAR(200) NOT NULL,
    platform        VARCHAR(30) NOT NULL CHECK (platform IN ('zoom', 'google_meet', 'google_classroom', 'microsoft_teams', 'other')),
    meeting_url     TEXT NOT NULL,
    description     TEXT,
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. ASSIGNMENTS & TIMED EXAMS
CREATE TABLE assignments (
    id              SERIAL PRIMARY KEY,
    course_id       INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id      INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    instructions    TEXT,
    total_marks     NUMERIC(8,2) NOT NULL DEFAULT 100 CHECK (total_marks >= 0),
    deadline        TIMESTAMPTZ NOT NULL,
    allow_late      BOOLEAN NOT NULL DEFAULT FALSE,
    attachments     JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachments) = 'array'),
    late_penalty_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (late_penalty_percent >= 0 AND late_penalty_percent <= 100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assignment_submissions (
    id              SERIAL PRIMARY KEY,
    assignment_id   INT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_url  TEXT,
    file_name       VARCHAR(255),
    answer_text     TEXT,
    file_data       TEXT,
    file_type       VARCHAR(100),
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    marks           NUMERIC(8,2),
    feedback        TEXT,
    graded_at       TIMESTAMPTZ,
    graded_by       INT REFERENCES users(id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'late', 'graded', 'returned')),
    UNIQUE(assignment_id, student_id)
);

CREATE TABLE exams (
    id              SERIAL PRIMARY KEY,
    course_id       INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id      INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    instructions    TEXT,
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    total_marks     NUMERIC(8,2) NOT NULL DEFAULT 100 CHECK (total_marks >= 0),
    max_attempts    INT NOT NULL DEFAULT 1 CHECK (max_attempts > 0),
    is_published    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exam_questions (
    id              SERIAL PRIMARY KEY,
    exam_id         INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_text   TEXT NOT NULL,
    question_type   VARCHAR(20) NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq', 'short_answer', 'long_answer')),
    marks           NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK (marks >= 0),
    position        INT NOT NULL CHECK (position > 0),
    UNIQUE(exam_id, position)
);

CREATE TABLE exam_options (
    id              SERIAL PRIMARY KEY,
    question_id     INT NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
    option_text     TEXT NOT NULL,
    position        INT NOT NULL CHECK (position > 0),
    is_correct      BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(question_id, position)
);

CREATE TABLE exam_attempts (
    id              SERIAL PRIMARY KEY,
    exam_id         INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_number  INT NOT NULL CHECK (attempt_number > 0),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at    TIMESTAMPTZ,
    marks           NUMERIC(8,2),
    status          VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
    UNIQUE(exam_id, student_id, attempt_number)
);

CREATE TABLE exam_answers (
    id              SERIAL PRIMARY KEY,
    attempt_id      INT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    question_id     INT NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
    selected_option_id INT REFERENCES exam_options(id) ON DELETE SET NULL,
    answer_text     TEXT,
    marks_awarded   NUMERIC(8,2),
    feedback        TEXT,
    UNIQUE(attempt_id, question_id)
);

-- 9. REVIEWS & CHECKPOINTS
CREATE TABLE course_reviews (
    id          SERIAL PRIMARY KEY,
    course_id   INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating      NUMERIC(3,1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
    review      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, student_id)
);

CREATE TABLE course_completions (
    id              SERIAL PRIMARY KEY,
    student_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id       INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    completed_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checkpoint_code VARCHAR(100) UNIQUE,
    UNIQUE(student_id, course_id)
);

-- A computed analytics value used by the teacher profile dashboard.
CREATE OR REPLACE FUNCTION teacher_course_metrics(p_teacher_id INT)
RETURNS TABLE(course_count BIGINT, enrolled_students BIGINT, average_rating NUMERIC)
LANGUAGE SQL STABLE AS $$
    SELECT
        (SELECT COUNT(*) FROM courses c WHERE c.teacher_id = p_teacher_id),
        (SELECT COUNT(DISTINCT e.user_id)
           FROM enrollments e JOIN courses c ON c.id = e.course_id
          WHERE c.teacher_id = p_teacher_id AND e.status <> 'dropped'),
        COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 2)
                    FROM course_reviews r JOIN courses c ON c.id = r.course_id
                   WHERE c.teacher_id = p_teacher_id), 0)
$$;

-- Publish a teacher's batch of assignments atomically within the caller's
-- transaction. p_created returns IDs and titles for the API response.
CREATE OR REPLACE PROCEDURE publish_course_assignments(
    IN p_course_id INT,
    IN p_teacher_id INT,
    IN p_assignments JSONB,
    INOUT p_created JSONB DEFAULT '[]'::jsonb
)
LANGUAGE plpgsql AS $$
DECLARE
    item JSONB;
    created_row RECORD;
BEGIN
    IF p_assignments IS NULL OR jsonb_typeof(p_assignments) <> 'array' OR jsonb_array_length(p_assignments) = 0 THEN
        RAISE EXCEPTION 'Assignments must be a non-empty JSON array' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM courses WHERE id = p_course_id AND teacher_id = p_teacher_id) THEN
        RAISE EXCEPTION 'Teacher does not own this course' USING ERRCODE = '42501';
    END IF;

    p_created := COALESCE(p_created, '[]'::jsonb);
    FOR item IN SELECT value FROM jsonb_array_elements(p_assignments)
    LOOP
        INSERT INTO assignments (course_id, teacher_id, title, description, instructions, total_marks, deadline, attachments)
        VALUES (
            p_course_id, p_teacher_id, item->>'title', NULLIF(item->>'description', ''),
            NULLIF(item->>'instructions', ''), COALESCE((item->>'total_marks')::numeric, 100),
            (item->>'deadline')::timestamptz, COALESCE(item->'attachments', '[]'::jsonb)
        ) RETURNING id, title, deadline, total_marks INTO created_row;
        p_created := p_created || jsonb_build_array(jsonb_build_object(
            'id', created_row.id, 'title', created_row.title,
            'deadline', created_row.deadline, 'total_marks', created_row.total_marks
        ));
    END LOOP;
END;
$$;

-- 10. REALISTIC SEED DATA (All passwords: 'password123')
INSERT INTO users (id, first_name, last_name, email, password_hash, role, phone, address, bio, avatar_url) VALUES
(1, 'Karim', 'Rahman', 'karim.teacher@learnova.com', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'teacher', '+8801700000001', 'Dhaka, Bangladesh', 'CSE Instructor with 10+ years in Distributed Databases and System Architecture.', 'https://i.pravatar.cc/150?u=karim'),
(2, 'Nusrat', 'Jahan', 'nusrat.teacher@learnova.com', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'teacher', '+8801700000002', 'Dhaka, Bangladesh', 'Data Science & Deep Learning Instructor. Machine Learning enthusiast.', 'https://i.pravatar.cc/150?u=nusrat'),
(3, 'Admin', 'Learnova', 'admin@learnova.com', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'admin', '+8801700000000', 'Dhaka, Bangladesh', 'System Administrator with complete platform governance access.', 'https://i.pravatar.cc/150?u=admin'),
(4, 'Zabir', 'Hasan', 'zabir.student@learnova.com', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'student', '+8801800000001', 'Dhaka, Bangladesh', 'Software Engineering undergrad passionate about Full-Stack web architecture.', 'https://i.pravatar.cc/150?u=zabir'),
(5, 'Fahim', 'Ahmed', 'fahim.student@learnova.com', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'student', '+8801800000002', 'Chattogram, Bangladesh', 'CS student exploring Relational PostgreSQL and Cloud deployments.', 'https://i.pravatar.cc/150?u=fahim'),
(6, 'Ayesha', 'Siddiqua', 'ayesha.student@learnova.com', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'student', '+8801800000003', 'Rajshahi, Bangladesh', 'Aspiring Data Scientist studying Neural Networks.', 'https://i.pravatar.cc/150?u=ayesha');

INSERT INTO student_profiles (user_id, institution, semester, student_code) VALUES
(4, 'BUET / University of Chittagong', '5th Semester', 'STU-1001'),
(5, 'BRAC University', '4th Semester', 'STU-1002'),
(6, 'Rajshahi University', '3rd Semester', 'STU-1003')
ON CONFLICT (user_id) DO UPDATE SET institution = EXCLUDED.institution, semester = EXCLUDED.semester;

INSERT INTO teacher_profiles (user_id, qualification, designation, experience_years) VALUES
(1, 'PhD in Computer Science', 'Associate Professor', 8.5),
(2, 'MSc in Data Science', 'Senior Lecturer', 6.0)
ON CONFLICT (user_id) DO UPDATE SET qualification = EXCLUDED.qualification, designation = EXCLUDED.designation;

INSERT INTO categories(name, description) VALUES
('Computer Science', 'Programming, databases, algorithms and computing fundamentals.'),
('Web Development', 'Frontend, backend and full-stack web development.'),
('Data Science', 'Data analysis, Python, statistics and machine learning.'),
('Cybersecurity', 'Network defense, authentication protocols and security audits.');

INSERT INTO courses (id, teacher_id, title, description, category, thumbnail_url, level) VALUES
(1, 1, 'Database Systems & SQL Optimization', 'Master Relational Algebra, SQL, Normalization (1NF to BCNF), and Index Performance.', 'Computer Science', 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800&auto=format&fit=crop', 'Beginner'),
(2, 1, 'Full-Stack Web Development with Node.js & PostgreSQL', 'Build production-ready RESTful APIs, JWT authentication, and responsive modern frontends.', 'Web Development', 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop', 'Intermediate'),
(3, 2, 'Applied Machine Learning & Neural Networks', 'Practical machine learning using Python, Scikit-Learn, and PyTorch for regression and classification.', 'Data Science', 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&auto=format&fit=crop', 'Intermediate');

INSERT INTO enrollments(id, user_id, course_id, status, progress_percent) VALUES
(1, 4, 1, 'completed', 100),
(2, 4, 2, 'active', 60),
(3, 5, 1, 'active', 45),
(4, 5, 3, 'active', 70),
(5, 6, 3, 'completed', 100);

INSERT INTO course_completions(student_id, course_id, checkpoint_code) VALUES
(4, 1, 'LN-CHECKPOINT-DB-4-1'),
(6, 3, 'LN-CHECKPOINT-ML-6-3');

INSERT INTO classroom_posts(course_id, teacher_id, title, content) VALUES
(1, 1, 'Module 1 Classroom Notes: Normalization Summary', 'Remember: 2NF eliminates partial dependencies on composite keys. 3NF eliminates transitive dependencies on non-key attributes.'),
(2, 1, 'REST API Architecture Guide', 'Always return standard HTTP status codes (200, 201, 400, 401, 403, 404, 500) and sanitize inputs using parameterized queries.');

INSERT INTO course_videos(course_id, teacher_id, title, description, video_url, platform) VALUES
(1, 1, 'Database Normalization Explained', 'Deep dive into functional dependencies and 1NF, 2NF, 3NF, BCNF.', 'https://www.youtube.com/watch?v=UrYLYV7WSHM', 'youtube'),
(2, 1, 'Node.js & Express REST API Crash Course', 'Learn how to architect REST APIs from scratch.', 'https://www.youtube.com/watch?v=Oe421EPjeBE', 'youtube');

INSERT INTO live_classes(course_id, teacher_id, title, platform, meeting_url, description, starts_at, ends_at) VALUES
(1, 1, 'Live Q&A: Query Optimization & Indexing', 'google_meet', 'https://meet.google.com/abc-defg-hij', 'Interactive weekly problem-solving session.', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours'),
(2, 1, 'Live Workshop: JWT & Role Authorization', 'zoom', 'https://zoom.us/j/1234567890', 'Building robust role-based security layers.', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 1.5 hours');

INSERT INTO assignments(id, course_id, teacher_id, title, description, instructions, total_marks, deadline) VALUES
(1, 1, 'Assignment 1: Relational Schema & 3NF Proof', 'Design an normalized schema for an online medical records platform.', 'Submit your DDL script or diagram URL before deadline.', 25.00, NOW() + INTERVAL '7 days');

INSERT INTO exams(id, course_id, teacher_id, title, description, instructions, starts_at, ends_at, duration_minutes, total_marks) VALUES
(1, 1, 'CS301 Midterm Exam: SQL & Normalization', 'Timed evaluation covering SQL joins and normalization anomalies.', 'You have 45 minutes from starting to submit.', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '5 days', 45, 20.00);

INSERT INTO exam_questions(id, exam_id, question_text, question_type, marks, position) VALUES
(1, 1, 'Which normal form eliminates partial dependencies on candidate keys?', 'mcq', 10.00, 1),
(2, 1, 'Which SQL clause executes before the SELECT clause in query evaluation?', 'mcq', 10.00, 2);

INSERT INTO exam_options(question_id, option_text, position, is_correct) VALUES
(1, '1NF', 1, FALSE),
(1, '2NF', 2, TRUE),
(1, '3NF', 3, FALSE),
(1, 'BCNF', 4, FALSE),
(2, 'FROM', 1, TRUE),
(2, 'WHERE', 2, FALSE),
(2, 'SELECT', 3, FALSE),
(2, 'ORDER BY', 4, FALSE);

INSERT INTO course_reviews(course_id, student_id, rating, review) VALUES
(1, 4, 9.5, 'Superb course! The normalization exercises and live sessions made database concepts very clear.'),
(3, 6, 9.0, 'Very practical deep learning course with clear PyTorch code samples.');

INSERT INTO announcements(id, course_id, teacher_id, title, content) VALUES
(1, 1, 1, 'Welcome to Database Systems!', 'Please review the syllabus and check the classroom notes before our live session.');

INSERT INTO discussions(id, course_id, user_id, title, content) VALUES
(1, 1, 4, 'When is BCNF preferred over 3NF in high-throughput applications?', 'Could someone clarify the trade-off between functional dependency preservation and anomaly removal in BCNF?');

INSERT INTO discussion_replies(discussion_id, user_id, content) VALUES
(1, 1, 'BCNF eliminates all anomalies from non-trivial FDs X -> Y where X is not a superkey. If preserving dependencies without joins is critical, 3NF is preferred.');

INSERT INTO friendships(user_id, friend_id, status) VALUES
(4, 5, 'accepted'),
(4, 6, 'pending');

INSERT INTO messages(sender_id, receiver_id, content, is_read) VALUES
(4, 5, 'Hey Fahim, did you test the Assignment 1 SQL queries on Neon?', TRUE),
(5, 4, 'Yes Zabir, everything passed all test cases!', FALSE);

INSERT INTO notifications(user_id, title, message, type, is_read) VALUES
(4, 'Course Completed!', 'Congratulations! You completed Database Systems & SQL Optimization.', 'course_completion', FALSE),
(4, 'New Announcement', 'Prof. Karim Rahman posted an announcement in Database Systems.', 'announcement', FALSE);

INSERT INTO activity_log(user_id, activity_type, description, course_id) VALUES
(4, 'course_enrollment', 'Enrolled in Database Systems.', 1),
(4, 'course_completed', 'Completed Database Systems with 100% progress.', 1);

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('courses_id_seq', (SELECT MAX(id) FROM courses));
SELECT setval('enrollments_id_seq', (SELECT MAX(id) FROM enrollments));
SELECT setval('announcements_id_seq', (SELECT MAX(id) FROM announcements));
SELECT setval('discussions_id_seq', (SELECT MAX(id) FROM discussions));
SELECT setval('assignments_id_seq', (SELECT MAX(id) FROM assignments));
SELECT setval('exams_id_seq', (SELECT MAX(id) FROM exams));
SELECT setval('exam_questions_id_seq', (SELECT MAX(id) FROM exam_questions));

-- ============================================================
-- LEARNOVA — PostgreSQL Schema (Backend Milestone: 50%)
-- Run:  psql -U your_db_user -d learnova -f database/schema.sql
-- ============================================================

DROP TABLE IF EXISTS notifications, friend_requests, friendships, messages,
    discussion_replies, discussions, announcements, enrollments, courses, users CASCADE;

-- 1. USERS (unified — both students and teachers, distinguished by role)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher')),
    avatar_url VARCHAR(255),
    bio TEXT,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. COURSES
CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    teacher_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    thumbnail_url VARCHAR(255),
    level VARCHAR(50) DEFAULT 'Beginner' CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. ENROLLMENTS (Student <--> Course, M:N)
CREATE TABLE enrollments (
    enrollment_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, course_id)
);

-- 4. ANNOUNCEMENTS (teacher posts to a course; triggers notifications to enrolled students)
CREATE TABLE announcements (
    announcement_id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    teacher_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. DISCUSSIONS (thread starter, scoped to a course — only enrolled users can post)
CREATE TABLE discussions (
    discussion_id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. DISCUSSION_REPLIES (replies inside a thread)
CREATE TABLE discussion_replies (
    reply_id SERIAL PRIMARY KEY,
    discussion_id INT NOT NULL REFERENCES discussions(discussion_id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. FRIEND_REQUESTS
CREATE TABLE friend_requests (
    request_id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (sender_id, receiver_id)
);

-- 8. FRIENDSHIPS (created once a request is accepted; one row per pair, queried both directions)
CREATE TABLE friendships (
    friendship_id SERIAL PRIMARY KEY,
    user_a_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    user_b_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_a_id, user_b_id)
);

-- 9. MESSAGES (direct messages — only allowed between friends, enforced in controller)
CREATE TABLE messages (
    message_id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. NOTIFICATIONS
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'general',  -- 'announcement' | 'friend_request' | 'friend_accept' | 'message'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Helpful indexes for the queries we'll run a lot
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_messages_pair ON messages(sender_id, receiver_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Passwords below are bcrypt hashes of "password123" (10 rounds) — use these to log in while testing.
INSERT INTO users (first_name, last_name, email, password_hash, role, avatar_url, bio) VALUES
('Karim', 'Rahman', 'karim.teacher@learnova.com', '$2b$10$pxVAJT48Hfj8LnkGA9BKkePc5BX5cE6QO05FETDgeJThVf0GQ1Ndq', 'teacher', 'https://i.pravatar.cc/150?u=karim', 'CSE instructor, PhD from BUET.'),
('Nusrat', 'Jahan', 'nusrat.teacher@learnova.com', '$2b$10$pxVAJT48Hfj8LnkGA9BKkePc5BX5cE6QO05FETDgeJThVf0GQ1Ndq', 'teacher', 'https://i.pravatar.cc/150?u=nusrat', 'Data Science instructor.'),
('Zabir', 'Hasan', 'zabir.student@learnova.com', '$2b$10$pxVAJT48Hfj8LnkGA9BKkePc5BX5cE6QO05FETDgeJThVf0GQ1Ndq', 'student', 'https://i.pravatar.cc/150?u=zabir', 'CS undergrad.'),
('Fahim', 'Ahmed', 'fahim.student@learnova.com', '$2b$10$pxVAJT48Hfj8LnkGA9BKkePc5BX5cE6QO05FETDgeJThVf0GQ1Ndq', 'student', 'https://i.pravatar.cc/150?u=fahim', 'Loves backend dev.'),
('Ayesha', 'Siddiqua', 'ayesha.student@learnova.com', '$2b$10$pxVAJT48Hfj8LnkGA9BKkePc5BX5cE6QO05FETDgeJThVf0GQ1Ndq', 'student', 'https://i.pravatar.cc/150?u=ayesha', 'Aspiring data scientist.');

-- 12 dummy courses across two teachers
INSERT INTO courses (teacher_id, title, description, category, thumbnail_url, level) VALUES
(1, 'Database Fundamentals', 'Learn relational databases, SQL, and normalization from scratch.', 'Computer Science', 'https://picsum.photos/seed/db101/400/240', 'Beginner'),
(1, 'Web Development with Node.js', 'Build REST APIs using Express and PostgreSQL.', 'Web Development', 'https://picsum.photos/seed/node101/400/240', 'Intermediate'),
(1, 'Object-Oriented Programming in Java', 'Core OOP concepts with hands-on Java projects.', 'Computer Science', 'https://picsum.photos/seed/java101/400/240', 'Beginner'),
(1, 'Operating Systems Concepts', 'Processes, threads, memory management, and scheduling.', 'Computer Science', 'https://picsum.photos/seed/os101/400/240', 'Advanced'),
(1, 'Git and GitHub for Developers', 'Version control workflows for teams.', 'Web Development', 'https://picsum.photos/seed/git101/400/240', 'Beginner'),
(1, 'Data Structures and Algorithms', 'Arrays, trees, graphs, and algorithmic problem solving.', 'Computer Science', 'https://picsum.photos/seed/dsa101/400/240', 'Intermediate'),
(2, 'Python for Data Science', 'NumPy, pandas, and data wrangling essentials.', 'Data Science', 'https://picsum.photos/seed/py101/400/240', 'Beginner'),
(2, 'Machine Learning Basics', 'Supervised learning, regression, and classification.', 'Data Science', 'https://picsum.photos/seed/ml101/400/240', 'Intermediate'),
(2, 'Statistics for Data Analysis', 'Probability, hypothesis testing, and distributions.', 'Mathematics', 'https://picsum.photos/seed/stat101/400/240', 'Beginner'),
(2, 'Deep Learning with Neural Networks', 'CNNs, RNNs, and practical deep learning.', 'Data Science', 'https://picsum.photos/seed/dl101/400/240', 'Advanced'),
(2, 'Data Visualization', 'Telling stories with matplotlib and Tableau.', 'Data Science', 'https://picsum.photos/seed/viz101/400/240', 'Beginner'),
(2, 'Linear Algebra for Machine Learning', 'Vectors, matrices, and eigenvalues for ML.', 'Mathematics', 'https://picsum.photos/seed/linalg101/400/240', 'Intermediate');

-- Sample enrollments
INSERT INTO enrollments (student_id, course_id) VALUES
(3, 1), (3, 2), (3, 6),
(4, 1), (4, 7), (4, 8),
(5, 7), (5, 9), (5, 10);

-- Sample announcement
INSERT INTO announcements (course_id, teacher_id, title, content) VALUES
(1, 1, 'Welcome to Database Fundamentals', 'Please review the syllabus before our first session on Monday.');

-- Sample notification (mirrors the announcement above, for student_id 3 and 4 who are enrolled in course 1)
INSERT INTO notifications (user_id, title, message, type) VALUES
(3, 'New announcement: Database Fundamentals', 'Welcome to Database Fundamentals', 'announcement'),
(4, 'New announcement: Database Fundamentals', 'Welcome to Database Fundamentals', 'announcement');

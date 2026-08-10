# Learnova — Backend (50% Milestone)

Node.js + Express + PostgreSQL backend for an e-learning platform. Auth, courses, enrollments,
announcements (with notification fan-out), course discussions, friend requests, and friends-only
direct messaging — all tested end-to-end against a real Postgres instance.

## Setup

```bash
cd backend
npm install
cp .env.example .env      # then edit .env with your local Postgres username/password
createdb learnova
psql -d learnova -f ../database/schema.sql
npm start
```

Server runs at `http://localhost:5000`. Open `http://localhost:5000` in a browser for a minimal
plain-HTML test page (signup/login/browse courses) — good for a quick sanity check, but Postman
is the real testing tool (see below).

## Seed accounts (all use password: `password123`)

| Email | Role |
|---|---|
| karim.teacher@learnova.com | teacher |
| nusrat.teacher@learnova.com | teacher |
| zabir.student@learnova.com | student |
| fahim.student@learnova.com | student |
| ayesha.student@learnova.com | student |

12 dummy courses are pre-seeded (owned by Karim and Nusrat), with a few sample enrollments already in place.

## What's implemented (this milestone)

- **Auth**: unified signup/login for student + teacher (JWT, bcrypt)
- **Courses**: browse/filter, course detail, create (teacher), my enrolled courses (student), my teaching courses (teacher)
- **Enrollments**: enroll in a course, teacher can view who's enrolled
- **Announcements**: teacher posts to their course → every enrolled student automatically gets a notification (single transactional query, not a loop)
- **Discussions**: threaded, scoped per course — only the course's teacher or an enrolled student can post/reply
- **Friend requests**: send / accept / reject, notifies both sides
- **Messages**: direct messaging — blocked until both users are friends
- **Notifications**: unified feed (announcements, friend requests, friend accepts), mark read
- **Profile**: avatar, bio, "Active Now" (auto-updated on every authenticated request, considered active if seen in the last 5 minutes), total courses enrolled/teaching

## Not yet built (next 50%)

- Lessons/modules/resources inside a course (content delivery)
- Frontend (this milestone only ships a bare-bones HTML test page, not the real UI)
- Group chat, quizzes, payments, certificates — deferred from the full ERD to keep this milestone focused

## Testing with Postman — step by step

Base URL: `http://localhost:5000/api`

### 1. Auth
- `POST /auth/signup` — body: `{ "first_name", "last_name", "email", "password", "role": "student"|"teacher" }`
- `POST /auth/login` — body: `{ "email", "password" }` → copy the `token` from the response

**Set up a Postman environment variable** `token` and paste it in after login — then every protected request uses header `Authorization: Bearer {{token}}`. Log in as a student and a teacher in two separate requests, save both tokens (e.g. `student_token`, `teacher_token`) since you'll need both roles to test everything.

### 2. Courses
- `GET /courses` — public, browse all
- `GET /courses?category=Data Science` — filter
- `GET /courses/:id` — course detail
- `GET /courses/my` — (student token) my enrolled courses
- `GET /courses/teaching` — (teacher token) my created courses
- `POST /courses` — (teacher token) body: `{ "title", "description", "category", "level" }`

### 3. Enrollments
- `POST /enrollments` — (student token) body: `{ "course_id": 2 }`
- `GET /enrollments/course/:courseId` — (teacher token, must own the course) who's enrolled

### 4. Announcements
- `POST /announcements` — (teacher token, must own the course) body: `{ "course_id": 1, "title", "content" }` — check `/notifications` as a student enrolled in that course afterward, you should see it appear
- `GET /announcements/course/:courseId` — public

### 5. Discussions
- `POST /discussions` — (student or teacher, must be enrolled/own the course) body: `{ "course_id": 1, "title", "content" }`
- `GET /discussions/course/:courseId`
- `POST /discussions/:id/replies` — body: `{ "content" }`
- `GET /discussions/:id/replies`

### 6. Friends
- `POST /friends/request` — body: `{ "receiver_id": 4 }`
- `GET /friends/requests` — (as the receiver) see incoming pending requests
- `PUT /friends/request/:id` — (as the receiver) body: `{ "action": "accept" }` or `"reject"`
- `GET /friends` — my friend list with Active Now status

### 7. Messages (try this BEFORE and AFTER accepting a friend request to see the block in action)
- `POST /messages` — body: `{ "receiver_id": 4, "content": "hey!" }` → 403 if not friends yet
- `GET /messages` — my conversation list
- `GET /messages/:otherUserId` — full thread with one friend (also marks it read)

### 8. Notifications
- `GET /notifications`
- `PUT /notifications/:id/read`
- `PUT /notifications/read-all`

### Suggested test order (mirrors a real user flow)
1. Signup a new student and a new teacher (or use seed accounts)
2. Teacher creates a course
3. Student enrolls in it
4. Teacher posts an announcement → student checks notifications
5. Student posts a discussion thread → teacher replies
6. Student sends a friend request to another student → try messaging (blocked) → other student accepts → message again (works)

# Learnova

Learnova is a learning platform where teachers can publish courses and learning materials, and students can enroll, take exams, submit assignments, and connect with other users.

## Screenshots

<!--
To add a picture:
1. Create a folder named `screenshots` beside this README.
2. Put your image in that folder, for example `dashboard.png`.
3. Uncomment and edit a line like this:
   ![Learnova dashboard](screenshots/dashboard.png)
-->

<!-- ![Learnova dashboard](screenshots/dashboard.png) -->

## Features

- Student, teacher, and admin accounts
- Course creation, enrollment, notes, announcements, and discussions
- Assignments, submissions, grading, and timed exams
- Profiles, friend requests, notifications, and messaging
- PostgreSQL database with role-based access

## Built With

- Frontend: HTML, CSS, and JavaScript
- Backend: Node.js and Express
- Database: PostgreSQL
- Authentication: JWT and bcrypt
- Realtime features: Socket.io

## Run Locally

### Requirements

- Node.js and npm
- PostgreSQL

### 1. Configure the database

Create a PostgreSQL database, then create `backend/.env` with:

```env
DATABASE_URL=postgres://YOUR_USER:YOUR_PASSWORD@localhost:5432/YOUR_DATABASE
JWT_SECRET=replace-this-with-a-long-random-secret
PORT=5000
```

For a **new, empty database only**, create the tables and sample data with:

```bash
psql "YOUR_DATABASE_URL" -f database/schema.sql
```

> Warning: `database/schema.sql` drops and recreates the `public` schema. Do not run it on a database whose data you need. For an existing Learnova database, back it up and use the appropriate SQL migration in `database/migrations/` instead.

### 2. Install and start the app

From the project folder:

```bash
cd backend
npm install
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) in your browser. To start without the development watcher, use `npm start` from the `backend` folder.

## Project Structure

```text
backend/       Express API, controllers, routes, authentication, and Socket.io
database/      PostgreSQL schema and migrations
docs/          Project documentation
frontend/      HTML pages, CSS, JavaScript, and default images
```

## Demo Accounts

The sample rows in `database/schema.sql` use the password `password123`. For example:

- Teacher: `karim.teacher@learnova.com`
- Student: `zabir.student@learnova.com`
- Admin: `admin@learnova.com`

Use these accounts only with local sample data. Change demo credentials and secrets before deploying the project.

## License

Add your project license here if you choose to publish one.

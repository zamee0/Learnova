const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve the minimal HTML test frontend
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/courses", require("./routes/courseRoutes"));
app.use("/api/enrollments", require("./routes/enrollmentRoutes"));
app.use("/apigit /announcements", require("./routes/announcementRoutes"));
app.use("/api/discussions", require("./routes/discussionRoutes"));
app.use("/api/friends", require("./routes/friendRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));

// Test route
app.get("/api", (req, res) => {
    res.json({ message: "Welcome to Learnova API" });
});

module.exports = app;

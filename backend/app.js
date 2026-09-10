const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend")));

// Route Mounts
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/courses", require("./routes/courseRoutes"));
app.use("/api/enrollments", require("./routes/enrollmentRoutes"));
app.use("/api/announcements", require("./routes/announcementRoutes"));
app.use("/api/discussions", require("./routes/discussionRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/friends", require("./routes/friendRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Internal Server Error:", err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error"
  });
});

module.exports = app;
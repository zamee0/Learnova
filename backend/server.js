const app = require("./app");
require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const pool = require("./config/db");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
app.set("io", io);
io.use(async (socket, next) => {
  try {
    const decoded=jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET || "learnova_jwt_secret_2026");
    const account=await pool.query("SELECT role,is_active FROM users WHERE id=$1",[decoded.id]);
    if(!account.rowCount||!account.rows[0].is_active||account.rows[0].role!==decoded.role) throw new Error('Unauthorized');
    socket.user={...decoded,role:account.rows[0].role}; next();
  }
  catch { next(new Error("Unauthorized")); }
});
io.on("connection", async socket => {
  const userId = socket.user.id;
  socket.join(`user:${userId}`);
  await pool.query("UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1", [userId]);
  io.emit("presence", { user_id: userId, is_online: true });
  socket.on("dm:typing", async ({ to, is_typing }) => {
    if (!Number.isInteger(Number(to)) || Number(to) === userId) return;
    const allowed = await pool.query("SELECT 1 FROM friendships WHERE status = 'accepted' AND ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))", [userId, Number(to)]);
    if (allowed.rowCount) io.to(`user:${Number(to)}`).emit("dm:typing", { from: userId, is_typing: Boolean(is_typing) });
  });
  socket.on("dm:read", async ({ from }) => {
    const other = Number(from);
    if (!Number.isInteger(other)) return;
    const allowed = await pool.query("SELECT 1 FROM friendships WHERE status = 'accepted' AND ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))", [userId, other]);
    if (!allowed.rowCount) return;
    await pool.query("UPDATE messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE", [other, userId]);
    io.to(`user:${other}`).emit("dm:read", { by: userId });
  });
  socket.on("disconnect", async () => {
    const stillConnected = await io.in(`user:${userId}`).fetchSockets();
    if (!stillConnected.length) {
      await pool.query("UPDATE users SET last_active_at = CURRENT_TIMESTAMP - INTERVAL '6 minutes' WHERE id = $1", [userId]);
      io.emit("presence", { user_id: userId, is_online: false });
    }
  });
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`Learnova Backend running at:`);
  console.log(`http://localhost:${PORT}`);
  console.log(`=========================================`);
});

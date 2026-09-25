const API_BASE = "/api";
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function readUpload(file, maxBytes = 5 * 1024 * 1024) {
  const allowed = ['application/pdf','text/plain','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip','application/x-zip-compressed'];
  if (!allowed.includes(file.type) || file.size > maxBytes) throw new Error('Choose a supported PDF, Office, text, image, or ZIP file under the size limit.');
  const data = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('Could not read the selected file.')); reader.readAsDataURL(file); });
  return { name:file.name, type:file.type, data };
}
async function readImageUpload(file, maxBytes = 4 * 1024 * 1024) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > maxBytes) throw new Error('Choose a JPEG, PNG, or WebP image under 4 MB.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "/login.html";
    throw new Error("Session expired. Please log in.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function getCurrentUser() {
  const u = localStorage.getItem("user");
  return u ? JSON.parse(u) : null;
}

function checkAuth(role = null) {
  const u = getCurrentUser();
  if (!u || !localStorage.getItem("token")) {
    window.location.href = "/login.html";
    return null;
  }
  if (role && u.role !== role && u.role !== 'admin') {
    window.location.href = "/dashboard.html";
    return null;
  }
  return u;
}

function logout() {
  localStorage.clear();
  window.location.href = "/login.html";
}

function formatDate(d) {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function renderNavigation(active = "") {
  const user = getCurrentUser();
  if (!user) return;
  const nav = document.getElementById("sidebarNav");
  if (!nav) return;

  const items = [];
  if (user.role === 'admin') {
    items.push({ name: "Admin Dashboard", href: "/admin.html", icon: "fa-solid fa-shield-halved", key: "admin" });
  }
  items.push({ name: "Dashboard", href: "/dashboard.html", icon: "fa-solid fa-chart-pie", key: "dashboard" });

  if (user.role === 'teacher') {
    items.push({ name: "Teaching Courses", href: "/my-courses.html", icon: "fa-solid fa-chalkboard-user", key: "my-courses" });
    items.push({ name: "Create Course", href: "/teacher-course.html", icon: "fa-solid fa-plus-circle", key: "teacher-course" });
  } else if (user.role === 'student') {
    items.push({ name: "Browse Courses", href: "/courses.html", icon: "fa-solid fa-book-open", key: "courses" });
    items.push({ name: "My Enrolled Courses", href: "/my-courses.html", icon: "fa-solid fa-graduation-cap", key: "my-courses" });
    items.push({ name: "Friends", href: "/friends.html", icon: "fa-solid fa-user-group", key: "friends" });
  }

  if (user.role === 'teacher') items.push({ name: "Friends", href: "/friends.html", icon: "fa-solid fa-user-group", key: "friends" });

  items.push(
    { name: "Discussions", href: "/discussions.html", icon: "fa-solid fa-comments", key: "discussions" },
    { name: "Messages", href: "/messages.html", icon: "fa-solid fa-paper-plane", key: "messages", hasMsgDot: true },
    { name: "Notifications", href: "/notifications.html", icon: "fa-solid fa-bell", key: "notifications", hasNotifDot: true },
    { name: "Profile", href: "/profile.html", icon: "fa-solid fa-user", key: "profile" }
  );

  nav.innerHTML = items.map(i => `
    <li class="nav-item ${active === i.key ? 'active' : ''}">
      <a href="${i.href}" style="position:relative;">
        <i class="${i.icon}"></i>
        <span>${i.name}</span>
        ${i.hasNotifDot ? '<span id="notifRedDot" class="red-dot" style="display:none;"></span>' : ''}
        ${i.hasMsgDot ? '<span id="msgRedDot" class="red-dot" style="display:none;"></span>' : ''}
      </a>
    </li>
  `).join("");

  document.querySelectorAll(".current-user-avatar").forEach(e => { e.innerHTML = `<img src="${escapeHtml(user.avatar_url || '/images/default-avatar.svg')}" alt="Profile picture" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`; });
  document.querySelectorAll(".current-user-name").forEach(e => e.textContent = `${user.first_name} ${user.last_name}`);
  document.querySelectorAll(".current-user-role").forEach(e => e.textContent = user.role);

  updateUnreadIndicators();
  if (!user.avatar_url) apiFetch('/users/me').then(profile => {
    localStorage.setItem('user', JSON.stringify({ ...user, avatar_url: profile.avatar_url }));
    document.querySelectorAll('.current-user-avatar img').forEach(img => img.src = profile.avatar_url || '/images/default-avatar.svg');
  }).catch(() => {});
}

// Presence Heartbeat every 2 minutes
setInterval(() => {
  if (localStorage.getItem("token")) apiFetch("/users/heartbeat", { method: "POST" }).catch(() => {});
}, 120000);

// Red Dot Check for Notifications AND Incoming Messages
async function updateUnreadIndicators() {
  if (!localStorage.getItem("token")) return;
  try {
    const notifs = await apiFetch("/notifications");
    const unreadNotifs = notifs.filter(n => !n.is_read).length;
    document.querySelectorAll("#notifRedDot").forEach(d => {
      d.style.display = unreadNotifs > 0 ? "inline-block" : "none";
    });

    const convs = await apiFetch("/messages");
    const unreadMsgs = convs.filter(c => c.unread_count > 0).length;
    document.querySelectorAll("#msgRedDot").forEach(d => {
      d.style.display = unreadMsgs > 0 ? "inline-block" : "none";
    });
  } catch (e) {}
}

document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("token")) updateUnreadIndicators();
});

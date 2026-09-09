const API_BASE = "/api";

// Core authenticated API Fetcher
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login.html";
      throw new Error("Session expired. Please log in again.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || "Request failed");
    }

    return data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

// User Helpers
function getCurrentUser() {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}

function checkAuth(requiredRole = null) {
  const token = localStorage.getItem("token");
  const user = getCurrentUser();

  if (!token || !user) {
    window.location.href = "/login.html";
    return null;
  }

  if (requiredRole && user.role !== requiredRole) {
    window.location.href = "/dashboard.html";
    return null;
  }

  return user;
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login.html";
}

// Format utilities
function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getInitials(name) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

// Render dynamic navigation based on role
function renderNavigation(activePage = "") {
  const user = getCurrentUser();
  if (!user) return;

  const isTeacher = user.role === "teacher";
  const sidebarNav = document.getElementById("sidebarNav");
  if (!sidebarNav) return;

  const navItems = isTeacher
    ? [
        { name: "Dashboard", href: "/dashboard.html", icon: "fa-solid fa-chart-pie", key: "dashboard" },
        { name: "My Teaching Courses", href: "/my-courses.html", icon: "fa-solid fa-chalkboard-user", key: "my-courses" },
        { name: "Create Course", href: "/teacher-course.html", icon: "fa-solid fa-plus-circle", key: "teacher-course" },
        { name: "Discussions", href: "/discussions.html", icon: "fa-solid fa-comments", key: "discussions" },
        { name: "Messages", href: "/messages.html", icon: "fa-solid fa-paper-plane", key: "messages" },
        { name: "Notifications", href: "/notifications.html", icon: "fa-solid fa-bell", key: "notifications" },
        { name: "Profile", href: "/profile.html", icon: "fa-solid fa-user", key: "profile" }
      ]
    : [
        { name: "Dashboard", href: "/dashboard.html", icon: "fa-solid fa-chart-pie", key: "dashboard" },
        { name: "Browse Courses", href: "/courses.html", icon: "fa-solid fa-book-open", key: "courses" },
        { name: "My Enrolled Courses", href: "/my-courses.html", icon: "fa-solid fa-graduation-cap", key: "my-courses" },
        { name: "Discussions", href: "/discussions.html", icon: "fa-solid fa-comments", key: "discussions" },
        { name: "Messages", href: "/messages.html", icon: "fa-solid fa-paper-plane", key: "messages" },
        { name: "Friends", href: "/friends.html", icon: "fa-solid fa-user-group", key: "friends" },
        { name: "Notifications", href: "/notifications.html", icon: "fa-solid fa-bell", key: "notifications" },
        { name: "Profile", href: "/profile.html", icon: "fa-solid fa-user", key: "profile" }
      ];

  sidebarNav.innerHTML = navItems.map(item => `
    <li class="nav-item ${activePage === item.key ? 'active' : ''}">
      <a href="${item.href}">
        <i class="${item.icon}"></i>
        <span>${item.name}</span>
      </a>
    </li>
  `).join("");

  // Update header/topbar elements
  const userNameEls = document.querySelectorAll(".current-user-name");
  const userRoleEls = document.querySelectorAll(".current-user-role");
  const userAvatarEls = document.querySelectorAll(".current-user-avatar");

  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;
  userNameEls.forEach(el => el.textContent = fullName);
  userRoleEls.forEach(el => el.textContent = user.role);
  userAvatarEls.forEach(el => {
    el.textContent = getInitials(fullName);
  });
}
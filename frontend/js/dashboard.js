document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("dashboard");

  const statsContainer = document.getElementById("statsContainer");
  const announcementsContainer = document.getElementById("announcementsContainer");

  try {
    const stats = await apiFetch("/dashboard/stats");

    if (user.role === "teacher") {
      statsContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon primary"><i class="fa-solid fa-chalkboard-user"></i></div>
          <div class="stat-info"><div class="stat-value">${stats.totalCourses || 0}</div><div class="stat-label">My Teaching Courses</div></div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon success"><i class="fa-solid fa-comments"></i></div>
          <div class="stat-info"><div class="stat-value">${stats.totalDiscussions || 0}</div><div class="stat-label">Active Discussions</div></div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon warning"><i class="fa-solid fa-bell"></i></div>
          <div class="stat-info"><div class="stat-value">${stats.unreadNotifications || 0}</div><div class="stat-label">Unread Notifications</div></div>
        </div>
      `;
    } else {
      statsContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon primary"><i class="fa-solid fa-book-open"></i></div>
          <div class="stat-info"><div class="stat-value">${stats.enrolledCourses || 0}</div><div class="stat-label">Enrolled Courses</div></div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon success"><i class="fa-solid fa-comments"></i></div>
          <div class="stat-info"><div class="stat-value">${stats.activeDiscussions || 0}</div><div class="stat-label">Discussions</div></div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon warning"><i class="fa-solid fa-bell"></i></div>
          <div class="stat-info"><div class="stat-value">${stats.unreadNotifications || 0}</div><div class="stat-label">Notifications</div></div>
        </div>
      `;
    }

    const announcements = await apiFetch("/announcements/recent");
    if (!announcements || announcements.length === 0) {
      announcementsContainer.innerHTML = `<p style="color:var(--gray-500);">No recent announcements.</p>`;
    } else {
      announcementsContainer.innerHTML = announcements.map(a => `
        <div class="card" style="margin-bottom: 1rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
            <strong>${a.title}</strong>
            <span class="badge badge-primary">${formatDate(a.created_at)}</span>
          </div>
          <p style="color:var(--gray-700); font-size:0.9rem;">${a.content}</p>
          <div style="font-size:0.8rem; color:var(--gray-500); margin-top:0.5rem;">
            Course: <strong>${a.course_title}</strong> • By ${a.teacher_name}
          </div>
        </div>
      `).join("");
    }
  } catch (err) {
    statsContainer.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
});

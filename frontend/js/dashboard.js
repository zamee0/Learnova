document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("dashboard");

  const statsContainer = document.getElementById("statsContainer");
  const announcementsContainer = document.getElementById("announcementsContainer");

  try {
    const statsData = await apiFetch("/dashboard/stats");
    const stats = statsData.stats || statsData;

    if (user.role === "teacher") {
      statsContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon primary"><i class="fa-solid fa-chalkboard-user"></i></div>
          <div class="stat-info"><div class="stat-value">${stats.totalCourses || stats.coursesCount || 0}</div><div class="stat-label">My Courses</div></div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon success"><i class="fa-solid fa-comments"></i></div>
          <div class="stat-info"><div class="stat-value">${stats.totalDiscussions || 0}</div><div class="stat-label">Discussions</div></div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon warning"><i class="fa-solid fa-bell"></i></div>
          <div class="stat-info"><div class="stat-value">${stats.unreadNotifications || stats.notificationsCount || 0}</div><div class="stat-label">Notifications</div></div>
        </div>
      `;
    } else {
      statsContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon primary"><i class="fa-solid fa-book-open"></i></div>
          <div class="stat-info"><div class="stat-value">${stats.enrolledCourses || stats.enrollmentsCount || 0}</div><div class="stat-label">Enrolled Courses</div></div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon success"><i class="fa-solid fa-comments"></i></div>
          <div class="stat-info"><div class="stat-value">${stats.activeDiscussions || stats.discussionsCount || 0}</div><div class="stat-label">Discussions</div></div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon warning"><i class="fa-solid fa-bell"></i></div>
          <div class="stat-info"><div class="stat-value">${stats.unreadNotifications || stats.notificationsCount || 0}</div><div class="stat-label">Notifications</div></div>
        </div>
      `;
    }

    // Fetch recent announcements
    const announcements = await apiFetch("/announcements/recent");
    if (!announcements || announcements.length === 0) {
      announcementsContainer.innerHTML = `
        <div class="state-container">
          <i class="fa-regular fa-bell-slash"></i>
          <p>No recent announcements available</p>
        </div>`;
    } else {
      announcementsContainer.innerHTML = announcements.map(a => `
        <div class="card" style="margin-bottom: 1rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
            <h4 style="font-size:1rem; font-weight:600;">${a.title}</h4>
            <span class="badge badge-primary">${formatDate(a.created_at)}</span>
          </div>
          <p style="color:var(--gray-700); font-size:0.9rem;">${a.content}</p>
        </div>
      `).join("");
    }
  } catch (err) {
    statsContainer.innerHTML = `<div class="alert alert-danger">Error loading dashboard stats: ${err.message}</div>`;
  }
});
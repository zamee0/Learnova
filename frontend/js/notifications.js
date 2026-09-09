document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("notifications");

  const notificationsList = document.getElementById("notificationsList");
  const markAllBtn = document.getElementById("markAllBtn");

  async function loadNotifications() {
    try {
      notificationsList.innerHTML = `<div class="state-container"><div class="spinner"></div></div>`;
      const data = await apiFetch("/notifications");
      const notifications = Array.isArray(data) ? data : (data.notifications || []);

      if (notifications.length === 0) {
        notificationsList.innerHTML = `
          <div class="state-container">
            <i class="fa-regular fa-bell"></i>
            <p>No notifications yet</p>
          </div>`;
        return;
      }

      notificationsList.innerHTML = notifications.map(n => `
        <div class="card" style="margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center; background:${n.is_read ? 'var(--white)' : 'var(--primary-light)'}">
          <div>
            <p style="font-weight:${n.is_read ? '500' : '600'}; font-size:0.95rem;">${n.message || n.content}</p>
            <span style="font-size:0.8rem; color:var(--gray-500);">${formatDate(n.created_at)}</span>
          </div>
          ${!n.is_read ? `
            <button class="btn btn-outline btn-sm" onclick="markRead(${n.id})">Mark as read</button>
          ` : ''}
        </div>
      `).join("");
    } catch (err) {
      notificationsList.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }

  window.markRead = async function(id) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
      loadNotifications();
    } catch (err) {
      alert(err.message);
    }
  };

  markAllBtn?.addEventListener("click", async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PUT" });
      loadNotifications();
    } catch (err) {
      alert(err.message);
    }
  });

  loadNotifications();
});
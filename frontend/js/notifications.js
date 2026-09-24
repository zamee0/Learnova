document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("notifications");

  const list = document.getElementById("notificationsList");

  async function loadNotifs() {
    const notifs = await apiFetch("/notifications");
    if (!notifs.length) {
      list.innerHTML = "<p style='color:var(--gray-500); text-align:center;'>No notifications.</p>";
      return;
    }
    list.innerHTML = notifs.map(n => `
      <div class="card" style="margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center; background:${n.is_read ? 'var(--white)' : 'var(--primary-light)'}">
        <div>
          <strong>${n.title}</strong>
          <p style="font-size:0.85rem; color:var(--gray-700); margin:0.2rem 0;">${n.message}</p>
          ${n.type === 'friend_request' ? '<a class="btn btn-primary btn-sm" href="/friends.html">Review request</a>' : ''}
          <span style="font-size:0.75rem; color:var(--gray-500);">${formatDate(n.created_at)}</span>
        </div>
        ${!n.is_read ? `<button class="btn btn-outline btn-sm" onclick="markRead(${n.id})">Mark Read</button>` : ''}
      </div>
    `).join("");
  }

  window.markRead = async function(id) {
    await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
    loadNotifs();
    updateNotificationBadge();
  };

  document.getElementById("markAllBtn")?.addEventListener("click", async () => {
    await apiFetch("/notifications/read-all", { method: "PUT" });
    loadNotifs();
    updateNotificationBadge();
  });

  loadNotifs();
});

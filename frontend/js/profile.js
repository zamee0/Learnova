document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("profile");

  const profileCard = document.getElementById("profileCard");

  try {
    const profile = await apiFetch("/users/me");
    const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Learnova User";

    profileCard.innerHTML = `
      <div style="display:flex; align-items:center; gap:1.5rem; margin-bottom:2rem;">
        <div class="avatar" style="width:80px; height:80px; font-size:2rem;">${getInitials(fullName)}</div>
        <div>
          <h2 style="font-size:1.5rem; font-weight:700;">${fullName}</h2>
          <p style="color:var(--gray-500);">${profile.email}</p>
          <span class="badge badge-primary" style="margin-top:0.4rem;">${profile.role}</span>
        </div>
      </div>
      <div style="border-top:1px solid var(--border); padding-top:1.5rem;">
        <div class="form-group">
          <label class="form-label">Bio</label>
          <p style="color:var(--gray-700);">${profile.bio || 'No bio provided.'}</p>
        </div>
        <div class="form-group">
          <label class="form-label">Member Since</label>
          <p style="color:var(--gray-700);">${formatDate(profile.created_at)}</p>
        </div>
      </div>
    `;
  } catch (err) {
    profileCard.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
});
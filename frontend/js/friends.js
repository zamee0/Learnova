document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("friends");

  const friendsList = document.getElementById("friendsList");
  const requestsList = document.getElementById("requestsList");

  async function loadData() {
    const friends = await apiFetch("/friends");
    const requests = await apiFetch("/friends/requests");

    friendsList.innerHTML = friends.length ? friends.map(f => `
      <div class="card" style="margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong>${f.name}</strong> ${f.is_online ? '<span style="color:var(--success); font-size:0.8rem;">● Online</span>' : ''}
          <p style="font-size:0.8rem; color:var(--gray-500);">${f.email}</p>
        </div>
        <a href="/messages.html" class="btn btn-outline btn-sm"><i class="fa-solid fa-paper-plane"></i> Message</a>
      </div>
    `).join("") : "<p style='color:var(--gray-500);'>No friends added yet.</p>";

    requestsList.innerHTML = requests.length ? requests.map(r => `
      <div class="card" style="margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong>${r.sender_name}</strong>
          <p style="font-size:0.8rem; color:var(--gray-500);">${r.sender_email}</p>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn btn-primary btn-sm" onclick="respondReq(${r.id}, 'accepted')">Accept</button>
          <button class="btn btn-outline btn-sm btn-danger" onclick="respondReq(${r.id}, 'rejected')">Reject</button>
        </div>
      </div>
    `).join("") : "<p style='color:var(--gray-500);'>No pending requests.</p>";
  }

  window.respondReq = async function(reqId, status) {
    await apiFetch(`/friends/request/${reqId}`, { method: "PUT", body: JSON.stringify({ status }) });
    loadData();
  };

  loadData();
});

let communityTimer;
function searchCommunity(q) {
  clearTimeout(communityTimer);
  communityTimer = setTimeout(async () => {
    const box = document.getElementById('communityResults');
    if (!q.trim()) { box.innerHTML = ''; return; }
    try {
      const users = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`);
      box.innerHTML = users.map(u => `<article class="card" style="padding:.75rem;margin:.5rem 0"><a href="/community.html?id=${u.id}"><strong>${escapeHtml(u.name)}</strong></a><div>${escapeHtml(u.role)} · ${u.is_online ? 'Online' : 'Offline'}</div><button class="btn btn-primary btn-sm" onclick="addCommunityFriend(${u.id})">Add Friend</button></article>`).join('') || '<p>No matching people.</p>';
    } catch (err) { box.textContent = err.message; }
  }, 250);
}
async function addCommunityFriend(id) {
  try { await apiFetch('/friends/request', { method: 'POST', body: JSON.stringify({ receiver_id: id }) }); searchCommunity(document.getElementById('communitySearch').value); }
  catch (err) { alert(err.message); }
}

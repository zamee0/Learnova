document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("friends");

  const friendsList = document.getElementById("friendsList");
  const requestsList = document.getElementById("requestsList");
  const sendRequestForm = document.getElementById("sendRequestForm");

  async function loadFriends() {
    try {
      const friends = await apiFetch("/friends");
      if (!friends || friends.length === 0) {
        friendsList.innerHTML = `<p style="color:var(--gray-500);">You have not added any friends yet.</p>`;
      } else {
        friendsList.innerHTML = friends.map(f => `
          <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <div class="avatar">${getInitials(f.name || f.email)}</div>
              <div>
                <strong>${f.name || f.email}</strong>
                <p style="font-size:0.8rem; color:var(--gray-500);">${f.email || ''}</p>
              </div>
            </div>
            <a href="/messages.html" class="btn btn-outline btn-sm"><i class="fa-solid fa-message"></i> Message</a>
          </div>
        `).join("");
      }
    } catch (err) {
      friendsList.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }

  async function loadRequests() {
    try {
      const requests = await apiFetch("/friends/requests");
      if (!requests || requests.length === 0) {
        requestsList.innerHTML = `<p style="color:var(--gray-500);">No pending friend requests.</p>`;
      } else {
        requestsList.innerHTML = requests.map(r => `
          <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <div class="avatar">${getInitials(r.sender_name || 'U')}</div>
              <div>
                <strong>${r.sender_name || 'Learner'}</strong>
                <p style="font-size:0.8rem; color:var(--gray-500);">Sent you a request</p>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn-primary btn-sm" onclick="respondRequest(${r.id}, 'accepted')">Accept</button>
              <button class="btn btn-outline btn-sm btn-danger" onclick="respondRequest(${r.id}, 'rejected')">Reject</button>
            </div>
          </div>
        `).join("");
      }
    } catch (err) {
      requestsList.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }

  window.respondRequest = async function(requestId, status) {
    try {
      await apiFetch(`/friends/request/${requestId}`, {
        method: "PUT",
        body: JSON.stringify({ status })
      });
      loadRequests();
      loadFriends();
    } catch (err) {
      alert(err.message);
    }
  };

  sendRequestForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const receiverId = document.getElementById("receiverIdInput").value.trim();
    if (!receiverId) return;

    try {
      await apiFetch("/friends/request", {
        method: "POST",
        body: JSON.stringify({ receiver_id: receiverId })
      });
      alert("Friend request sent!");
      sendRequestForm.reset();
      loadRequests();
    } catch (err) {
      alert(err.message);
    }
  });

  loadFriends();
  loadRequests();
});
document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return;
  renderNavigation('friends');
  const id = new URLSearchParams(location.search).get('id');
  const card = document.getElementById('publicProfile');
  if (!id) { card.textContent = 'No profile selected.'; return; }
  try {
    const [u, relation] = await Promise.all([apiFetch(`/users/${id}`), apiFetch(`/friends/state/${id}`)]);
    let action = '';
    if (relation.state === 'NONE') action = `<button class="btn btn-primary" onclick="sendProfileRequest(${u.id})">Add Friend</button>`;
    if (relation.state === 'SENT') action = `<button class="btn btn-outline" onclick="cancelProfileRequest(${relation.request_id})">Cancel Request</button>`;
    if (relation.state === 'RECEIVED') action = `<button class="btn btn-primary" onclick="respondProfileRequest(${relation.request_id},'accepted')">Accept</button> <button class="btn btn-outline" onclick="respondProfileRequest(${relation.request_id},'rejected')">Reject</button>`;
    if (relation.state === 'ACCEPTED') action = `<button class="btn btn-outline" onclick="removeProfileFriend(${u.id})">Unfriend</button> <a class="btn btn-primary" href="/messages.html?id=${u.id}">Message</a>`;
    card.innerHTML = `<img src="${escapeHtml(u.avatar_url || '/images/default-avatar.svg')}" alt="" style="width:100px;height:100px;border-radius:50%;object-fit:cover"><h2>${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}</h2><p>${escapeHtml(u.role)}</p><p>${escapeHtml(u.bio || 'No bio yet.')}</p><h3>Mutual Connections</h3><p>${(u.mutual_connections || []).map(x => escapeHtml(x.name)).join(', ') || 'None yet.'}</p>${action}`;
  } catch (e) { card.textContent = e.message; }
});
async function sendProfileRequest(id) { await apiFetch('/friends/request', {method:'POST',body:JSON.stringify({receiver_id:id})}); location.reload(); }
async function cancelProfileRequest(id) { await apiFetch(`/friends/request/${id}`, {method:'DELETE'}); location.reload(); }
async function respondProfileRequest(id,status) { await apiFetch(`/friends/request/${id}`, {method:'PUT',body:JSON.stringify({status})}); location.reload(); }
async function removeProfileFriend(id) { await apiFetch(`/friends/${id}`, {method:'DELETE'}); location.reload(); }

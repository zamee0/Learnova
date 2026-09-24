document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("profile");
  await loadMyProfile();
  await loadProfileInsights();
});

async function loadMyProfile() {
  const u = await apiFetch("/users/me");
  document.getElementById("profFirst").value = u.first_name || '';
  document.getElementById("profLast").value = u.last_name || '';
  document.getElementById("profAvatar").value = u.avatar_url || '';
  document.getElementById("profQualifications").value = JSON.stringify(u.qualifications || [], null, 2);
  const preview = document.getElementById('avatarPreview');
  if (u.avatar_url) { preview.src = u.avatar_url; preview.style.display = 'block'; }
  document.getElementById("profBio").value = u.bio || '';
  document.getElementById("profPhone").value = u.phone || '';
  document.getElementById("profAddress").value = u.address || '';

  if (u.role === 'student') {
    document.getElementById("studentEditFields").style.display = "block";
    document.getElementById("profInstitution").value = u.institution || '';
    document.getElementById("profSemester").value = u.semester || '';
  } else if (u.role === 'teacher') {
    document.getElementById("studentEditFields").style.display = "none";
    document.getElementById("teacherEditFields").style.display = "block";
    document.getElementById("profDesignation").value = u.designation || '';
    document.getElementById("profQualification").value = u.qualification || '';
  }

  const c = document.getElementById("myProfileCard");
  c.innerHTML = `
    <div style="display:flex; gap:1.5rem; align-items:center; margin-bottom:1.5rem;">
      <img src="${u.avatar_url || '/images/default-avatar.svg'}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; border:2px solid var(--primary);">
      <div>
        <h2 style="font-size:1.5rem;">${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}</h2>
        <p style="color:var(--gray-500);">${escapeHtml(u.email)} • <span class="badge badge-primary">${escapeHtml(u.role)}</span></p>
        ${u.institution ? `<p style="font-size:0.85rem; color:var(--gray-700); margin-top:0.25rem;"><i class="fa-solid fa-building-columns"></i> ${escapeHtml(u.institution)} (${escapeHtml(u.semester || '')})</p>` : ''}
        ${u.designation ? `<p style="font-size:0.85rem; color:var(--gray-700); margin-top:0.25rem;"><i class="fa-solid fa-briefcase"></i> ${escapeHtml(u.designation)} - ${escapeHtml(u.qualification || '')}</p>` : ''}
      </div>
    </div>
    <p style="color:var(--gray-700); margin-bottom:1.5rem;">${escapeHtml(u.bio || 'No bio added yet. Click edit below to add one.')}</p>
    ${u.qualifications?.length ? `<h4>Qualifications</h4>${u.qualifications.map(q=>`<p>${escapeHtml(q.degree)} · ${escapeHtml(q.institute)} · ${escapeHtml(q.experience)} · ${escapeHtml(q.certifications)}</p>`).join('')}` : ''}

    <h4><i class="fa-solid fa-award"></i> Verified Course Checkpoints</h4>
    <div style="margin-top:0.5rem;">
      ${u.checkpoints && u.checkpoints.length ? u.checkpoints.map(cp => `
        <div style="background:var(--gray-50); padding:0.75rem; border-radius:6px; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
          <strong>${cp.course_title}</strong>
          <span class="badge badge-success">${cp.checkpoint_code}</span>
        </div>
      `).join("") : '<p style="color:var(--gray-500); font-size:0.85rem;">No completed course checkpoints yet.</p>'}
    </div>
  `;
}

async function loadProfileInsights() {
  const el = document.getElementById('profileChart');
  let data;
  try { data = await apiFetch('/dashboard/profile-stats'); }
  catch(err) { el.textContent=err.message; return; }
  if (!data.courses.length) { el.innerHTML = '<p>Join a course or publish your first course to see your insights here.</p>'; return; }
  if (data.role === 'student') {
    const done = data.metrics.completed, active = data.courses.length - done;
    const donePct = Math.round(done / data.courses.length * 100);
    el.innerHTML = `<div style="display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap"><div style="width:150px;height:150px;border-radius:50%;background:conic-gradient(var(--success) 0 ${donePct}%,var(--primary-light) ${donePct}% 100%)" role="img" aria-label="${done} completed and ${active} in progress"></div><div><p><strong>${data.metrics.courses}</strong> courses · <strong>${done}</strong> completed · <strong>${data.metrics.averageProgress}%</strong> average progress</p><p>Completion: ${done} · In progress: ${active}</p></div></div><div style="margin-top:1rem">${data.courses.map(c => `<div style="margin:.75rem 0"><div style="display:flex;justify-content:space-between"><strong>${escapeHtml(c.title)}</strong><span>${c.progress}%</span></div><progress max="100" value="${c.progress}" style="width:100%"></progress></div>`).join('')}</div>`;
  } else {
    const max = Math.max(1,...data.courses.map(c=>c.students));
    el.innerHTML = `<p><strong>${data.metrics.courses}</strong> courses · <strong>${data.metrics.students}</strong> enrolled students · <strong>${data.metrics.rating}</strong>/10 average rating</p>${data.courses.map(c => `<div style="margin:.75rem 0"><div style="display:flex;justify-content:space-between"><strong>${escapeHtml(c.title)}</strong><span>${c.students} students · ${c.rating}/10</span></div><div style="height:12px;background:var(--gray-100);border-radius:8px"><div style="height:100%;width:${Math.round(c.students/max*100)}%;background:var(--primary);border-radius:8px"></div></div></div>`).join('')}`;
  }
}

async function saveProfileUpdates(e) {
  e.preventDefault();
  const first_name = document.getElementById("profFirst").value;
  const last_name = document.getElementById("profLast").value;
  const avatar_url = document.getElementById("profAvatar").value;
  const bio = document.getElementById("profBio").value;
  const phone = document.getElementById("profPhone").value;
  const address = document.getElementById("profAddress").value;
  const institution = document.getElementById("profInstitution")?.value;
  const semester = document.getElementById("profSemester")?.value;
  const designation = document.getElementById("profDesignation")?.value;
  const qualification = document.getElementById("profQualification")?.value;
  let qualifications;
  try { qualifications = JSON.parse(document.getElementById('profQualifications')?.value || '[]'); }
  catch { alert('Qualifications must be a valid JSON array.'); return; }

  await apiFetch("/users/profile", {
    method: "PUT",
    body: JSON.stringify({ first_name, last_name, avatar_url, bio, phone, address, institution, semester, designation, qualification, qualifications })
  });
  const stored = getCurrentUser();
  localStorage.setItem('user', JSON.stringify({ ...stored, first_name, last_name, avatar_url }));
  alert("Profile updated successfully!");
  loadMyProfile();
}

function setProfileImage(file) {
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) { alert('Choose a JPEG, PNG, or WebP image under 4 MB.'); return; }
  const image = new Image();
  image.onload = () => {
    const side = Math.min(image.width, image.height), canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    canvas.getContext('2d').drawImage(image, (image.width-side)/2, (image.height-side)/2, side, side, 0, 0, 512, 512);
    const result = canvas.toDataURL('image/jpeg', .85);
    document.getElementById('profAvatar').value = result;
    const preview = document.getElementById('avatarPreview'); preview.src = result; preview.style.display = 'block';
    URL.revokeObjectURL(image.src);
  };
  image.src = URL.createObjectURL(file);
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('profAvatarFile')?.addEventListener('change', e => setProfileImage(e.target.files[0]));
  const drop = document.getElementById('avatarDrop');
  drop?.addEventListener('dragover', e => { e.preventDefault(); });
  drop?.addEventListener('drop', e => { e.preventDefault(); setProfileImage(e.dataTransfer.files[0]); });
});

let searchTimeout;
function handleUserSearch(query) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    if (!query.trim()) { document.getElementById("searchResultsList").innerHTML = ""; return; }
    const users = await apiFetch(`/users/search?q=${encodeURIComponent(query)}`);
    const c = document.getElementById("searchResultsList");
    if (!users.length) { c.innerHTML = "<p style='color:var(--gray-500); font-size:0.85rem;'>No users found.</p>"; return; }
    c.innerHTML = users.map(u => `
        <div class="card" style="padding:0.75rem; margin-bottom:0.75rem; cursor:pointer;" onclick="viewUserActivity(${u.id}, this.dataset.name)" data-name="${escapeHtml(u.name)}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${escapeHtml(u.name)}</strong>
          <span style="font-size:0.75rem; color:${u.is_online ? 'var(--success)' : 'var(--gray-500)'};">${u.is_online ? '● Online' : 'Offline'}</span>
        </div>
        <p style="font-size:0.8rem; color:var(--gray-500);">${escapeHtml(u.email)} (${escapeHtml(u.role)})</p>
        <div style="margin-top:0.4rem; font-size:0.75rem;">
          Enrolled: ${u.enrolled_courses.map(c => `<span class="badge badge-info">${escapeHtml(c.title)}</span>`).join(" ") || 'None'}
        </div>
      </div>
    `).join("");
  }, 300);
}

async function viewUserActivity(userId, name) {
  const logs = await apiFetch(`/users/${userId}/activity`);
  document.getElementById("userActivityCard").style.display = "block";
  document.getElementById("activityOwnerTitle").textContent = `${name}'s Activity Log`;
  const c = document.getElementById("activityLogFeed");
  if (!logs.length) { c.innerHTML = "<p style='color:var(--gray-500); font-size:0.85rem;'>No recorded activity.</p>"; return; }
  c.innerHTML = logs.map(l => `
    <div style="padding:0.6rem 0; border-bottom:1px solid var(--border); font-size:0.85rem;">
      <span class="badge badge-primary">${l.activity_type}</span>
      <p style="margin:0.25rem 0;">${l.description}</p>
      <span style="font-size:0.75rem; color:var(--gray-500);">${formatDate(l.created_at)}</span>
    </div>
  `).join("");
}

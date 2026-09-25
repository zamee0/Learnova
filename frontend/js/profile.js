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
  document.getElementById("profAvatar").value = u.avatar_url && !u.avatar_url.startsWith('data:image/') ? u.avatar_url : '';
  if (u.role === 'teacher') renderQualifications(u.qualifications?.length ? u.qualifications : (u.qualification ? [{ degree:u.qualification, institute:'', experience:'', certifications:'' }] : []));
  const preview = document.getElementById('avatarPreview');
  preview.src = u.avatar_url || '/images/default-avatar.svg'; preview.style.display = 'block';
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
  }

  const c = document.getElementById("myProfileCard");
  c.innerHTML = `
    <div class="profile-hero" style="margin-bottom:1rem;">
      <img src="${escapeHtml(u.avatar_url || '/images/default-avatar.svg')}" alt="${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)} profile picture">
      <div>
        <h2 style="font-size:1.5rem;">${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}</h2>
        <p style="color:var(--gray-500);">${escapeHtml(u.email)} • <span class="badge badge-primary">${escapeHtml(u.role)}</span></p>
        ${u.institution ? `<p style="font-size:0.85rem; color:var(--gray-700); margin-top:0.25rem;"><i class="fa-solid fa-building-columns"></i> ${escapeHtml(u.institution)} (${escapeHtml(u.semester || '')})</p>` : ''}
        ${u.designation ? `<p style="font-size:0.85rem; color:var(--gray-700); margin-top:0.25rem;"><i class="fa-solid fa-briefcase"></i> ${escapeHtml(u.designation)} - ${escapeHtml(u.qualification || '')}</p>` : ''}
      </div>
    </div>
    <p style="color:var(--gray-700); margin-bottom:1.5rem;">${escapeHtml(u.bio || 'No bio added yet. Click edit below to add one.')}</p>
    ${u.qualifications?.length ? `<h4 style="margin:.8rem 0 .4rem">Qualifications</h4><div class="qualification-list">${u.qualifications.map(q=>`<p><strong>${escapeHtml(q.degree)}</strong> - ${escapeHtml(q.institute)}<br><small>${escapeHtml(q.experience)} · ${escapeHtml(q.certifications)}</small></p>`).join('')}</div>` : ''}

    <h4><i class="fa-solid fa-award"></i> Verified Course Checkpoints</h4>
    <div style="margin-top:0.5rem;">
      ${u.checkpoints && u.checkpoints.length ? u.checkpoints.map(cp => `
        <div style="background:var(--gray-50); padding:0.75rem; border-radius:6px; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
          <strong>${escapeHtml(cp.course_title)}</strong>
          <span class="badge badge-success">${escapeHtml(cp.checkpoint_code)}</span>
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
  const status = document.getElementById('profileSaveStatus'), button = document.getElementById('saveProfileButton');
  const current = getCurrentUser();
  const first_name = document.getElementById("profFirst").value.trim(), last_name = document.getElementById("profLast").value.trim();
  const avatar_url = document.getElementById("profAvatar").value.trim() || null, bio = document.getElementById("profBio").value.trim();
  const phone = document.getElementById("profPhone").value.trim(), address = document.getElementById("profAddress").value.trim();
  const institution = document.getElementById("profInstitution")?.value.trim(), semester = document.getElementById("profSemester")?.value.trim();
  const designation = document.getElementById("profDesignation")?.value.trim();
  const qualifications = current?.role === 'teacher' ? [...document.querySelectorAll('.qualification-row')].map(row => Object.fromEntries([...row.querySelectorAll('[data-qualification]')].map(input => [input.dataset.qualification, input.value.trim()]))) : undefined;
  const qualification = qualifications?.[0]?.degree;
  if (!first_name || !last_name) { status.textContent = 'Enter your first and last name.'; return; }
  if (current?.role === 'teacher' && (!qualifications.length || qualifications.some(q => ['degree','institute','experience'].some(key => !q[key]) || Object.values(q).some(v => v.length > 250)))) { status.textContent = 'Add a qualification and complete its degree, institute, and experience.'; return; }
  button.disabled = true; status.textContent = 'Saving...';
  try {
    const saved = await apiFetch("/users/profile", { method: "PUT", body: JSON.stringify({ first_name, last_name, avatar_url, bio, phone, address, institution, semester, designation, qualification, qualifications }) });
    const stored = getCurrentUser();
    localStorage.setItem('user', JSON.stringify({ ...stored, first_name, last_name, avatar_url:saved.user.avatar_url }));
    document.querySelectorAll('.current-user-avatar img').forEach(img => { img.src = saved.user.avatar_url || '/images/default-avatar.svg'; });
    status.textContent = 'Profile saved.';
    await loadMyProfile();
  } catch (err) { status.textContent = err.message; }
  finally { button.disabled = false; }
}

function renderQualifications(items = []) {
  const list = document.getElementById('qualificationRows');
  list.replaceChildren();
  if (!items.length) addQualificationRow();
  else items.forEach(addQualificationRow);
}

function addQualificationRow(value = {}) {
  const row = document.createElement('fieldset');
  row.className = 'qualification-row';
  const legend = document.createElement('legend'); legend.textContent = 'Qualification'; row.append(legend);
  const fields = [['degree','Degree'],['institute','Institute'],['experience','Experience'],['certifications','Certifications']];
  fields.forEach(([key,label]) => {
    const group=document.createElement('div'); group.className='form-group';
    const caption=document.createElement('label'); caption.className='form-label'; caption.textContent=label;
    const input=document.createElement(key === 'certifications' ? 'textarea' : 'input');
    if (input.tagName === 'TEXTAREA') input.rows=2;
    input.className='form-control'; input.required=key !== 'certifications'; input.maxLength=250; input.dataset.qualification=key; input.value=value[key] || '';
    input.id=`qualification-${document.querySelectorAll('.qualification-row').length}-${key}-${row.children.length}`; caption.htmlFor=input.id;
    group.append(caption,input); row.append(group);
  });
  const remove=document.createElement('button'); remove.type='button'; remove.className='btn btn-outline btn-sm'; remove.textContent='Remove'; remove.addEventListener('click',()=>row.remove());
  row.append(remove); document.getElementById('qualificationRows').append(row);
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
  image.onerror = () => { URL.revokeObjectURL(image.src); alert('That image could not be opened.'); };
  image.src = URL.createObjectURL(file);
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('profAvatarFile')?.addEventListener('change', e => setProfileImage(e.target.files[0]));
  document.getElementById('profAvatar')?.addEventListener('input', e => {
    const value=e.target.value.trim(), preview=document.getElementById('avatarPreview');
    if (value && /^https?:\/\//i.test(value)) { preview.src=value; preview.style.display='block'; }
  });
  const drop = document.getElementById('avatarDrop');
  const input = document.getElementById('profAvatarFile');
  drop?.addEventListener('click', e => { if (e.target === drop || e.target.closest('strong, span, i, small')) input.click(); });
  drop?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  drop?.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-active'); });
  drop?.addEventListener('dragleave', () => drop.classList.remove('drag-active'));
  drop?.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag-active'); setProfileImage(e.dataTransfer.files[0]); });
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

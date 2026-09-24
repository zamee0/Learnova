document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth('admin')) return;
  renderNavigation('admin');
  try {
    const data = await apiFetch('/admin/dashboard');
    const m = data.metrics;
    document.getElementById('adminMetrics').innerHTML = [['Users',m.total_users],['Students',m.total_students],['Teachers',m.total_teachers],['Courses',m.total_courses],['Enrollments',m.total_enrollments],['Active now',m.active_now]].map(([label,value]) => `<article class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></article>`).join('');
    document.getElementById('adminUsers').innerHTML = `<table style="width:100%"><tr><th>User</th><th>Role</th><th>State</th><th></th></tr>${data.recentUsers.map(u => `<tr><td>${escapeHtml(u.name)} · ${escapeHtml(u.email)}</td><td>${escapeHtml(u.role)}</td><td>${u.is_active ? 'Active' : 'Suspended'}</td><td>${u.role === 'admin' ? '' : `<button class="btn btn-outline btn-sm" onclick="setUserState(${u.id},${!u.is_active})">${u.is_active ? 'Suspend' : 'Restore'}</button>`}</td></tr>`).join('')}</table>`;
    document.getElementById('adminCourses').innerHTML = data.recentCourses.map(c => `<div style="display:flex;justify-content:space-between;padding:.7rem;border-bottom:1px solid var(--border)"><span>${escapeHtml(c.title)} · ${escapeHtml(c.teacher_name)}</span><button class="btn btn-outline btn-sm btn-danger" onclick="removeAdminCourse(${c.id})">Remove</button></div>`).join('') || 'No courses yet.';
  } catch (e) { document.getElementById('adminMetrics').textContent = e.message; }
});
async function setUserState(id,is_active) { await apiFetch(`/admin/users/${id}/status`,{method:'PUT',body:JSON.stringify({is_active})}); location.reload(); }
async function removeAdminCourse(id) { if(confirm('Remove this course and its course data?')) { await apiFetch(`/admin/courses/${id}`,{method:'DELETE'}); location.reload(); } }

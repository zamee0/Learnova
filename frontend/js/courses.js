document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("courses");

  const grid = document.getElementById("coursesGrid");
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const levelFilter = document.getElementById("levelFilter");

  let courses = [];

  async function loadCourses() {
    try {
      courses = await apiFetch("/courses");
      render();
    } catch (err) {
      grid.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }

  function render() {
    const search = (searchInput?.value || "").toLowerCase();
    const cat = categoryFilter?.value || "";
    const lvl = levelFilter?.value || "";

    const filtered = courses.filter(c => {
      const matchS = (c.title || "").toLowerCase().includes(search) || (c.description || "").toLowerCase().includes(search);
      const matchC = !cat || c.category === cat;
      const matchL = !lvl || c.level === lvl;
      return matchS && matchC && matchL;
    });

    if (!filtered.length) {
      grid.innerHTML = `<p style="color:var(--gray-500); grid-column:1/-1; text-align:center;">No courses found matching your criteria.</p>`;
      return;
    }

    grid.innerHTML = filtered.map(c => `
      <div class="course-card">
        <img class="course-thumb" src="${c.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800'}" alt="${c.title}">
        <div class="course-content">
          <div class="course-meta">
            <span class="badge badge-primary">${c.category}</span>
            <span class="badge badge-info">${c.level}</span>
          </div>
          <h3 class="course-title">${c.title}</h3>
          <p class="course-desc">${c.description}</p>
          <div class="course-footer">
            <span style="font-size:0.85rem; color:var(--gray-500);"><i class="fa-solid fa-star" style="color:var(--warning);"></i> ${c.avg_rating || '0.0'} (${c.review_count || 0})</span>

            <div style="display:flex; gap:0.5rem;">
              ${user.role === 'student' && !c.is_enrolled ? `
                <button class="btn btn-primary btn-sm" onclick="directJoinCourse(${c.id})"><i class="fa-solid fa-plus"></i> Join Course</button>
              ` : ''}
              <a href="/course.html?id=${c.id}" class="btn ${c.is_enrolled ? 'btn-primary' : 'btn-outline'} btn-sm">
                ${c.is_enrolled ? 'Enter Workspace' : 'Details'}
              </a>
            </div>
          </div>
        </div>
      </div>
    `).join("");
  }

  window.directJoinCourse = async function(courseId) {
    try {
      await apiFetch("/enrollments", { method: "POST", body: JSON.stringify({ course_id: courseId }) });
      alert("🎉 Successfully enrolled in course!");
      loadCourses();
    } catch (err) {
      alert(err.message);
    }
  };

  searchInput?.addEventListener("input", render);
  categoryFilter?.addEventListener("change", render);
  levelFilter?.addEventListener("change", render);

  loadCourses();
});

document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("courses");

  const coursesGrid = document.getElementById("coursesGrid");
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const levelFilter = document.getElementById("levelFilter");

  let allCourses = [];

  async function loadCourses() {
    try {
      coursesGrid.innerHTML = `<div class="state-container"><div class="spinner"></div><p>Loading courses...</p></div>`;
      const data = await apiFetch("/courses");
      allCourses = Array.isArray(data) ? data : (data.courses || []);
      renderCourses();
    } catch (err) {
      coursesGrid.innerHTML = `<div class="alert alert-danger">Failed to load courses: ${err.message}</div>`;
    }
  }

  function renderCourses() {
    const search = (searchInput?.value || "").toLowerCase();
    const category = categoryFilter?.value || "";
    const level = levelFilter?.value || "";

    const filtered = allCourses.filter(c => {
      const matchSearch = (c.title || "").toLowerCase().includes(search) || (c.description || "").toLowerCase().includes(search);
      const matchCategory = !category || c.category === category;
      const matchLevel = !level || c.level === level;
      return matchSearch && matchCategory && matchLevel;
    });

    if (filtered.length === 0) {
      coursesGrid.innerHTML = `
        <div class="state-container" style="grid-column: 1/-1;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <p>No courses found matching your criteria</p>
        </div>`;
      return;
    }

    coursesGrid.innerHTML = filtered.map(c => `
      <div class="course-card">
        <img class="course-thumb" src="${c.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop'}" alt="${c.title}" onerror="this.src='https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop'">
        <div class="course-content">
          <div class="course-meta">
            <span class="badge badge-primary">${c.category || 'General'}</span>
            <span class="badge badge-info">${c.level || 'All Levels'}</span>
          </div>
          <h3 class="course-title">${c.title}</h3>
          <p class="course-desc">${c.description || ''}</p>
          <div class="course-footer">
            <span style="font-size:0.85rem; color:var(--gray-500);"><i class="fa-solid fa-user-tie"></i> ${c.teacher_name || 'Instructor'}</span>
            <a href="/course.html?id=${c.id}" class="btn btn-primary btn-sm">View Course</a>
          </div>
        </div>
      </div>
    `).join("");
  }

  searchInput?.addEventListener("input", renderCourses);
  categoryFilter?.addEventListener("change", renderCourses);
  levelFilter?.addEventListener("change", renderCourses);

  loadCourses();
});
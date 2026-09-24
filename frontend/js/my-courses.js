document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("my-courses");

  const grid = document.getElementById("myCoursesGrid");
  const isTeacher = user.role === "teacher";

  async function loadCourses() {
    try {
      const endpoint = isTeacher ? "/courses/teaching" : "/courses/my-courses";
      const courses = await apiFetch(endpoint);

      if (!courses.length) {
        grid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:3rem 0; color:var(--gray-500);">
            <i class="fa-solid fa-graduation-cap" style="font-size:3rem; margin-bottom:1rem;"></i>
            <p>${isTeacher ? 'You have not created any courses yet.' : 'You are not enrolled in any courses yet.'}</p>
            <a href="${isTeacher ? '/teacher-course.html' : '/courses.html'}" class="btn btn-primary" style="margin-top:1rem;">
              ${isTeacher ? 'Create Course' : 'Browse Courses'}
            </a>
          </div>
        `;
        return;
      }

      grid.innerHTML = courses.map(c => `
        <div class="course-card">
          <img class="course-thumb" src="${c.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800'}" alt="${c.title}">
          <div class="course-content">
            <div class="course-meta">
              <span class="badge badge-primary">${c.category}</span>
              ${!isTeacher && c.checkpoint_code ? '<span class="badge badge-success"><i class="fa-solid fa-award"></i> Completed</span>' : ''}
            </div>
            <h3 class="course-title">${c.title}</h3>
            <p class="course-desc">${c.description}</p>
            <div class="course-footer">
              <a href="/course.html?id=${c.id || c.course_id}" class="btn btn-primary btn-sm">Enter Course Workspace</a>
              ${!isTeacher ? `
                <button class="btn btn-outline btn-sm btn-danger" onclick="dropCourse(${c.id || c.course_id})">Unenroll</button>
              ` : ''}
            </div>
          </div>
        </div>
      `).join("");
    } catch (err) {
      grid.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }

  window.dropCourse = async function(courseId) {
    if (!confirm("Are you sure you want to unenroll from this course?")) return;
    try {
      await apiFetch(`/enrollments/${courseId}`, { method: "DELETE" });
      loadCourses();
    } catch (err) { alert(err.message); }
  };

  loadCourses();
});

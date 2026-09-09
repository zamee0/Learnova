document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("my-courses");

  const myCoursesGrid = document.getElementById("myCoursesGrid");
  const isTeacher = user.role === "teacher";

  async function loadMyCourses() {
    try {
      myCoursesGrid.innerHTML = `<div class="state-container"><div class="spinner"></div><p>Loading your courses...</p></div>`;
      const endpoint = isTeacher ? "/courses/teaching" : "/courses/my-courses";
      const courses = await apiFetch(endpoint);

      if (!courses || courses.length === 0) {
        myCoursesGrid.innerHTML = `
          <div class="state-container" style="grid-column: 1/-1;">
            <i class="fa-solid fa-graduation-cap"></i>
            <p>${isTeacher ? 'You have not created any courses yet.' : 'You are not enrolled in any courses yet.'}</p>
            <a href="${isTeacher ? '/teacher-course.html' : '/courses.html'}" class="btn btn-primary" style="margin-top:1rem;">
              ${isTeacher ? 'Create a Course' : 'Browse Courses'}
            </a>
          </div>`;
        return;
      }

      myCoursesGrid.innerHTML = courses.map(c => `
        <div class="course-card">
          <img class="course-thumb" src="${c.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop'}" alt="${c.title}">
          <div class="course-content">
            <div class="course-meta">
              <span class="badge badge-primary">${c.category || 'General'}</span>
              <span class="badge badge-info">${c.level || 'All Levels'}</span>
            </div>
            <h3 class="course-title">${c.title}</h3>
            <p class="course-desc">${c.description || ''}</p>
            <div class="course-footer">
              <a href="/course.html?id=${c.id || c.course_id}" class="btn btn-primary btn-sm">Open Course</a>
              ${!isTeacher ? `
                <button class="btn btn-outline btn-sm btn-danger" onclick="unenrollCourse(${c.enrollment_id || c.id})">
                  <i class="fa-solid fa-arrow-right-from-bracket"></i> Unenroll
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `).join("");
    } catch (err) {
      myCoursesGrid.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  }

  window.unenrollCourse = async function(enrollmentId) {
    if (!confirm("Are you sure you want to unenroll from this course?")) return;
    try {
      await apiFetch(`/enrollments/${enrollmentId}`, { method: "DELETE" });
      loadMyCourses();
    } catch (err) {
      alert(err.message);
    }
  };

  loadMyCourses();
});
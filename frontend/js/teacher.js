document.addEventListener("DOMContentLoaded", () => {
  const user = checkAuth("teacher");
  if (!user) return;
  renderNavigation("teacher-course");

  const createCourseForm = document.getElementById("createCourseForm");
  const createAnnouncementForm = document.getElementById("createAnnouncementForm");
  const teacherCourseSelect = document.getElementById("teacherCourseSelect");

  async function populateTeacherCourses() {
    if (!teacherCourseSelect) return;
    try {
      const courses = await apiFetch("/courses/teaching");
      teacherCourseSelect.innerHTML = courses.map(c => `
        <option value="${c.id}">${c.title}</option>
      `).join("");
    } catch (err) {
      console.error(err);
    }
  }

  if (createCourseForm) {
    createCourseForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("title").value.trim();
      const description = document.getElementById("description").value.trim();
      const category = document.getElementById("category").value;
      const level = document.getElementById("level").value;
      const thumbnail_url = document.getElementById("thumbnail_url").value.trim();

      const btn = createCourseForm.querySelector("button[type='submit']");
      btn.disabled = true;

      try {
        await apiFetch("/courses", {
          method: "POST",
          body: JSON.stringify({ title, description, category, level, thumbnail_url })
        });
        alert("Course created successfully!");
        window.location.href = "/my-courses.html";
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
      }
    });
  }

  if (createAnnouncementForm) {
    createAnnouncementForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const course_id = teacherCourseSelect.value;
      const title = document.getElementById("announcementTitle").value.trim();
      const content = document.getElementById("announcementContent").value.trim();

      try {
        await apiFetch("/announcements", {
          method: "POST",
          body: JSON.stringify({ course_id, title, content })
        });
        alert("Announcement posted!");
        createAnnouncementForm.reset();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  populateTeacherCourses();
});
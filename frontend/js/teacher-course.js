document.addEventListener("DOMContentLoaded", () => {
  const user = checkAuth("teacher");
  if (!user) return;
  renderNavigation("teacher-course");

  const announcementForm = document.getElementById("createAnnouncementForm");
  const courseSelect = document.getElementById("teacherCourseSelect");
  const announcementButton = announcementForm?.querySelector("button[type='submit']");

  async function loadAnnouncementCourses() {
    if (!courseSelect) return;
    courseSelect.disabled = true;
    courseSelect.replaceChildren(new Option("Loading your courses...", ""));
    try {
      const courses = await apiFetch("/courses/teaching");
      courseSelect.replaceChildren(new Option(
        courses.length ? "Select a course" : "Create a course before posting an announcement",
        ""
      ));
      for (const course of courses) {
        courseSelect.add(new Option(course.title, String(course.id)));
      }
      courseSelect.disabled = courses.length === 0;
    } catch (err) {
      courseSelect.replaceChildren(new Option(`Could not load courses: ${err.message}`, ""));
      courseSelect.disabled = true;
    }
  }

  loadAnnouncementCourses();

  announcementForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const course_id = Number(courseSelect?.value);
    const title = document.getElementById("announcementTitle").value.trim();
    const content = document.getElementById("announcementContent").value.trim();
    if (!Number.isInteger(course_id) || course_id <= 0 || !title || !content) {
      alert("Select a course and enter an announcement title and content.");
      return;
    }

    announcementButton.disabled = true;
    try {
      await apiFetch("/announcements", {
        method: "POST",
        body: JSON.stringify({ course_id, title, content })
      });
      alert("Announcement posted successfully!");
      announcementForm.reset();
      courseSelect.value = "";
    } catch (err) {
      alert(err.message);
    } finally {
      announcementButton.disabled = false;
    }
  });

  const form = document.getElementById("createCourseForm");
  const save = async (is_published) => {
      const title = document.getElementById("title").value.trim();
      const description = document.getElementById("description").value.trim();
      const category = document.getElementById("category").value;
      const level = document.getElementById("level").value;
      const thumbnail_url = document.getElementById("thumbnail_url").value.trim();
      if (!title || !description || !category) return alert("Title, description, and category are required.");
      await apiFetch("/courses/create", { method: "POST", body: JSON.stringify({ title, description, category, level, thumbnail_url, is_published }) });
      alert(is_published ? "Course published successfully!" : "Draft saved successfully!");
      window.location.href = "/my-courses.html";
  };
  document.getElementById("saveDraftBtn")?.addEventListener("click", () => save(false).catch(err => alert(err.message)));
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type='submit']");
      btn.disabled = true;
      btn.textContent = "Publishing...";

      try {
        await save(true);
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "Publish Course";
      }
    });
  }
});

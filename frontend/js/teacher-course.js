document.addEventListener("DOMContentLoaded", () => {
  const user = checkAuth("teacher");
  if (!user) return;
  renderNavigation("teacher-course");

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

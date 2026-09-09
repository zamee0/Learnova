document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("courses");

  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get("id");

  if (!courseId) {
    window.location.href = "/courses.html";
    return;
  }

  const courseDetailsEl = document.getElementById("courseDetails");
  const announcementsList = document.getElementById("announcementsList");
  const discussionsList = document.getElementById("discussionsList");
  const enrollBtn = document.getElementById("enrollBtn");
  const newDiscussionForm = document.getElementById("newDiscussionForm");

  async function loadCourse() {
    try {
      const course = await apiFetch(`/courses/${courseId}`);
      document.getElementById("courseTitle").textContent = course.title;
      document.getElementById("courseDesc").textContent = course.description || "No description provided.";
      document.getElementById("courseCategory").textContent = course.category || "General";
      document.getElementById("courseLevel").textContent = course.level || "Beginner";
      document.getElementById("courseTeacher").textContent = course.teacher_name || "Instructor";

      if (user.role === "student") {
        enrollBtn.style.display = "inline-flex";
        enrollBtn.onclick = async () => {
          try {
            enrollBtn.disabled = true;
            await apiFetch("/enrollments", {
              method: "POST",
              body: JSON.stringify({ course_id: courseId })
            });
            alert("Enrolled successfully!");
            window.location.href = "/my-courses.html";
          } catch (err) {
            alert(err.message);
          } finally {
            enrollBtn.disabled = false;
          }
        };
      } else {
        enrollBtn.style.display = "none";
      }

      loadAnnouncements();
      loadDiscussions();
    } catch (err) {
      courseDetailsEl.innerHTML = `<div class="alert alert-danger">Error loading course: ${err.message}</div>`;
    }
  }

  async function loadAnnouncements() {
    try {
      const data = await apiFetch(`/announcements/course/${courseId}`);
      if (!data || data.length === 0) {
        announcementsList.innerHTML = `<p style="color:var(--gray-500);">No announcements yet for this course.</p>`;
      } else {
        announcementsList.innerHTML = data.map(a => `
          <div class="card" style="margin-bottom:1rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
              <strong>${a.title}</strong>
              <span class="badge badge-info">${formatDate(a.created_at)}</span>
            </div>
            <p style="font-size:0.9rem; color:var(--gray-700);">${a.content}</p>
          </div>
        `).join("");
      }
    } catch (err) {
      announcementsList.innerHTML = `<p class="alert alert-danger">${err.message}</p>`;
    }
  }

  async function loadDiscussions() {
    try {
      const discussions = await apiFetch(`/discussions/course/${courseId}`);
      if (!discussions || discussions.length === 0) {
        discussionsList.innerHTML = `<p style="color:var(--gray-500);">No discussions yet. Start one below!</p>`;
      } else {
        discussionsList.innerHTML = discussions.map(d => `
          <div class="card" style="margin-bottom:1rem;">
            <h4 style="font-weight:600; margin-bottom:0.3rem;">${d.title}</h4>
            <p style="font-size:0.9rem; color:var(--gray-700); margin-bottom:0.75rem;">${d.content}</p>
            <div style="font-size:0.8rem; color:var(--gray-500); display:flex; justify-content:space-between;">
              <span>By ${d.author_name || 'Student'} • ${formatDate(d.created_at)}</span>
              <button class="btn btn-outline btn-sm" onclick="toggleReplies(${d.id})"><i class="fa-solid fa-reply"></i> Replies</button>
            </div>
            <div id="replies-${d.id}" style="display:none; margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border);"></div>
          </div>
        `).join("");
      }
    } catch (err) {
      discussionsList.innerHTML = `<p class="alert alert-danger">${err.message}</p>`;
    }
  }

  window.toggleReplies = async function(discId) {
    const el = document.getElementById(`replies-${discId}`);
    if (el.style.display === "block") {
      el.style.display = "none";
      return;
    }

    el.style.display = "block";
    el.innerHTML = `<div class="spinner"></div>`;

    try {
      const replies = await apiFetch(`/discussions/${discId}/replies`);
      el.innerHTML = `
        <div style="margin-bottom:1rem;">
          ${replies.map(r => `
            <div style="background:var(--gray-50); padding:0.65rem 0.9rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; font-size:0.85rem;">
              <strong>${r.author_name || 'User'}:</strong> ${r.content}
            </div>
          `).join("")}
        </div>
        <form onsubmit="postReply(event, ${discId})" style="display:flex; gap:0.5rem;">
          <input type="text" id="replyInput-${discId}" class="form-control" placeholder="Write a reply..." required>
          <button type="submit" class="btn btn-primary btn-sm">Send</button>
        </form>
      `;
    } catch (err) {
      el.innerHTML = `<p class="alert alert-danger">${err.message}</p>`;
    }
  };

  window.postReply = async function(e, discId) {
    e.preventDefault();
    const input = document.getElementById(`replyInput-${discId}`);
    const content = input.value.trim();
    if (!content) return;

    try {
      await apiFetch(`/discussions/${discId}/replies`, {
        method: "POST",
        body: JSON.stringify({ content })
      });
      toggleReplies(discId); // Reload replies
    } catch (err) {
      alert(err.message);
    }
  };

  newDiscussionForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("discussionTitle").value.trim();
    const content = document.getElementById("discussionContent").value.trim();

    try {
      await apiFetch("/discussions", {
        method: "POST",
        body: JSON.stringify({ course_id: courseId, title, content })
      });
      newDiscussionForm.reset();
      loadDiscussions();
    } catch (err) {
      alert(err.message);
    }
  });

  loadCourse();
});
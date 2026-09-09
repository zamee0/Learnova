document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("discussions");

  const discussionCourseSelect = document.getElementById("discussionCourseSelect");
  const discussionHubForm = document.getElementById("discussionHubForm");
  const discussionsFeed = document.getElementById("discussionsFeed");

  async function populateCoursesDropdown() {
    try {
      const endpoint = user.role === "teacher" ? "/courses/teaching" : "/courses/my-courses";
      const courses = await apiFetch(endpoint);

      if (!courses || courses.length === 0) {
        discussionCourseSelect.innerHTML = `<option value="">No enrolled or teaching courses available</option>`;
        return;
      }

      discussionCourseSelect.innerHTML = courses.map(c => `
        <option value="${c.id || c.course_id}">${c.title}</option>
      `).join("");
    } catch (err) {
      console.error(err);
    }
  }

  async function loadDiscussions() {
    try {
      discussionsFeed.innerHTML = `<div class="state-container"><div class="spinner"></div><p>Loading discussions...</p></div>`;
      const discussions = await apiFetch("/discussions/my-discussions");

      if (!discussions || discussions.length === 0) {
        discussionsFeed.innerHTML = `
          <div class="state-container">
            <i class="fa-regular fa-comments"></i>
            <p>No discussions found in your active courses.</p>
          </div>`;
        return;
      }

      discussionsFeed.innerHTML = discussions.map(d => `
        <div class="card" style="margin-bottom:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
            <div>
              <span class="badge badge-primary">${d.course_title}</span>
              <h4 style="font-size:1.15rem; font-weight:600; margin-top:0.4rem;">${d.title}</h4>
            </div>
            <span style="font-size:0.8rem; color:var(--gray-500);">${formatDate(d.created_at)}</span>
          </div>

          <p style="color:var(--gray-700); font-size:0.95rem; margin-bottom:1rem; line-height:1.5;">${d.content}</p>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:0.75rem;">
            <span style="font-size:0.85rem; color:var(--gray-500);">
              <i class="fa-solid fa-user"></i> <strong>${d.author_name}</strong> (${d.author_role})
            </span>
            <button class="btn btn-outline btn-sm" onclick="toggleReplies(${d.id})">
              <i class="fa-solid fa-reply"></i> ${d.reply_count || 0} Replies
            </button>
          </div>

          <div id="replies-${d.id}" style="display:none; margin-top:1rem; padding-top:1rem; border-top:1px dashed var(--border);"></div>
        </div>
      `).join("");
    } catch (err) {
      discussionsFeed.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
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
          ${replies.length === 0 ? '<p style="font-size:0.85rem; color:var(--gray-500);">No replies yet. Be the first to answer!</p>' : ''}
          ${replies.map(r => `
            <div style="background:var(--gray-50); padding:0.75rem 1rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; font-size:0.9rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                <strong style="color:var(--primary);">${r.author_name} <span style="font-size:0.75rem; text-transform:uppercase; color:var(--gray-500);">(${r.author_role})</span>:</strong>
                <span style="font-size:0.75rem; color:var(--gray-500);">${formatDate(r.created_at)}</span>
              </div>
              <div style="color:var(--gray-900);">${r.content}</div>
            </div>
          `).join("")}
        </div>
        <form onsubmit="postReply(event, ${discId})" style="display:flex; gap:0.5rem;">
          <input type="text" id="replyInput-${discId}" class="form-control" placeholder="Write an answer..." required>
          <button type="submit" class="btn btn-primary btn-sm">Reply</button>
        </form>
      `;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
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
      toggleReplies(discId); // Refresh replies
    } catch (err) {
      alert(err.message);
    }
  };

  discussionHubForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const course_id = discussionCourseSelect.value;
    const title = document.getElementById("hubDiscTitle").value.trim();
    const content = document.getElementById("hubDiscContent").value.trim();

    if (!course_id) {
      alert("Please select a course first.");
      return;
    }

    try {
      await apiFetch("/discussions", {
        method: "POST",
        body: JSON.stringify({ course_id, title, content })
      });
      discussionHubForm.reset();
      loadDiscussions();
    } catch (err) {
      alert(err.message);
    }
  });

  populateCoursesDropdown();
  loadDiscussions();
});
document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth();
  if (!user) return;
  renderNavigation("discussions");

  const select = document.getElementById("discussionCourseSelect");
  const form = document.getElementById("discussionHubForm");
  const feed = document.getElementById("discussionsFeed");

  async function populateCourses() {
    const endpoint = user.role === "teacher" ? "/courses/teaching" : "/courses/my-courses";
    const courses = await apiFetch(endpoint);
    if (!courses.length) {
      select.innerHTML = "<option value=''>No active courses</option>";
      return;
    }
    select.innerHTML = courses.map(c => `<option value="${c.id || c.course_id}">${c.title}</option>`).join("");
  }

  async function loadDiscussions() {
    const discs = await apiFetch("/discussions/my-discussions");
    if (!discs.length) {
      feed.innerHTML = "<p style='color:var(--gray-500);'>No discussions in your active courses.</p>";
      return;
    }
    feed.innerHTML = discs.map(d => `
      <div class="card" style="margin-bottom:1.5rem;">
        <div style="display:flex; justify-content:space-between;">
          <span class="badge badge-primary">${d.course_title}</span>
          <span style="font-size:0.8rem; color:var(--gray-500);">${formatDate(d.created_at)}</span>
        </div>
        <h4 style="font-size:1.15rem; font-weight:600; margin:0.5rem 0;">${d.title}</h4>
        <p style="color:var(--gray-700);">${d.content}</p>
        <div style="border-top:1px solid var(--border); margin-top:0.75rem; padding-top:0.75rem; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.85rem; color:var(--gray-500);">By <strong>${d.author_name}</strong> (${d.author_role})</span>
          <button class="btn btn-outline btn-sm" onclick="toggleReplies(${d.id})"><i class="fa-solid fa-reply"></i> ${d.reply_count} Replies</button>
        </div>
        <div id="replies-${d.id}" style="display:none; margin-top:1rem; border-top:1px dashed var(--border); padding-top:1rem;"></div>
      </div>
    `).join("");
  }

  window.toggleReplies = async function(discId) {
    const el = document.getElementById(`replies-${discId}`);
    if (el.style.display === "block") { el.style.display = "none"; return; }
    el.style.display = "block";
    el.innerHTML = "Loading replies...";

    const replies = await apiFetch(`/discussions/${discId}/replies`);
    el.innerHTML = `
      <div style="margin-bottom:1rem;">
        ${replies.map(r => `
          <div style="background:var(--gray-50); padding:0.6rem 0.9rem; border-radius:6px; margin-bottom:0.5rem; font-size:0.9rem;">
            <strong>${r.author_name} (${r.author_role}):</strong> ${r.content}
            <div style="font-size:0.75rem; color:var(--gray-500); margin-top:0.2rem;">${formatDate(r.created_at)}</div>
          </div>
        `).join("")}
      </div>
      <form onsubmit="postReply(event, ${discId})" style="display:flex; gap:0.5rem;">
        <input type="text" id="replyInput-${discId}" class="form-control" placeholder="Write a reply..." required>
        <button type="submit" class="btn btn-primary btn-sm">Send</button>
      </form>
    `;
  };

  window.postReply = async function(e, discId) {
    e.preventDefault();
    const input = document.getElementById(`replyInput-${discId}`);
    await apiFetch(`/discussions/${discId}/replies`, { method: "POST", body: JSON.stringify({ content: input.value.trim() }) });
    toggleReplies(discId);
  };

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const course_id = select.value;
    const title = document.getElementById("hubDiscTitle").value;
    const content = document.getElementById("hubDiscContent").value;
    await apiFetch("/discussions", { method: "POST", body: JSON.stringify({ course_id, title, content }) });
    form.reset();
    loadDiscussions();
  });

  populateCourses();
  loadDiscussions();
});

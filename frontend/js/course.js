let currentCourseId = null;
let currentCourseData = null;
let currentUser = null;
let assignmentRowNumber = 0;
let examQuestionNumber = 0;
let examCountdown = null;

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = checkAuth();
  if (!currentUser) return;
  renderNavigation("courses");

  const params = new URLSearchParams(window.location.search);
  currentCourseId = parseInt(params.get("id"), 10);
  if (!currentCourseId) { window.location.href = "/courses.html"; return; }

  await loadCourseData();
  addAssignmentRow();
  addExamQuestion();
  const minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
  ['exStart','exEnd','liveStartTime'].forEach(id => { const input=document.getElementById(id); if(input) input.min=minDate; });
  document.getElementById('exStart')?.addEventListener('change', e => { document.getElementById('exEnd').min=e.target.value; });
  wireFileDrop('noteDrop','noteFile');
});

async function loadCourseData() {
  try {
    currentCourseData = await apiFetch(`/courses/${currentCourseId}`);
    document.getElementById("topCourseTitle").textContent = currentCourseData.title;
    document.getElementById("cTitle").textContent = currentCourseData.title;
    document.getElementById("cDesc").textContent = currentCourseData.description;
    document.getElementById("cCategory").textContent = currentCourseData.category;
    document.getElementById("cLevel").textContent = currentCourseData.level;
    document.getElementById("cTeacher").textContent = currentCourseData.teacher_name;
    document.getElementById("cRating").innerHTML = `<i class="fa-solid fa-star"></i> ${currentCourseData.avg_rating} (${currentCourseData.review_count} reviews)`;
    document.getElementById("courseBanner").src = currentCourseData.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800';

    const isOwner = (currentUser.role === 'teacher' && currentCourseData.teacher_id === currentUser.id) || currentUser.role === 'admin';
    const isEnrolled = currentCourseData.is_enrolled;

    const btnZone = document.getElementById("courseActionBtnZone");
    if (isOwner) {
      document.getElementById("teacherStudentsTab").style.display = "inline-block";
      document.getElementById("teacherNotePostZone").style.display = "block";
      document.getElementById("teacherVideoPostZone").style.display = "block";
      document.getElementById("teacherLivePostZone").style.display = "block";
      document.getElementById("teacherAssignPostZone").style.display = "block";
      document.getElementById("teacherExamCreateZone").style.display = "block";
      btnZone.innerHTML = `
        <button class="btn btn-outline btn-sm" onclick="editCourse()"><i class="fa-solid fa-pen"></i> Edit Course</button>
        ${!currentCourseData.is_published ? '<button class="btn btn-primary btn-sm" onclick="publishCourse()">Publish Draft</button>' : ''}
        <button class="btn btn-outline btn-sm" onclick="promptBannerUpdate()"><i class="fa-solid fa-image"></i> Update Banner</button>
        <button class="btn btn-outline btn-sm btn-danger" onclick="deleteBanner()"><i class="fa-solid fa-trash"></i> Reset Banner</button>
      `;
    } else if (currentUser.role === 'student') {
      if (currentCourseData.is_banned) {
        btnZone.innerHTML = `<span class="badge badge-danger" style="padding:0.6rem 1rem;">Banned from this Course</span>`;
      } else if (isEnrolled) {
        btnZone.innerHTML = `
          <span class="badge badge-success" style="padding:0.6rem 1rem;"><i class="fa-solid fa-check"></i> Enrolled</span>
          <button class="btn btn-outline btn-sm btn-danger" onclick="unenrollCourse()"><i class="fa-solid fa-arrow-right-from-bracket"></i> Unenroll</button>
        `;
        document.getElementById("checkpointClaimZone").style.display = "block";
      } else {
        btnZone.innerHTML = `<button class="btn btn-primary" onclick="enrollCourse()"><i class="fa-solid fa-plus"></i> Join / Enroll Course</button>`;
      }
    }

    if (isOwner || isEnrolled) {
      loadClassroomPosts().catch(showCourseResourceError);
      loadCourseVideos().catch(showCourseResourceError);
      loadLiveClasses().catch(showCourseResourceError);
      loadAssignments().catch(showCourseResourceError);
      loadExams().catch(showCourseResourceError);
      loadDiscussions().catch(showCourseResourceError);
    } else {
      ['classroomFeed','videosGrid','liveClassesList','assignmentsList','examsList','courseDiscussionsList'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent='Enroll in this course to view its learning materials.'; });
    }
    loadReviews();
    const reviewForm=document.querySelector('#tabReviews form');
    if (reviewForm) reviewForm.style.display=currentUser.role==='student' && isEnrolled ? '' : 'none';
    if (isOwner) loadEnrolledStudents();
  } catch (err) {
    alert("Failed to load course: " + err.message);
  }
}

function showCourseResourceError(err) {
  const target=document.getElementById('courseDiscussionsList');
  if(target) target.textContent=err.message;
}

async function editCourse() {
  const c = currentCourseData;
  const title = prompt('Course title:', c.title); if (title === null) return;
  const description = prompt('Course description:', c.description); if (description === null) return;
  const category = prompt('Course category:', c.category); if (category === null) return;
  const level = prompt('Level (Beginner, Intermediate, Advanced, All Levels):', c.level); if (level === null) return;
  await apiFetch(`/courses/${currentCourseId}`, { method: 'PUT', body: JSON.stringify({title, description, category, level}) });
  await loadCourseData();
}
async function publishCourse() {
  await apiFetch(`/courses/${currentCourseId}`, { method: 'PUT', body: JSON.stringify({is_published: true}) });
  await loadCourseData();
}

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
  event.currentTarget.classList.add("active");

  const tabId = "tab" + tab.charAt(0).toUpperCase() + tab.slice(1);
  const el = document.getElementById(tabId);
  if (el) el.style.display = "block";
}

async function promptBannerUpdate() {
  const url = prompt("Enter new Image Banner URL:", currentCourseData.thumbnail_url);
  if (!url) return;
  await apiFetch(`/courses/${currentCourseId}`, { method: "PUT", body: JSON.stringify({ thumbnail_url: url }) });
  loadCourseData();
}

async function deleteBanner() {
  if (!confirm("Reset banner to default image?")) return;
  await apiFetch(`/courses/${currentCourseId}/banner`, { method: "DELETE" });
  loadCourseData();
}

async function enrollCourse() {
  try {
    await apiFetch("/enrollments", { method: "POST", body: JSON.stringify({ course_id: currentCourseId }) });
    alert("🎉 Successfully joined the course!");
    loadCourseData();
  } catch (err) { alert(err.message); }
}

async function unenrollCourse() {
  if (!confirm("Are you sure you want to drop this course?")) return;
  try {
    await apiFetch(`/enrollments/${currentCourseId}`, { method: "DELETE" });
    alert("Unenrolled successfully.");
    loadCourseData();
  } catch (err) { alert(err.message); }
}

async function claimCheckpoint() {
  try {
    const res = await apiFetch(`/courses/${currentCourseId}/complete`, { method: "POST" });
    alert(`🎉 Success! Your Verified Checkpoint Code: ${res.checkpoint_code}`);
    loadCourseData();
  } catch (err) { alert(err.message); }
}

// Classroom Notes
async function loadClassroomPosts() {
  const posts = await apiFetch(`/classroom/courses/${currentCourseId}/posts`);
  const c = document.getElementById("classroomFeed");
  if (!posts.length) { c.innerHTML = "<p style='color:var(--gray-500);'>No classroom notes published yet.</p>"; return; }
  c.innerHTML = posts.map(p => `
    <div class="card" style="margin-bottom:1rem;">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
        <strong>${escapeHtml(p.title)}</strong>
        <span style="font-size:0.8rem; color:var(--gray-500);">${formatDate(p.created_at)}</span>
      </div>
      <p style="color:var(--gray-700); line-height:1.5;">${escapeHtml(p.content)}</p>
      ${p.attachment_data ? `<a class="btn btn-outline btn-sm" href="${p.attachment_data}" download="${escapeHtml(p.attachment_name)}">Download ${escapeHtml(p.attachment_name)}</a>` : ''}
    </div>
  `).join("");
}

async function postClassNote(e) {
  e.preventDefault();
  const title = document.getElementById("noteTitle").value;
  const content = document.getElementById("noteContent").value;
  const selected=document.getElementById('noteFile').files[0];
  try { const file=selected ? await readUpload(selected) : null; await apiFetch("/classroom/posts", { method: "POST", body: JSON.stringify({ course_id: currentCourseId, title, content, file }) }); }
  catch (err) { alert(err.message); return; }
  e.target.reset();
  loadClassroomPosts();
}

// Video Lectures (YouTube Embed)
async function loadCourseVideos() {
  const vids = await apiFetch(`/classroom/courses/${currentCourseId}/videos`);
  const c = document.getElementById("videosGrid");
  if (!vids.length) { c.innerHTML = "<p style='color:var(--gray-500);'>No video lectures added yet.</p>"; return; }
  c.innerHTML = vids.map(v => {
    const videoId = v.video_url.includes("v=") ? v.video_url.split("v=")[1].split("&")[0] : v.video_url.split("/").pop();
    return `
      <div class="card">
        <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px; margin-bottom:0.75rem;">
          <iframe src="https://www.youtube.com/embed/${videoId}" style="position:absolute; top:0; left:0; width:100%; height:100%;" frameborder="0" allowfullscreen></iframe>
        </div>
        <h4 style="font-size:1rem; font-weight:600;">${v.title}</h4>
        <p style="font-size:0.85rem; color:var(--gray-500);">${v.description || ''}</p>
      </div>
    `;
  }).join("");
}

async function postVideoLecture(e) {
  e.preventDefault();
  const title = document.getElementById("vidTitle").value;
  const video_url = document.getElementById("vidUrl").value;
  await apiFetch("/classroom/videos", { method: "POST", body: JSON.stringify({ course_id: currentCourseId, title, video_url }) });
  e.target.reset();
  loadCourseVideos();
}

// Live Classes
async function loadLiveClasses() {
  const lives = await apiFetch(`/classroom/courses/${currentCourseId}/live`);
  const c = document.getElementById("liveClassesList");
  if (!lives.length) { c.innerHTML = "<p style='color:var(--gray-500);'>No live classes scheduled.</p>"; return; }
  c.innerHTML = lives.map(l => `
    <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
      <div>
        <span class="badge badge-primary">${l.platform.toUpperCase()}</span>
        <h4 style="margin:0.25rem 0;">${l.title}</h4>
        <p style="font-size:0.85rem; color:var(--gray-500);"><i class="fa-solid fa-clock"></i> Starts: ${formatDate(l.starts_at)}</p>
      </div>
      <a href="${l.meeting_url}" target="_blank" class="btn btn-primary btn-sm"><i class="fa-solid fa-arrow-up-right-from-square"></i> Join Meeting</a>
    </div>
  `).join("");
}

async function postLiveClass(e) {
  e.preventDefault();
  const title = document.getElementById("liveTitle").value;
  const platform = document.getElementById("livePlatform").value;
  const meeting_url = document.getElementById("liveMeetingUrl").value;
  const starts_at = document.getElementById("liveStartTime").value;
  await apiFetch("/classroom/live", { method: "POST", body: JSON.stringify({ course_id: currentCourseId, title, platform, meeting_url, starts_at:new Date(starts_at).toISOString() }) });
  e.target.reset();
  loadLiveClasses();
}

// Assignments
async function loadAssignments() {
  const asgns = await apiFetch(`/assessments/courses/${currentCourseId}/assignments`);
  const c = document.getElementById("assignmentsList");
  if (!asgns.length) { c.innerHTML = "<p style='color:var(--gray-500);'>No assignments active.</p>"; return; }
  const teacherSubmissions = currentUser.role === 'teacher' ? await Promise.all(asgns.map(a => apiFetch(`/assessments/assignments/${a.id}/submissions`))) : [];
  c.innerHTML = asgns.map((a,index) => `
    <div class="card" style="margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between;">
        <h4>${escapeHtml(a.title)}</h4>
        <span class="badge badge-warning">Marks: ${a.total_marks}</span>
      </div>
      <p style="margin:0.5rem 0; color:var(--gray-700);">${escapeHtml(a.description)}</p>
      <p style="font-size:0.85rem; color:var(--danger);"><i class="fa-solid fa-hourglass-end"></i> Deadline: ${formatDate(a.deadline)}</p>
      ${(a.attachments || []).map(f => `<a class="btn btn-outline btn-sm" href="${f.data}" download="${escapeHtml(f.name)}">Download ${escapeHtml(f.name)}</a>`).join(' ')}

      ${currentUser.role === 'student' ? `
        <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border);">
          ${a.submission_id ? `<span class="badge badge-success"><i class="fa-solid fa-check"></i> Submitted (${escapeHtml(a.submission_status)})</span><p>Grade: ${a.student_marks ?? 'Pending'} ${a.teacher_feedback ? '· '+escapeHtml(a.teacher_feedback) : ''}</p>` : `
            <form onsubmit="submitAssignmentSolution(event, ${a.id})">
              <input type="url" id="asgnUrl-${a.id}" class="form-control" placeholder="Optional link (GitHub, Drive, etc.)" style="margin-bottom:0.5rem;">
              <input type="file" id="asgnFile-${a.id}" class="form-control" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.zip">
              <div id="asgnDrop-${a.id}" style="padding:.75rem;border:1px dashed var(--primary);margin:.5rem 0">Drag and drop your assignment file here (8 MB max)</div>
              <button type="submit" class="btn btn-primary btn-sm">Turn In Assignment</button>
            </form>
          `}
        </div>
      ` : currentUser.role === 'teacher' ? `<h4>Student submissions (${teacherSubmissions[index].length})</h4>${teacherSubmissions[index].map(s => `<div style="padding:.75rem;border-top:1px solid var(--border)"><strong>${escapeHtml(s.student_name)}</strong> · ${formatDate(s.submitted_at)}<div>${s.submission_url ? `<a href="${escapeHtml(s.submission_url)}" target="_blank" rel="noopener">Open link</a>` : ''} ${s.file_data ? `<a class="btn btn-outline btn-sm" href="${s.file_data}" download="${escapeHtml(s.file_name)}">Download ${escapeHtml(s.file_name)}</a>` : 'No uploaded file'}</div><p>Current grade: ${s.marks ?? 'Not graded'}</p><input id="grade-${a.id}-${s.student_id}" type="number" min="0" max="${a.total_marks}" value="${s.marks ?? ''}" placeholder="Marks"><input id="feedback-${a.id}-${s.student_id}" placeholder="Feedback" value="${escapeHtml(s.feedback || '')}"><button class="btn btn-primary btn-sm" onclick="gradeAssignment(${a.id},${s.student_id})">Save grade</button></div>`).join('') || '<p>No submissions yet.</p>'}` : ''}
    </div>
  `).join("");
  if (currentUser.role === 'student') asgns.filter(a => !a.submission_id).forEach(a => wireFileDrop(`asgnDrop-${a.id}`,`asgnFile-${a.id}`));
}

async function postAssignment(e) {
  e.preventDefault();
  try {
    const rows=Array.from(document.querySelectorAll('.assignment-row'));
    const assignments=await Promise.all(rows.map(async row => ({
      title:row.querySelector('.asgn-title').value.trim(), description:row.querySelector('.asgn-desc').value.trim(),
      total_marks:Number(row.querySelector('.asgn-marks').value), deadline:new Date(row.querySelector('.asgn-deadline').value).toISOString(),
      attachments:await Promise.all(Array.from(row.querySelector('.asgn-files').files).map(f=>readUpload(f)))
    })));
    await apiFetch('/assessments/assignments',{method:'POST',body:JSON.stringify({course_id:currentCourseId,assignments})});
    alert(`${assignments.length} assignment(s) published.`); document.getElementById('assignmentRows').innerHTML=''; addAssignmentRow(); loadAssignments();
  } catch(err) { alert(err.message); }
}

async function submitAssignmentSolution(e, asgnId) {
  e.preventDefault();
  try {
    const url=document.getElementById(`asgnUrl-${asgnId}`).value.trim(), selected=document.getElementById(`asgnFile-${asgnId}`).files[0];
    if (!url && !selected) return alert('Choose a file or enter a submission link.');
    const file=selected ? await readUpload(selected,8*1024*1024) : null;
    await apiFetch(`/assessments/assignments/${asgnId}/submit`,{method:'POST',body:JSON.stringify({submission_url:url||null,file})});
    alert('Assignment submitted!'); loadAssignments();
  } catch(err) { alert(err.message); }
}

async function gradeAssignment(assignmentId,studentId) {
  try { await apiFetch(`/assessments/assignments/${assignmentId}/submissions/${studentId}`,{method:'PUT',body:JSON.stringify({marks:document.getElementById(`grade-${assignmentId}-${studentId}`).value,feedback:document.getElementById(`feedback-${assignmentId}-${studentId}`).value})}); alert('Grade saved.'); loadAssignments(); }
  catch(err) { alert(err.message); }
}

function addAssignmentRow() {
  const id=assignmentRowNumber++, rows=document.getElementById('assignmentRows'); if(!rows)return;
  const min=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
  rows.insertAdjacentHTML('beforeend',`<fieldset class="assignment-row card" style="margin:.8rem 0"><legend>Assignment ${id+1}</legend><input class="form-control asgn-title" placeholder="Assignment title" required><textarea class="form-control asgn-desc" placeholder="Instructions" required></textarea><label>Total marks</label><input class="form-control asgn-marks" type="number" min="1" value="25" required><label>Deadline</label><input class="form-control asgn-deadline" type="datetime-local" min="${min}" required><label>Attach files</label><input id="teacherAsgnFile-${id}" class="form-control asgn-files" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.zip"><div id="teacherAsgnDrop-${id}" style="padding:.75rem;border:1px dashed var(--primary);margin:.5rem 0">Drag and drop assignment files here</div></fieldset>`);
  wireFileDrop(`teacherAsgnDrop-${id}`,`teacherAsgnFile-${id}`);
}

function wireFileDrop(zoneId,inputId) {
  const zone=document.getElementById(zoneId), input=document.getElementById(inputId); if(!zone||!input)return;
  zone.addEventListener('dragover',e=>{e.preventDefault();zone.style.background='var(--primary-light)'});
  zone.addEventListener('dragleave',()=>zone.style.background='');
  zone.addEventListener('drop',e=>{e.preventDefault();zone.style.background='';const dt=new DataTransfer();Array.from(e.dataTransfer.files).forEach(f=>dt.items.add(f));input.files=dt.files;zone.textContent=Array.from(dt.files).map(f=>f.name).join(', ')||'Drop files here';});
}

// Timed Exams
async function loadExams() {
  const exams = await apiFetch(`/assessments/courses/${currentCourseId}/exams`);
  const c = document.getElementById("examsList");
  if (!exams.length) { c.innerHTML = "<p style='color:var(--gray-500);'>No exams scheduled.</p>"; return; }
  c.innerHTML = exams.map(x => `
    <div class="card" style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h4>${escapeHtml(x.title)}</h4>
        <p style="font-size:0.85rem; color:var(--gray-500);"><i class="fa-solid fa-stopwatch"></i> Duration: ${x.duration_minutes} mins | Total Marks: ${x.total_marks}</p>
        <p style="font-size:0.85rem; color:var(--gray-500);">Window: ${formatDate(x.starts_at)} - ${formatDate(x.ends_at)}</p>
      </div>
      ${currentUser.role === 'student' ? (x.attempt_status === 'submitted'
        ? `<span class="badge badge-success">Score: ${x.student_marks} / ${x.total_marks}</span>`
        : `<button class="btn btn-primary btn-sm" ${Date.now()<new Date(x.starts_at).getTime()||Date.now()>=new Date(x.ends_at).getTime()?'disabled':''} onclick="startExamSession(${x.id})">${x.attempt_status==='in_progress'?'Resume Exam':'Take Exam'}</button>`
      ) : ''}
    </div>
  `).join("");
}

async function startExamSession(examId) {
  let data;
  try { data = await apiFetch(`/assessments/exams/${examId}/start`, { method: "POST" }); }
  catch(err) { alert(err.message); return; }
  const activeZone = document.getElementById("examActiveZone");
  document.getElementById("examsList").style.display = "none";

  let remainingSec = Math.max(0,Math.floor((new Date(data.expires_at).getTime()-Date.now())/1000));
  activeZone.innerHTML = `
    <div class="card" style="border:2px solid var(--primary); margin-bottom:2rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:0.75rem;">
        <h3>${escapeHtml(data.exam.title)}</h3>
        <h4 id="examTimer" style="color:var(--danger); font-size:1.2rem;"><i class="fa-solid fa-stopwatch"></i> ${Math.floor(remainingSec/60)}:${String(remainingSec%60).padStart(2,'0')}</h4>
      </div>
      <form id="examRunForm" onsubmit="submitExamAnswers(event, ${examId})" style="margin-top:1.5rem;">
        ${data.questions.map((q, i) => `
          <div style="margin-bottom:1.5rem;">
            <p><strong>Q${i+1}. ${escapeHtml(q.question_text)}</strong> (${q.marks} Marks)</p>
            ${q.options.map(o => `
              <label style="display:block; margin:0.35rem 0; cursor:pointer;">
                <input type="radio" name="q_${q.id}" value="${o.id}"> ${escapeHtml(o.text)}
              </label>
            `).join("")}
          </div>
        `).join("")}
        <button type="submit" class="btn btn-primary">Submit Exam</button>
      </form>
    </div>
  `;

  clearInterval(examCountdown);
  examCountdown = setInterval(() => {
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    const timerEl = document.getElementById("examTimer");
    if (timerEl) {
      timerEl.innerHTML = `<i class="fa-solid fa-stopwatch"></i> ${m}:${s < 10 ? '0' : ''}${s}`;
    }
    if (--remainingSec < 0) {
      clearInterval(examCountdown);
      const form=document.getElementById('examRunForm');
      if(form) submitExamAnswers({preventDefault(){},target:form},examId);
    }
  }, 1000);
}

async function submitExamAnswers(e, examId) {
  e.preventDefault();
  clearInterval(examCountdown);
  const submitButton=e.target.querySelector('button[type="submit"]'); if(submitButton) submitButton.disabled=true;
  const formData = new FormData(e.target);
  const answers = {};
  for (const [k, v] of formData.entries()) {
    answers[k.replace("q_", "")] = parseInt(v, 10);
  }

  try {
    const res = await apiFetch(`/assessments/exams/${examId}/submit`, { method: "POST", body: JSON.stringify({ answers }) });
    alert(`Exam Finished! Your Score: ${res.marks}`); window.location.reload();
  } catch(err) { alert(err.message); }
}

async function createTeacherExam(e) {
  e.preventDefault();
  const title = document.getElementById("exTitle").value;
  const duration_minutes = parseInt(document.getElementById("exDuration").value, 10);
  const starts_at = document.getElementById("exStart").value;
  const ends_at = document.getElementById("exEnd").value;
  const questions=Array.from(document.querySelectorAll('.exam-question')).map(row=>({question_text:row.querySelector('.question-text').value.trim(),marks:Number(row.querySelector('.question-marks').value),options:Array.from(row.querySelectorAll('.question-option')).map((input,i)=>({text:input.value.trim(),is_correct:i+1===Number(row.querySelector('.correct-option').value)}))}));
  if (!questions.length || questions.some(q=>!q.question_text||q.options.some(o=>!o.text))) return alert('Complete every question and its four answer options.');
  const start=new Date(starts_at).getTime(),end=new Date(ends_at).getTime();
  if (start<=Date.now()||end<=start||duration_minutes*60000>end-start) return alert('Choose a future exam window long enough for its duration.');
  const total_marks=questions.reduce((sum,q)=>sum+q.marks,0);
  try { await apiFetch("/assessments/exams", {
    method: "POST",
    body: JSON.stringify({ course_id: currentCourseId, title, duration_minutes, starts_at:new Date(starts_at).toISOString(), ends_at:new Date(ends_at).toISOString(), total_marks, questions })
  }); } catch(err) { alert(err.message); return; }
  alert("Exam created successfully!");
  e.target.reset();
  loadExams();
}

function addExamQuestion() {
  const box=document.getElementById('examQuestionRows'); if(!box)return;
  const n=++examQuestionNumber;
  box.insertAdjacentHTML('beforeend',`<fieldset class="exam-question card" style="background:var(--gray-50);margin:1rem 0"><legend>Question ${n}</legend><input class="form-control question-text" placeholder="Question text" required><label>Marks</label><input class="form-control question-marks" type="number" min="1" value="10" required><div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin:.5rem 0">${[1,2,3,4].map(i=>`<input class="form-control question-option" placeholder="Option ${i}" required>`).join('')}</div><label>Correct answer</label><select class="form-select correct-option">${[1,2,3,4].map(i=>`<option value="${i}">Option ${i}</option>`).join('')}</select></fieldset>`);
}

// Q&A Discussions
async function loadDiscussions() {
  const discs = await apiFetch(`/discussions/course/${currentCourseId}`);
  const c = document.getElementById("courseDiscussionsList");
  if (!discs.length) { c.innerHTML = "<p style='color:var(--gray-500);'>No questions yet.</p>"; return; }
  c.innerHTML = discs.map(d => `
    <div class="card" style="margin-bottom:1rem;">
      <h4>${d.title}</h4>
      <p style="margin:0.5rem 0; color:var(--gray-700);">${d.content}</p>
      <span style="font-size:0.8rem; color:var(--gray-500);">By ${d.author_name} (${d.author_role}) • ${formatDate(d.created_at)}</span>
    </div>
  `).join("");
}

async function postCourseDiscussion(e) {
  e.preventDefault();
  const title = document.getElementById("discTitle").value;
  const content = document.getElementById("discContent").value;
  await apiFetch("/discussions", { method: "POST", body: JSON.stringify({ course_id: currentCourseId, title, content }) });
  e.target.reset();
  loadDiscussions();
}

// Reviews 0 to 10
async function loadReviews() {
  const revs = await apiFetch(`/courses/${currentCourseId}/reviews`);
  const form = document.querySelector('#tabReviews form');
  const mine = revs.find(r => r.student_id === currentUser.id);
  if (mine) {
    document.getElementById('rateScore').value = mine.rating;
    document.getElementById('rateScoreDisplay').textContent = mine.rating;
    document.getElementById('rateReviewText').value = mine.review || '';
    form.querySelector('button[type="submit"]').textContent = 'Edit Review';
    form.dataset.editing = 'true';
  }
  const c = document.getElementById("reviewsList");
  if (!revs.length) { c.innerHTML = "<p style='color:var(--gray-500);'>No reviews yet.</p>"; return; }
  c.innerHTML = revs.map(r => `
    <div class="card" style="margin-bottom:1rem;">
      <div style="display:flex; justify-content:space-between;">
        <strong>${escapeHtml(r.student_name)}</strong>
        <span class="badge badge-warning"><i class="fa-solid fa-star"></i> ${r.rating} / 10.0</span>
      </div>
      <p style="margin-top:0.4rem; color:var(--gray-700);">${escapeHtml(r.review)}</p>
    </div>
  `).join("");
}

async function postCourseReview(e) {
  e.preventDefault();
  const rating = document.getElementById("rateScore").value;
  const review = document.getElementById("rateReviewText").value;
  const editing = e.currentTarget.dataset.editing === 'true';
  await apiFetch(`/courses/${currentCourseId}/reviews`, { method: editing ? "PUT" : "POST", body: JSON.stringify({ rating, review }) });
  alert(editing ? "Review updated!" : "Review submitted!");
  loadReviews();
  loadCourseData();
}

// Teacher Enrolled Students Moderation (Ban / Remove)
async function loadEnrolledStudents() {
  const students = await apiFetch(`/courses/${currentCourseId}/students`);
  const t = document.getElementById("studentsRosterTable");
  t.innerHTML = `
    <tr style="text-align:left; border-bottom:2px solid var(--border);">
      <th style="padding:0.75rem;">Student</th>
      <th style="padding:0.75rem;">Email</th>
      <th style="padding:0.75rem;">Progress</th>
      <th style="padding:0.75rem;">Status</th>
      <th style="padding:0.75rem;">Actions</th>
    </tr>
    ${students.map(s => `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:0.75rem;"><img src="${s.avatar_url || 'https://i.pravatar.cc/80'}" alt="" style="width:28px;height:28px;border-radius:50%;vertical-align:middle"> ${s.name} <span style="color:${s.is_online ? 'var(--success)' : 'var(--gray-500)'}; font-size:0.8rem;">● ${s.is_online ? 'Online' : 'Offline'}</span></td>
        <td style="padding:0.75rem;">${s.email}</td>
        <td style="padding:0.75rem;">${s.progress_percent}%</td>
        <td style="padding:0.75rem;"><span class="badge ${s.status === 'completed' ? 'badge-success' : 'badge-primary'}">${s.status}</span></td>
        <td style="padding:0.75rem;">
          <button class="btn btn-outline btn-sm" onclick="moderateStudent(${s.user_id}, 'remove')">Remove</button>
          <button class="btn btn-outline btn-sm btn-danger" onclick="moderateStudent(${s.user_id}, 'ban')">Ban</button>
        </td>
      </tr>
    `).join("")}
  `;
}

async function moderateStudent(studentId, action) {
  const reason = prompt(`Reason for ${action}ing student:`, "Disciplinary policy violation");
  if (reason === null) return;
  await apiFetch(`/courses/${currentCourseId}/students/${studentId}/moderate`, { method: "POST", body: JSON.stringify({ action, reason }) });
  alert(`Student ${action}ed.`);
  loadEnrolledStudents();
}

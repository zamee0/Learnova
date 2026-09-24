document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const authAlert = document.getElementById("authAlert");

  function showAlert(message, type = "danger") {
    if (!authAlert) return;
    authAlert.className = `alert alert-${type}`;
    authAlert.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <span>${message}</span>`;
    authAlert.style.display = "flex";
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const submitBtn = loginForm.querySelector("button[type='submit']");

      submitBtn.disabled = true;
      submitBtn.textContent = "Logging in...";

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch { throw new Error("Server returned an invalid response."); }

        if (!response.ok) throw new Error(data.error || "Invalid credentials");

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        window.location.href = data.user.role === 'admin' ? "/admin.html" : "/dashboard.html";
      } catch (err) {
        showAlert(err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In";
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const first_name = document.getElementById("first_name").value.trim();
      const last_name = document.getElementById("last_name").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const role = document.getElementById("role").value;
      const avatar_url = document.getElementById("avatar_url")?.value.trim() || "";
      const bio = document.getElementById("bio")?.value.trim() || "";
      const phone = document.getElementById("phone")?.value.trim() || "";
      const address = document.getElementById("address")?.value.trim() || "";
      const institution = document.getElementById("institution")?.value.trim() || "";
      const semester = document.getElementById("semester")?.value.trim() || "";
      const designation = document.getElementById("designation")?.value.trim() || "";
      const qualification = document.getElementById("qualification")?.value.trim() || "";
      const qualifications = role === 'teacher' ? [{ degree: document.getElementById('teacherDegree').value.trim(), institute: document.getElementById('teacherInstitute').value.trim(), experience: document.getElementById('teacherExperience').value.trim(), certifications: document.getElementById('teacherCertifications').value.trim() }] : [];
      if (role === 'teacher' && (!bio || Object.values(qualifications[0]).some(v => !v))) { showAlert("Teachers must provide a bio and all qualification details."); return; }

      const submitBtn = signupForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating account...";

      try {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name, last_name, email, password, role,
            avatar_url, bio, phone, address, institution, semester, designation, qualification, qualifications
          })
        });

        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch { throw new Error("Server returned an invalid response."); }

        if (!response.ok) throw new Error(data.error || "Failed to create account");

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        window.location.href = "/dashboard.html";
      } catch (err) {
        showAlert(err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create Account";
      }
    });
  }
});

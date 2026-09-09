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
      submitBtn.innerHTML = `<span class="spinner" style="width:1rem;height:1rem;border-width:2px;"></span> Logging in...`;

      try {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Invalid login credentials");

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        window.location.href = "/dashboard.html";
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
      const submitBtn = signupForm.querySelector("button[type='submit']");

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner" style="width:1rem;height:1rem;border-width:2px;"></span> Creating account...`;

      try {
        const response = await fetch(`${API_BASE}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ first_name, last_name, email, password, role })
        });

        const data = await response.json();
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
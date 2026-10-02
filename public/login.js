if (session.token) location.replace("dashboard.html");

document.getElementById("form").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("msg"), btn = document.getElementById("btn");
  msg.textContent = ""; btn.disabled = true;
  try {
    
const data = await api("/auth/login", "POST", {
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value
    });
    session.save(data.token, data.user || data);
    location.href = "dashboard.html";
  } catch (err) {
    msg.textContent = err.message;
    btn.disabled = false;
  }
});

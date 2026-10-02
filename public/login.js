if (session.token) location.replace("dashboard.html");

const $ = s => document.querySelector(s);

function tab(name) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
  $("#form").classList.toggle("on", name === "login");
  $("#regForm").classList.toggle("on", name === "register");
}
document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => tab(b.dataset.tab));

document.querySelectorAll(".pw button").forEach(b => b.onclick = () => {
  const i = b.previousElementSibling, show = i.type === "password";
  i.type = show ? "text" : "password";
  b.textContent = show ? "Ocultar" : "Mostrar";
});

$("#form").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("#msg"), btn = $("#btn");
  msg.style.color = ""; msg.textContent = ""; btn.disabled = true;
  try {
    const data = await api("/auth/login", "POST", { email: $("#email").value.trim(), password: $("#password").value });
    session.save(data.token, data.user || data);
    location.href = "dashboard.html";
  } catch (err) {
    msg.textContent = err.message;
    btn.disabled = false;
  }
});

// Cadastro: POST /users com { name, email, password } (ajuste se a sua API for diferente)
$("#regForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("#regMsg"), btn = $("#regBtn");
  msg.textContent = ""; btn.disabled = true;
  try {
    const email = $("#rEmail").value.trim();
    await api("/users", "POST", { name: $("#rName").value.trim(), email, password: $("#rPass").value });
    e.target.reset(); tab("login");
    $("#email").value = email;
    $("#msg").style.color = "var(--ok)"; $("#msg").textContent = "Conta criada. Entre para continuar.";
  } catch (err) {
    msg.textContent = err.message;
  }
  btn.disabled = false;
});

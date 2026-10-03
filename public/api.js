// Ajuste aqui a URL da sua API ("" = mesma origem)
const API_URL = "";

const session = {
  get token() { return localStorage.getItem("solutech_token"); },
  get user() { try { return JSON.parse(localStorage.getItem("solutech_user")); } catch { return null; } },
  save(token, user) { localStorage.setItem("solutech_token", token); localStorage.setItem("solutech_user", JSON.stringify(user)); },
  clear() { localStorage.removeItem("solutech_token"); localStorage.removeItem("solutech_user"); }
};

async function api(path, method = "GET", body) {
  const headers = { "Content-Type": "application/json" };
  if (session.token) headers.Authorization = "Bearer " + session.token;
  const res = await fetch(API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = {};
  try { json = await res.json(); } catch {}
  if (res.status === 401 && session.token) { session.clear(); location.href = "login.html"; }
  if (!res.ok || json.success === false) {
  console.error(method, path, res.status, json);
  throw new Error(json.message || "Erro " + res.status);
}
  return json.data !== undefined ? json.data : json;
}

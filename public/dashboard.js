if (!session.token) location.replace("login.html");

const $ = s => document.querySelector(s);
const money = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toast = (msg, err) => {
  const t = $("#toast"); t.textContent = msg; t.className = "show" + (err ? " err" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.className = "", err ? 9000 : 3500);
};
const list = d => Array.isArray(d) ? d : (d && Object.values(d).find(Array.isArray)) || [];
const safeList = p => api(p).then(list).catch(() => []);
const table = (el, cols, rows) => {
  $(el).innerHTML = rows.length
    ? `<table><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${c[1](r)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
    : `<p class="empty">Nada encontrado.</p>`;
};
async function guard(fn) { try { await fn(); } catch (e) { toast(e.message, true); } }
const acts = ent => ["", r => `<button class="act" data-act="edit" data-ent="${ent}" data-id="${r.id}">Editar</button><button class="act del" data-act="del" data-ent="${ent}" data-id="${r.id}">Excluir</button>`];
const has = (v, s) => String(v ?? "").toLowerCase().includes(s);
const term = id => $(id).value.trim().toLowerCase();

const db = { clients: [], products: [], sales: [], users: [] };
const PAY = ["PIX", "CARTAO_CREDITO", "CARTAO_DEBITO", "DINHEIRO", "BOLETO"];
// Identidade: junta a resposta do login com os dados do token (JWT) e a lista de usuários
const jwt = () => { try { return JSON.parse(atob(session.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return {}; } };
const me = () => ({ ...jwt(), ...(session.user || {}) });
const meId = () => {
  const m = me(), id = m.id ?? m.userId ?? m.user_id ?? m.id_users ?? m.sub;
  if (id != null) return id;
  const u = db.users.find(x => (m.email && x.email === m.email) || (m.name && x.name === m.name));
  return u ? u.id : null;
};
const myUser = () => db.users.find(u => u.id == meId()) || me();
const withMe = u => u.length || meId() == null ? u : [{ ...me(), id: meId() }];
const cname = id => (db.clients.find(c => c.id == id) || {}).name || "#" + id;
const uname = id => { const u = db.users.find(u => u.id == id) || {}; return u.name || u.email || "#" + id; };

// Rotas e métodos de edição (ajuste aqui se a sua API for diferente)
const ENT = {
  clients: { path: "/clients", method: "PATCH", title: "Editar cliente",
    fields: () => [["name", "Nome"], ["email", "E-mail", "email"], ["cpf", "CPF"]] },
  products: { path: "/product", method: "PUT", title: "Editar produto",
    fields: () => [["name", "Nome"], ["brand", "Fornecedor (marca)"], ["description", "Descrição"], ["quantity", "Estoque", "number"], ["value", "Valor (R$)", "number", "0.01"]] },
  sales: { path: "/sales", method: "PUT", title: "Editar venda",
    fields: () => [["payment_method", "Pagamento", "select", PAY.map(p => [p, p])],
      ["id_clients", "Cliente", "select", db.clients.map(c => [c.id, c.name])],
      ["id_users", "Vendedor", "select", db.users.map(u => [u.id, u.name || u.email])]] }
};
const VIEW = { clients: "clients-list", products: "products-list", sales: "sales-list" };

// ---- navegação ----
const views = {
  "clients-list": loadClients, "clients-new": async () => {},
  "products-list": loadProducts, "products-new": async () => {},
  "sales-list": loadSales, "sales-new": prepareSale,
  "profile-summary": loadProfile, "profile-report": loadReport,
  "sales-items": loadSoldAll, "profile-items": loadSoldMine
};
$("#userName").textContent = me().name || me().email || "";
$("#logout").onclick = () => { session.clear(); location.href = "login.html"; };
document.querySelectorAll("nav button").forEach(b => b.onclick = () => show(b.dataset.view));
function show(view) {
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll("section").forEach(s => s.classList.toggle("on", s.id === "view-" + view));
  guard(views[view]);
}

// ---- editar e excluir (todas as abas) ----
let editing = null;
document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (b) (b.dataset.act === "del" ? remove : edit)(b.dataset.ent, b.dataset.id);
});
function remove(ent, id) {
  if (!confirm("Excluir este registro?")) return;
  guard(async () => { await api(`${ENT[ent].path}/${id}`, "DELETE"); toast("Registro excluído"); show(VIEW[ent]); });
}
function edit(ent, id) {
  const cfg = ENT[ent], row = db[ent].find(r => r.id == id);
  if (!row) return;
  editing = { ent, row };
  $("#dlgTitle").textContent = cfg.title;
  $("#dlgFields").innerHTML = cfg.fields().map(([k, label, type = "text", extra]) => {
    const input = type === "select"
      ? `<select id="f_${k}">${extra.map(([v, t]) => `<option value="${esc(v)}"${v == row[k] ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>`
      : `<input id="f_${k}" type="${type}" value="${esc(row[k])}"${type === "number" ? ` min="0" step="${extra || 1}"` : ""}${k === "description" || k === "brand" ? "" : " required"}>`;
    return `<div class="fld"><label for="f_${k}">${label}</label>${input}</div>`;
  }).join("") + (ent === "products"
    ? `<div class="fld"><label for="f_model">Imagem 3D (.glb)</label><input id="f_model" type="file" accept=".glb,model/gltf-binary">${row.model_3d ? `<label class="chk"><input type="checkbox" id="f_rmmodel"> Remover o modelo 3D atual</label>` : ""}</div>` : "");
  $("#dlg").showModal();
}
$("#dlgCancel").onclick = () => $("#dlg").close();
$("#dlgForm").addEventListener("submit", e => {
  e.preventDefault();
  const { ent, row } = editing, cfg = ENT[ent], body = {};
  cfg.fields().forEach(([k, , type]) => {
    const v = $("#f_" + k).value;
    body[k] = type === "number" || k.startsWith("id_") ? Number(v) : v;
  });
  if (ent === "sales") body.total = row.total;
  guard(async () => {
    let prep = null;
    if (ent === "products" && $("#f_model").files[0]) { ensureSession(); prep = await prepare3D($("#f_model").files[0]); }
    await api(`${cfg.path}/${row.id}`, cfg.method, body);
    if (ent === "products") {
      if (prep) await attach3D(row.id, prep);
      else if ($("#f_rmmodel") && $("#f_rmmodel").checked) await api(`/product/${row.id}/model`, "DELETE");
    }
    $("#dlg").close(); toast("Alterações salvas"); show(VIEW[ent]);
  });
});

// ---- clientes ----
async function loadClients() { db.clients = list(await api("/clients")); renderClients(); }
const one = v => Array.isArray(v) ? v[0] : v;
const dash = v => v ? esc(v) : "-";

function info(c) {
  const p = one(c.phone ?? c.phones) || {}, a = one(c.addresses ?? c.address) || {};
  return {
    ddd: p.ddd ?? c.ddd, tel: p.number ?? c.phone_number, obs: p.observation ?? c.observation,
    street: a.street ?? c.street, num: a.number ?? c.address_number, district: a.district ?? c.district,
    city: a.city ?? c.city, state: a.state ?? c.state, cep: a.cep ?? c.cep
  };
}

const IC = {
  mail: '<path d="M3 6h18v12H3z"/><path d="m3 7 9 7 9-7"/>', id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.6 1.8-2.2 3-2.2s2.4.6 3 2.2M14 10h4M14 14h3"/>',
  tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>', note: '<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', city: '<path d="M4 20V9l6-3v14M10 20V4l10 4v12M3 20h18"/>', cep: '<path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v8l9 5 9-5V8"/>',
  sales: '<path d="M4 5h2l2 10h10l2-7H8"/><circle cx="10" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>', money: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.100 0-2.100-.5-2.600-1.500M12 6v1.500M12 16.500V18"/>',
  avg: '<path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6"/>', top: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>', box: '<path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>'
};
const ic = k => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[k] || IC.avg}</svg>`;
const KI = l => /fatur|receita|total|valor/i.test(l) ? "money" : /ticket|m[eé]dia/i.test(l) ? "avg" : /maior|top|melhor/i.test(l) ? "top" : /item|produto|unid|qtd|quant/i.test(l) ? "box" : "sales";
const kpiHtml = ([l, v]) => `<div class="kpi">${ic(KI(l))}<span>${l}</span><strong>${v}</strong><i class="kbar"></i></div>`;
const initials = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";

const ORDER_KEY = "solutech_order_clients";
const getOrder = () => { try { const a = JSON.parse(localStorage.getItem(ORDER_KEY)); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };
const setOrder = a => { try { localStorage.setItem(ORDER_KEY, JSON.stringify(a)); } catch {} };
const sortByOrder = rows => { const o = getOrder(), pos = id => { const i = o.indexOf(String(id)); return i < 0 ? 1e9 : i; }; return rows.map((r, i) => [r, i]).sort((a, b) => pos(a[0].id) - pos(b[0].id) || a[1] - b[1]).map(x => x[0]); };
// grava a ordem atual dos cards visíveis, preservando a posição dos que estão filtrados
function saveClientOrder() {
  const vis = [...document.querySelectorAll("#clientList .cc")].map(c => c.dataset.id);
  const full = sortByOrder(db.clients).map(c => String(c.id)), slots = full.map((id, i) => vis.includes(id) ? i : -1).filter(i => i >= 0);
  slots.forEach((slot, k) => { full[slot] = vis[k]; });
  setOrder(full);
}
function bindClientDnD(el) {
  if (el._dnd) return; el._dnd = true;
  let drag = null;
  el.addEventListener("pointerdown", e => { const c = e.target.closest(".cc"); if (c) c.draggable = !!e.target.closest(".grip"); });
  el.addEventListener("dragstart", e => { drag = e.target.closest(".cc"); if (!drag) return; drag.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", drag.dataset.id); });
  el.addEventListener("dragover", e => {
    if (!drag) return; e.preventDefault();
    const t = e.target.closest(".cc"); if (!t || t === drag) return;
    const r = t.getBoundingClientRect(), d = drag.getBoundingClientRect();
    const sameRow = Math.abs(r.top - d.top) < r.height / 2;
    const before = sameRow ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
    el.insertBefore(drag, before ? t : t.nextSibling);
  });
  el.addEventListener("drop", e => { if (drag) e.preventDefault(); });
  el.addEventListener("dragend", () => { if (!drag) return; drag.classList.remove("drag"); drag.draggable = false; drag = null; saveClientOrder(); });
  el.addEventListener("click", e => {
    const b = e.target.closest("[data-move]"); if (!b) return;
    const c = b.closest(".cc"), dir = Number(b.dataset.move);
    const other = dir < 0 ? c.previousElementSibling : c.nextElementSibling; if (!other || !other.classList.contains("cc")) return;
    el.insertBefore(c, dir < 0 ? other : other.nextSibling); saveClientOrder(); c.classList.add("moved"); setTimeout(() => c.classList.remove("moved"), 400);
  });
}
function renderClients() {
  const s = term("#qClients"), el = $("#clientList");
  const rows = sortByOrder(db.clients.filter(c => has(c.name, s)));
  bindClientDnD(el);
  const f = (k, l, v) => `<div>${ic(k)}<dt>${l}</dt><dd>${v || "-"}</dd></div>`;
  el.className = "cards";
  el.innerHTML = rows.length ? rows.map(c => {
    const i = info(c);
    return `<article class="cc" data-id="${esc(c.id)}"><header><span class="grip" title="Arraste para reordenar" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span><span class="av">${esc(initials(c.name))}</span><div><h3>${esc(c.name)}</h3><small>Cliente #${esc(c.id)}</small></div><span class="mv"><button type="button" data-move="-1" title="Mover para antes" aria-label="Mover para antes">&#8249;</button><button type="button" data-move="1" title="Mover para depois" aria-label="Mover para depois">&#8250;</button></span></header><dl>
      ${f("mail", "E-mail", esc(c.email))}
      ${f("id", "CPF", esc(c.cpf))}
      ${f("tel", "Telefone", i.tel ? esc(`(${i.ddd || ""}) ${i.tel}`) : "")}
      ${f("note", "Observação", esc(i.obs))}
      ${f("pin", "Endereço", i.street ? esc(`${i.street}, ${i.num || "s/n"} - ${i.district || ""}`) : "")}
      ${f("city", "Cidade/UF", i.city ? esc(`${i.city}/${i.state || ""}`) : "")}
      ${f("cep", "CEP", esc(i.cep))}
    </dl><div class="btns">${acts("clients")[1](c)}</div></article>`;
  }).join("") : `<p class="empty">Nada encontrado.</p>`;
}
$("#cCpf").addEventListener("input", e => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 11);
  e.target.value = d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
});
$("#clientForm").addEventListener("submit", e => {
  e.preventDefault();
  guard(async () => {
    await api("/clients", "POST", {
      name: $("#cName").value.trim(), email: $("#cEmail").value.trim(), cpf: $("#cCpf").value,
      phone: { ddd: $("#cDdd").value.trim(), number: $("#cPhone").value.trim(), observation: $("#cObs").value.trim() },
      addresses: {
        street: $("#aStreet").value.trim(), number: $("#aNumber").value.trim(), district: $("#aDistrict").value.trim(),
        city: $("#aCity").value.trim(), state: $("#aState").value.trim(), cep: $("#aCep").value.trim()
      }
    });
    e.target.reset(); toast("Cliente cadastrado"); show("clients-list");
  });
});

// ---- produtos ----
async function loadProducts() { db.products = list(await api("/product")); renderProducts(); }
function renderProducts() {
  const s = term("#qProducts");
  table("#productList", [["Imagem", thumb], ["Nome", p => esc(p.name)], ["Marca", p => dash(p.brand)], ["Descrição", p => esc(p.description)], ["Estoque", p => p.quantity], ["Valor", p => money(p.value)], acts("products")], db.products.filter(p => has(p.name, s) || has(p.brand, s)));
}
const CUBE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>`;
function thumb(p) {
  if (!p.model_3d) return `<span class="pthumb empty" title="Sem modelo 3D">${CUBE}</span>`;
  const url = "/models/" + encodeURIComponent(p.model_3d);
  return `<button type="button" class="pthumb" data-model="${esc(url)}" data-name="${esc(p.name)}" data-brand="${esc(p.brand || "")}" title="Clique para ver em 3D" aria-label="Ver ${esc(p.name)} em 3D">` +
    `<img src="${esc(url.replace(/\.glb$/i, ".png"))}" alt="" onerror="this.remove()">${CUBE}<b>3D</b></button>`;
}

// ---- modelo 3D (.glb) ----
async function prepare3D(file) {
  if (!/\.glb$/i.test(file.name)) throw new Error("Formato não aceito: envie um modelo 3D no formato .glb");
  if (file.size > 25 * 1024 * 1024) throw new Error("O modelo 3D deve ter no máximo 25 MB");
  const buf = await file.arrayBuffer();
  return { buf, model: await Viewer3D.parse(buf) };   // valida o conteúdo; lança erro claro se não for um .glb válido
}
// o token do login dura 15 min: se venceu, volta para o login antes de cadastrar qualquer coisa pela metade
function ensureSession() {
  const exp = jwt().exp;
  if (exp && exp * 1000 < Date.now()) { session.clear(); location.href = "login.html"; throw new Error("Sessão expirada. Entre novamente."); }
}
async function uploadRaw(path, body, type) {
  const res = await fetch(API_URL + path, { method: "POST", headers: { "Content-Type": type, Authorization: "Bearer " + session.token }, body });
  let j = {}; try { j = await res.json(); } catch {}
  if (res.status === 401) { session.clear(); location.href = "login.html"; throw new Error("Sessão expirada. Entre novamente."); }
  if (!res.ok) throw new Error(j.message || "Erro " + res.status);
}
async function attach3D(id, p) {
  await uploadRaw(`/product/${id}/model`, p.buf, "model/gltf-binary");
  try { const png = await Viewer3D.thumbnail(p.model, 320); if (png) await uploadRaw(`/product/${id}/model/thumb`, png, "image/png"); }
  catch (e) { console.warn("Miniatura não gerada:", e); }
}
let v3d = null;
async function open3D(url, name, brand) {
  const dlg = $("#v3d"), stage = $("#v3dStage"), load = $("#v3dLoad");
  $("#v3dTitle").textContent = name; $("#v3dSub").textContent = brand ? " · " + brand : "";
  stage.querySelectorAll("canvas").forEach(c => c.remove());
  load.hidden = false; load.textContent = "Carregando modelo 3D…";
  dlg.showModal();
  try {
    if (!Viewer3D.supported()) throw new Error("Seu navegador não suporta WebGL, necessário para o 3D.");
    const res = await fetch(url);
    if (!res.ok) throw new Error("Modelo 3D não encontrado.");
    const model = await Viewer3D.parse(await res.arrayBuffer());
    if (!dlg.open) return;
    const c = document.createElement("canvas"); c.tabIndex = 0; c.setAttribute("aria-label", "Modelo 3D de " + name);
    stage.prepend(c);
    v3d = Viewer3D.create(c); v3d.setModel(model); load.hidden = true;
  } catch (e) { load.textContent = e.message; }
}
document.addEventListener("click", e => { const t = e.target.closest(".pthumb[data-model]"); if (t) open3D(t.dataset.model, t.dataset.name, t.dataset.brand); });
$("#v3d").addEventListener("close", () => { if (v3d) v3d.destroy(); v3d = null; });
$("#v3dClose").onclick = () => $("#v3d").close();
$("#v3d").addEventListener("click", e => { if (e.target === $("#v3d")) $("#v3d").close(); });
$("#productForm").addEventListener("submit", e => {
  e.preventDefault();
  const msg = $("#pMsg"); msg.textContent = "";
  guard(async () => {
    const file = $("#pModel").files[0];
    let prep = null;
    if (file) ensureSession();
    try { if (file) prep = await prepare3D(file); } catch (err) { msg.textContent = err.message; return; }   // nada é cadastrado se o arquivo 3D for inválido
    const r = await api("/product", "POST", {
      name: $("#pName").value.trim(), brand: $("#pBrand").value.trim() || null, description: $("#pDesc").value.trim() || null,
      quantity: parseInt($("#pQty").value, 10), value: parseFloat($("#pValue").value)
    });
    let warn = "";
    if (prep) { try { await attach3D(r.insertId, prep); } catch (err) { warn = " Mas o modelo 3D não foi enviado: " + err.message; } }
    e.target.reset();
    warn ? toast("Produto cadastrado." + warn, true) : toast("Produto cadastrado");
    show("products-list");
  });
});

// ---- vendas ----
async function loadSales() {
  const [s, c, u] = await Promise.all([api("/sales"), safeList("/clients"), safeList("/users")]);
  db.sales = list(s); db.clients = c; db.users = withMe(u);
  renderSales();
}
function renderSales() {
  const s = term("#qSales");
  table("#saleList", [
    ["Data", v => v.date ? new Date(v.date).toLocaleString("pt-BR") : "-"],
    ["Cliente", v => esc(cname(v.id_clients))],
    ["Vendedor", v => esc(uname(v.id_users))],
    ["Pagamento", v => esc(v.payment_method)],
    ["Total", v => money(v.total)],
    acts("sales")
  ], [...db.sales].reverse().filter(v => has(cname(v.id_clients), s) || has(uname(v.id_users), s)));
}
async function prepareSale() {
  const [c, p, u] = await Promise.all([safeList("/clients"), safeList("/product"), safeList("/users")]);
  db.clients = c; db.products = p; db.users = withMe(u);
  $("#sClient").innerHTML = `<option value="">Selecione</option>` + c.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join("");
  $("#sUser").innerHTML = `<option value="">Selecione</option>` + db.users.map(x => `<option value="${x.id}">${esc(x.name || x.email)}</option>`).join("");
  if (meId() != null) $("#sUser").value = meId();
  if (!$("#items").children.length) addItem();
  else document.querySelectorAll("#items select").forEach(s => { const v = s.value; fillProducts(s); s.value = v; });
}
const fillProducts = sel =>
  sel.innerHTML = `<option value="">Produto</option>` + db.products.map(p => `<option value="${p.id}">${esc(p.name)} (${money(p.value)})</option>`).join("");

function addItem() {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<select aria-label="Produto" required></select><input type="number" min="1" step="1" value="1" aria-label="Quantidade"><span class="sub">R$ 0,00</span><button type="button" aria-label="Remover item">&times;</button>`;
  fillProducts(row.querySelector("select"));
  row.addEventListener("input", recalc);
  row.querySelector("button").onclick = () => { row.remove(); recalc(); };
  $("#items").append(row); recalc();
}
function readItems() {
  return [...document.querySelectorAll("#items .row")].map(r => {
    const p = db.products.find(p => p.id == r.querySelector("select").value);
    const q = parseInt(r.querySelector("input").value, 10) || 0;
    return p && q > 0 ? { product: p, id_products: p.id, id_services: null, quantity: q, value: Number(p.value), subtotal: +(q * p.value).toFixed(2) } : null;
  });
}
function recalc() {
  const items = readItems();
  document.querySelectorAll("#items .row").forEach((r, i) => r.querySelector(".sub").textContent = money(items[i] ? items[i].subtotal : 0));
  $("#total").textContent = money(items.reduce((t, i) => t + (i ? i.subtotal : 0), 0));
}
$("#addItem").onclick = addItem;
$("#saleForm").addEventListener("submit", e => {
  e.preventDefault();
  const items = readItems(), msg = $("#saleMsg");
  msg.textContent = "";
  if (!items.length || items.includes(null)) return msg.textContent = "Escolha o produto e a quantidade de cada item.";
  const over = items.find(i => i.quantity > i.product.quantity);
  if (over) return msg.textContent = `Estoque insuficiente para ${over.product.name}.`;
  guard(async () => {
    const total = +items.reduce((t, i) => t + i.subtotal, 0).toFixed(2);
    await api("/sales", "POST", {
      payment_method: $("#sPay").value,
      id_clients: parseInt($("#sClient").value, 10),
      id_users: parseInt($("#sUser").value, 10),
      items: items.map(({ product, ...i }) => i),
      total
    });
    $("#items").innerHTML = ""; e.target.reset(); toast("Venda registrada"); show("sales-list");
  });
});

// ---- meu perfil ----
async function loadMine() {
  const [s, c, u] = await Promise.all([api("/sales"), safeList("/clients"), safeList("/users")]);
  db.clients = c; db.users = withMe(u); db.sales = list(s);
  const mu = myUser();
  $("#userName").textContent = mu.name || mu.email || ""; applyPhoto();
  if (meId() == null) { toast("Não consegui identificar seu usuário. Mostrando todas as vendas.", true); return db.sales; }
  return db.sales.filter(v => v.id_users == meId());
}
const kpis = (el, rows) => {
  const vals = rows.map(v => Number(v.total || 0)), sum = vals.reduce((t, x) => t + x, 0);
  $(el).innerHTML = [["Vendas", rows.length], ["Faturamento", money(sum)], ["Ticket médio", money(rows.length ? sum / rows.length : 0)], ["Maior venda", money(Math.max(0, ...vals))]]
    .map(kpiHtml).join("");
};

const photoKey = () => { const u = (typeof myUser === "function" && myUser()) || {}; return "solutech_photo_" + String(u.email || u.id || "me").toLowerCase(); };
const getPhoto = () => { try { return localStorage.getItem(photoKey()); } catch { return null; } };
function applyPhoto() {
  const ph = getPhoto(), u = $(".user");
  let a = $("#sideAv");
  if (!a && u) { a = document.createElement("span"); a.id = "sideAv"; a.className = "av sm"; u.prepend(a); }
  if (a) { a.innerHTML = ph ? `<img src="${ph}" alt="Foto de perfil">` : esc(initials(myUser().name || myUser().email)); }
}
async function cropPhoto(file) {
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) throw new Error("Escolha uma imagem PNG, JPG, WEBP ou GIF.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Imagem muito grande (máximo 8 MB).");
  const bmp = await createImageBitmap(file), n = 256, c = document.createElement("canvas"); c.width = c.height = n;
  const k = Math.min(bmp.width, bmp.height), sx = (bmp.width - k) / 2, sy = (bmp.height - k) / 2;
  c.getContext("2d").drawImage(bmp, sx, sy, k, k, 0, 0, n, n);
  return c.toDataURL("image/jpeg", 0.86);
}
async function loadProfile() {
  const rows = await loadMine(), u = myUser(), by = {};
  const ph = getPhoto();
  $("#profileCard").innerHTML = `<div class="avwrap"><span class="av lg">${ph ? `<img src="${ph}" alt="Foto de perfil">` : esc(initials(u.name || u.email))}</span></div><div class="pinfo"><h3>${esc(u.name || u.email || "Vendedor")}</h3><p>${esc(u.email || "")}</p>
    <div class="pbtns"><label class="btn ghost sm" for="photoIn">${ph ? "Trocar foto" : "Enviar foto"}</label><input type="file" id="photoIn" accept="image/png,image/jpeg,image/webp,image/gif" hidden>${ph ? `<button type="button" class="act" id="photoDel">Remover</button>` : ""}</div>
    <small class="phint">A foto fica salva neste navegador.</small></div><span class="badge">Vendedor</span>`;
  applyPhoto();
  $("#photoIn").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const d = await cropPhoto(f); localStorage.setItem(photoKey(), d); toast("Foto atualizada."); loadProfile(); }
    catch (err) { toast(err.message || "Não foi possível usar essa imagem.", true); }
  };
  const del = $("#photoDel"); if (del) del.onclick = () => { try { localStorage.removeItem(photoKey()); } catch {} toast("Foto removida."); loadProfile(); };
  kpis("#kpis", rows);
  rows.forEach(v => { const k = v.payment_method || "-"; by[k] = by[k] || { n: 0, sum: 0 }; by[k].n++; by[k].sum += Number(v.total || 0); });
  table("#byPay", [["Pagamento", r => esc(r[0])], ["Vendas", r => r[1].n], ["Total", r => money(r[1].sum)]], Object.entries(by));
}

let mine = [];
const inRange = (v, fi = "#rFrom", ti = "#rTo") => {
  const f = $(fi).value, t = $(ti).value;
  if (!v.date) return !f && !t;
  const day = new Date(v.date).toLocaleDateString("sv-SE"); // AAAA-MM-DD no fuso local
  return (!f || day >= f) && (!t || day <= t);
};
async function loadReport() { mine = await loadMine(); renderReport(); }
function renderReport() {
  const rows = mine.filter(v => inRange(v)).sort((a, b) => new Date(b.date) - new Date(a.date));
  renderReport.rows = rows;
  kpis("#rKpis", rows);
  table("#reportList", [
    ["Data", v => v.date ? new Date(v.date).toLocaleString("pt-BR") : "-"],
    ["Cliente", v => esc(cname(v.id_clients))],
    ["Pagamento", v => esc(v.payment_method)],
    ["Total", v => money(v.total)]
  ], rows);
}
["#rFrom", "#rTo"].forEach(id => $(id).addEventListener("input", renderReport));
$("#rCsv").onclick = () => {
  const rows = renderReport.rows || [];
  if (!rows.length) return toast("Não há vendas no período", true);
  const q = s => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const csv = [["Data", "Cliente", "Pagamento", "Total"], ...rows.map(v => [v.date ? new Date(v.date).toLocaleString("pt-BR") : "", cname(v.id_clients), v.payment_method, Number(v.total).toFixed(2).replace(".", ",")])]
    .map(r => r.map(q).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = "relatorio-vendas.csv"; a.click(); URL.revokeObjectURL(a.href);
};

// ---- produtos vendidos ----
// Junta os itens (GET /item, ou os itens aninhados em /sales) com vendas, produtos e serviços
async function soldRows() {
  const [s, it, pr, sv, c, u] = await Promise.all([api("/sales"), safeList("/item"), safeList("/product"), safeList("/service"), safeList("/clients"), safeList("/users")]);
  db.clients = c; db.users = withMe(u); db.products = pr; db.sales = list(s);
  const nested = db.sales.flatMap(v => list(v.items).map(i => ({ ...i, id_sales: i.id_sales ?? v.id })));
  const sale = id => db.sales.find(v => v.id == id) || {};
  const name = i => i.product_name || i.name
    || (i.id_products != null ? (pr.find(p => p.id == i.id_products) || {}).name || "Produto #" + i.id_products
    : i.id_services != null ? (sv.find(x => x.id == i.id_services) || {}).name || "Serviço #" + i.id_services : "-");
  return (it.length ? it : nested)
    .map(i => { const v = sale(i.id_sales); return { ...i, date: v.date, id_clients: v.id_clients, id_users: v.id_users, item: name(i) }; })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}
const soldTable = (el, rows) => table(el, [
  ["Data", v => v.date ? new Date(v.date).toLocaleString("pt-BR") : "-"],
  ["Cliente", v => esc(cname(v.id_clients))],
  ["Vendedor", v => esc(uname(v.id_users))],
  ["Produto", v => esc(v.item)],
  ["Qtd", v => v.quantity],
  ["Valor", v => money(v.value)],
  ["Subtotal", v => money(v.subtotal)]
], rows);

let sold = [], soldMine = [];
async function loadSoldAll() { sold = await soldRows(); renderSoldAll(); }
function renderSoldAll() {
  const s = term("#qSold");
  soldTable("#soldList", sold.filter(v => has(v.item, s) || has(cname(v.id_clients), s) || has(uname(v.id_users), s)));
}
async function loadSoldMine() {
  const rows = await soldRows();
  if (meId() == null) toast("Não consegui identificar seu usuário. Mostrando todos os itens.", true);
  soldMine = meId() == null ? rows : rows.filter(v => v.id_users == meId());
  renderSoldMine();
}
function renderSoldMine() {
  const s = term("#iQ"), rows = soldMine.filter(v => inRange(v, "#iFrom", "#iTo") && has(v.item, s));
  const qty = rows.reduce((t, v) => t + Number(v.quantity || 0), 0), sum = rows.reduce((t, v) => t + Number(v.subtotal || 0), 0);
  $("#iKpis").innerHTML = [["Itens vendidos", qty], ["Produtos diferentes", new Set(rows.map(v => v.item)).size], ["Faturamento", money(sum)]]
    .map(kpiHtml).join("");
  soldTable("#iList", rows);
}
$("#qSold").addEventListener("input", renderSoldAll);
["#iFrom", "#iTo", "#iQ"].forEach(id => $(id).addEventListener("input", renderSoldMine));

$("#resetClientOrder").onclick = () => { try { localStorage.removeItem(ORDER_KEY); } catch {} renderClients(); toast("Ordem original restaurada."); };
[["#qClients", renderClients], ["#qProducts", renderProducts], ["#qSales", renderSales]].forEach(([id, fn]) => $(id).addEventListener("input", fn));
show("clients-list");

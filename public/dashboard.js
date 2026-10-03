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
    fields: () => [["name", "Nome"], ["description", "Descrição"], ["quantity", "Estoque", "number"], ["value", "Valor (R$)", "number", "0.01"]] },
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
      : `<input id="f_${k}" type="${type}" value="${esc(row[k])}"${type === "number" ? ` min="0" step="${extra || 1}"` : ""}${k === "description" ? "" : " required"}>`;
    return `<div class="fld"><label for="f_${k}">${label}</label>${input}</div>`;
  }).join("");
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
  guard(async () => { await api(`${cfg.path}/${row.id}`, cfg.method, body); $("#dlg").close(); toast("Alterações salvas"); show(VIEW[ent]); });
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

function renderClients() {
  const s = term("#qClients"), el = $("#clientList");
  const rows = db.clients.filter(c => has(c.name, s));
  const f = (l, v) => `<div><dt>${l}</dt><dd>${v || "-"}</dd></div>`;
  el.className = "cards";
  el.innerHTML = rows.length ? rows.map(c => {
    const i = info(c);
    return `<article class="cc"><h3>${esc(c.name)}</h3><dl>
      ${f("E-mail", esc(c.email))}
      ${f("CPF", esc(c.cpf))}
      ${f("Telefone", i.tel ? esc(`(${i.ddd || ""}) ${i.tel}`) : "")}
      ${f("Observação", esc(i.obs))}
      ${f("Endereço", i.street ? esc(`${i.street}, ${i.num || "s/n"} - ${i.district || ""}`) : "")}
      ${f("Cidade/UF", i.city ? esc(`${i.city}/${i.state || ""}`) : "")}
      ${f("CEP", esc(i.cep))}
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
  table("#productList", [["Nome", p => esc(p.name)], ["Descrição", p => esc(p.description)], ["Estoque", p => p.quantity], ["Valor", p => money(p.value)], acts("products")], db.products.filter(p => has(p.name, s)));
}
$("#productForm").addEventListener("submit", e => {
  e.preventDefault();
  guard(async () => {
    await api("/product", "POST", {
      name: $("#pName").value.trim(), description: $("#pDesc").value.trim() || null,
      quantity: parseInt($("#pQty").value, 10), value: parseFloat($("#pValue").value)
    });
    e.target.reset(); toast("Produto cadastrado"); show("products-list");
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
  $("#userName").textContent = mu.name || mu.email || "";
  if (meId() == null) { toast("Não consegui identificar seu usuário. Mostrando todas as vendas.", true); return db.sales; }
  return db.sales.filter(v => v.id_users == meId());
}
const kpis = (el, rows) => {
  const vals = rows.map(v => Number(v.total || 0)), sum = vals.reduce((t, x) => t + x, 0);
  $(el).innerHTML = [["Vendas", rows.length], ["Faturamento", money(sum)], ["Ticket médio", money(rows.length ? sum / rows.length : 0)], ["Maior venda", money(Math.max(0, ...vals))]]
    .map(([l, v]) => `<div class="kpi"><span>${l}</span><strong>${v}</strong></div>`).join("");
};

async function loadProfile() {
  const rows = await loadMine(), u = myUser(), by = {};
  $("#profileCard").innerHTML = `<h3>${esc(u.name || u.email || "Vendedor")}</h3><p>${esc(u.email || "")}</p>`;
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
    .map(([l, v]) => `<div class="kpi"><span>${l}</span><strong>${v}</strong></div>`).join("");
  soldTable("#iList", rows);
}
$("#qSold").addEventListener("input", renderSoldAll);
["#iFrom", "#iTo", "#iQ"].forEach(id => $(id).addEventListener("input", renderSoldMine));

[["#qClients", renderClients], ["#qProducts", renderProducts], ["#qSales", renderSales]].forEach(([id, fn]) => $(id).addEventListener("input", fn));
show("clients-list");

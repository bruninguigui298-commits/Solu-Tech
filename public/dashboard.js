if (!session.token) location.replace("login.html");

const $ = s => document.querySelector(s);
const money = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toast = (msg, err) => {
  const t = $("#toast"); t.textContent = msg; t.className = "show" + (err ? " err" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.className = "", 3500);
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
const withMe = u => u.length || !session.user ? u : [session.user];
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
  "sales-list": loadSales, "sales-new": prepareSale
};
$("#userName").textContent = (session.user && (session.user.name || session.user.email)) || "";
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
function renderClients() {
  const s = term("#qClients");
  table("#clientList", [["Nome", c => esc(c.name)], ["E-mail", c => esc(c.email)], ["CPF", c => esc(c.cpf)], acts("clients")], db.clients.filter(c => has(c.name, s)));
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
  if (session.user && session.user.id) $("#sUser").value = session.user.id;
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

[["#qClients", renderClients], ["#qProducts", renderProducts], ["#qSales", renderSales]].forEach(([id, fn]) => $(id).addEventListener("input", fn));
show("clients-list");

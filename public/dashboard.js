if (!session.token) location.replace("login.html");

const $ = s => document.querySelector(s);
const money = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toast = (msg, err) => {
  const t = $("#toast"); t.textContent = msg; t.className = "show" + (err ? " err" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.className = "", 3500);
};
// aceita lista direta ou objeto com uma lista dentro (ex.: { clientes: [...] })
const list = d => Array.isArray(d) ? d : (d && Object.values(d).find(Array.isArray)) || [];
const table = (el, cols, rows) => {
  $(el).innerHTML = rows.length
    ? `<table><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${c[1](r)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
    : `<p class="empty">Nada cadastrado ainda.</p>`;
};
async function guard(fn) { try { await fn(); } catch (e) { toast(e.message, true); } }

let clients = [], products = [];

// ---- navegação ----
const views = {
  "clients-list": loadClients,
  "clients-new": async () => {},
  "products-list": loadProducts,
  "products-new": async () => {},
  "sales-list": loadSales,
  "sales-new": prepareSale
};
$("#userName").textContent = (session.user && (session.user.name || session.user.email)) || "";
$("#logout").onclick = () => { session.clear(); location.href = "login.html"; };
document.querySelectorAll("nav button").forEach(b => b.onclick = () => show(b.dataset.view));
function show(view) {
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll("section").forEach(s => s.classList.toggle("on", s.id === "view-" + view));
  guard(views[view]);
}

// ---- clientes ----
async function loadClients() {
  clients = list(await api("/clients"));
  table("#clientList", [["Nome", c => esc(c.name)], ["E-mail", c => esc(c.email)], ["CPF", c => esc(c.cpf)]], clients);
}
$("#cCpf").addEventListener("input", e => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 11);
  e.target.value = d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
});
$("#clientForm").addEventListener("submit", e => {
  e.preventDefault();
  guard(async () => {
    await api("/clients", "POST", {
      name: $("#cName").value.trim(),
      email: $("#cEmail").value.trim(),
      cpf: $("#cCpf").value,
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
async function loadProducts() {
  products = list(await api("/product"));
  table("#productList", [["Nome", p => esc(p.name)], ["Descrição", p => esc(p.description)], ["Estoque", p => p.quantity], ["Valor", p => money(p.value)]], products);
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
  const [sales, cl] = await Promise.all([api("/sales"), api("/clients")]);
  clients = list(cl);
  const name = id => (clients.find(c => c.id === id) || {}).name || "#" + id;
  table("#saleList", [
    ["Data", s => s.date ? new Date(s.date).toLocaleString("pt-BR") : "-"],
    ["Cliente", s => esc(name(s.id_clients))],
    ["Pagamento", s => esc(s.payment_method)],
    ["Total", s => money(s.total)]
  ], [...list(sales)].reverse());
}
async function prepareSale() {
  const [cl, pr] = await Promise.all([api("/clients"), api("/product")]);
  clients = list(cl); products = list(pr);
  $("#sClient").innerHTML = `<option value="">Selecione</option>` + clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  if (!$("#items").children.length) addItem();
  else document.querySelectorAll("#items select").forEach(s => { const v = s.value; fillProducts(s); s.value = v; });
}
const fillProducts = sel =>
  sel.innerHTML = `<option value="">Produto</option>` + products.map(p => `<option value="${p.id}">${esc(p.name)} (${money(p.value)})</option>`).join("");

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
    const p = products.find(p => p.id == r.querySelector("select").value);
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
      id_users: session.user && session.user.id,
      items: items.map(({ product, ...i }) => i),
      total
    });
    $("#items").innerHTML = ""; e.target.reset(); toast("Venda registrada"); show("sales-list");
  });
});

show("clients-list");

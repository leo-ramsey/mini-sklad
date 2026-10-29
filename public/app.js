"use strict";

// ---------------------------------------------------------------- переводы
const T = {
  ru: {
    title: "Мини-склад", login_h: "Вход в систему", login_p: "Учёт товаров на складе BMS Smart Home",
    login: "Логин", password: "Пароль", enter: "Войти", logout: "Выйти", demo: "Тестовые пользователи:",
    stock: "Остатки", products: "Товары", history: "История", stock_h: "Остатки на складе",
    products_h: "Товары", history_h: "История операций", search: "Поиск по названию",
    btn_in: "Приход", btn_out: "Выдача", excel: "Excel", total: "Итого",
    c_product: "Товар", c_unit: "Ед.", c_stock: "Остаток", c_price: "Цена", c_sum: "Сумма",
    c_when: "Когда", c_who: "Кто", c_op: "Операция", c_qty: "Кол-во", c_obj: "Объект", c_comment: "Комментарий",
    c_status: "Статус",
    UZS: "Сумы", USD: "Доллары", CNY: "Юани",
    role_director: "Руководитель", role_storekeeper: "Кладовщик", role_manager: "Менеджер",
    pcs: "шт", m: "м", pcs_full: "штуки", m_full: "метры",
    k_in: "приход", k_out: "выдача", k_cancel: "отмена",
    cancel_of_in: "отмена прихода №", cancel_of_out: "отмена выдачи №",
    cancelled: "отменено", op_no: "№",
    nothing: "Ничего не найдено", no_products: "Товаров пока нет", no_ops: "Операций пока нет",
    in_h: "Приход на склад", out_h: "Выдача на объект",
    f_product: "Товар", f_qty: "Количество", f_object: "Объект — адрес или имя клиента",
    f_comment: "Комментарий", optional: "Необязательно", ph_in_comment: "Например: от поставщика Ali",
    ph_object: "Например: Юнусабад, кв. 12", on_stock: "на складе",
    hint_pcs: "Только целое число: 1, 2, 3", hint_m: "Можно дробное: 12,5",
    save: "Сохранить", cancel: "Отмена", close: "Закрыть", choose: "— выберите товар —",
    add_product: "Новый товар", edit_product: "Изменить товар", f_name: "Название",
    ph_name: "Например: Выключатель Livolo белый", f_unit: "Единица", f_price: "Цена за единицу",
    f_currency: "Валюта", edit: "Изменить", archive: "В архив", unarchive: "Из архива",
    del: "Удалить", archived: "в архиве", active: "активен",
    unit_locked: "Единицу нельзя сменить — по товару уже были движения",
    cancel_op: "Отменить", cancel_q: "Отменить операцию?",
    cancel_text: "Операция останется в истории с пометкой «отменено», остаток пересчитается.",
    yes_cancel: "Да, отменить", del_q: "Удалить товар?", del_text: "Товар без движений будет удалён насовсем.",
    saved: "Сохранено", done_in: "Приход записан", done_out: "Выдача записана", done_cancel: "Операция отменена",
    net: "Нет связи с сервером. Проверьте, что программа запущена, и попробуйте ещё раз.",
    bad_resp: "Сервер ответил непонятно. Обновите страницу и попробуйте ещё раз.",
    need_product: "Выберите товар.", need_name: "Введите название товара.",
    need_qty: "Введите количество.", need_object: "Укажите объект: адрес или имя клиента.",
    need_price: "Введите цену за единицу.",
  },
  uz: {
    title: "Mini-ombor", login_h: "Tizimga kirish", login_p: "BMS Smart Home omboridagi mahsulotlar hisobi",
    login: "Login", password: "Parol", enter: "Kirish", logout: "Chiqish", demo: "Test foydalanuvchilar:",
    stock: "Qoldiqlar", products: "Mahsulotlar", history: "Tarix", stock_h: "Ombordagi qoldiqlar",
    products_h: "Mahsulotlar", history_h: "Amallar tarixi", search: "Nomi bo‘yicha qidirish",
    btn_in: "Kirim", btn_out: "Chiqim", excel: "Excel", total: "Jami",
    c_product: "Mahsulot", c_unit: "Birlik", c_stock: "Qoldiq", c_price: "Narx", c_sum: "Summa",
    c_when: "Qachon", c_who: "Kim", c_op: "Amal", c_qty: "Miqdor", c_obj: "Obyekt", c_comment: "Izoh",
    c_status: "Holat",
    UZS: "So‘m", USD: "Dollar", CNY: "Yuan",
    role_director: "Rahbar", role_storekeeper: "Omborchi", role_manager: "Menejer",
    pcs: "dona", m: "m", pcs_full: "dona", m_full: "metr",
    k_in: "kirim", k_out: "chiqim", k_cancel: "bekor",
    cancel_of_in: "kirim bekor qilindi №", cancel_of_out: "chiqim bekor qilindi №",
    cancelled: "bekor qilingan", op_no: "№",
    nothing: "Hech narsa topilmadi", no_products: "Hozircha mahsulot yo‘q", no_ops: "Hozircha amallar yo‘q",
    in_h: "Omborga kirim", out_h: "Obyektga chiqim",
    f_product: "Mahsulot", f_qty: "Miqdor", f_object: "Obyekt — manzil yoki mijoz ismi",
    f_comment: "Izoh", optional: "Majburiy emas", ph_in_comment: "Masalan: Ali yetkazib beruvchidan",
    ph_object: "Masalan: Yunusobod, 12-xonadon", on_stock: "omborda",
    hint_pcs: "Faqat butun son: 1, 2, 3", hint_m: "Kasr bo‘lishi mumkin: 12,5",
    save: "Saqlash", cancel: "Bekor", close: "Yopish", choose: "— mahsulotni tanlang —",
    add_product: "Yangi mahsulot", edit_product: "Mahsulotni tahrirlash", f_name: "Nomi",
    ph_name: "Masalan: Livolo oq o‘chirgich", f_unit: "Birlik", f_price: "Birlik narxi",
    f_currency: "Valyuta", edit: "Tahrirlash", archive: "Arxivga", unarchive: "Arxivdan",
    del: "O‘chirish", archived: "arxivda", active: "faol",
    unit_locked: "Birlikni o‘zgartirib bo‘lmaydi — harakatlar bo‘lgan",
    cancel_op: "Bekor qilish", cancel_q: "Amalni bekor qilasizmi?",
    cancel_text: "Amal tarixda «bekor qilingan» belgisi bilan qoladi, qoldiq qayta hisoblanadi.",
    yes_cancel: "Ha, bekor qilish", del_q: "Mahsulotni o‘chirasizmi?", del_text: "Harakatsiz mahsulot butunlay o‘chiriladi.",
    saved: "Saqlandi", done_in: "Kirim yozildi", done_out: "Chiqim yozildi", done_cancel: "Amal bekor qilindi",
    net: "Server bilan aloqa yo‘q. Dastur ishga tushganini tekshirib, qayta urinib ko‘ring.",
    bad_resp: "Server tushunarsiz javob berdi. Sahifani yangilab, qayta urinib ko‘ring.",
    need_product: "Mahsulotni tanlang.", need_name: "Mahsulot nomini kiriting.",
    need_qty: "Miqdorni kiriting.", need_object: "Obyektni kiriting: manzil yoki mijoz ismi.",
    need_price: "Birlik narxini kiriting.",
  },
};
const CUR = { UZS: { ru: "сум", uz: "so‘m" }, USD: { ru: "$", uz: "$" }, CNY: { ru: "¥", uz: "¥" } };

const S = { me: null, view: "stock", lang: loadLang(), q: "", stock: null, products: null, history: null };

function loadLang() { try { return localStorage.getItem("lang") === "uz" ? "uz" : "ru"; } catch { return "ru"; } }
function t(k) { return T[S.lang][k] ?? k; }
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------------------------------------------------------------- числа
// Сервер присылает числа строками ('69.5', '55.60') — никакой float-арифметики в браузере.
function groupInt(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0"); }
function fmtQty(s) { const [i, f] = String(s).split("."); return groupInt(i) + (f ? "," + f : ""); }
function fmtMoney(s, cur) {
  let [i, f = "00"] = String(s).split(".");
  const num = groupInt(i) + (f === "00" ? "" : "," + f.padEnd(2, "0"));
  return num + "\u00a0" + CUR[cur][S.lang];
}
function fmtTime(s) {
  // '2026-10-29 14:05:12' → '29.10.2026 14:05'
  const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)/.exec(s || "");
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}` : esc(s);
}
const isZero = (s) => /^0(\.0*)?$/.test(String(s));

// ---------------------------------------------------------------- API
async function api(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method, credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Lang": S.lang },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw new Error(t("net")); }
  let data;
  try { data = await res.json(); } catch { throw new Error(t("bad_resp")); }
  if (res.status === 401 && url !== "/api/login" && url !== "/api/me") { S.me = null; render(); }
  if (!res.ok) { const e = new Error(data.error || t("bad_resp")); e.code = data.code; throw e; }
  return data;
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toast.tm); toast.tm = setTimeout(() => el.classList.remove("show"), 2600);
}

const can = {
  prices: () => S.me && S.me.role !== "storekeeper",
  ops: () => S.me && S.me.role !== "manager",
  products: () => S.me && S.me.role === "director",
  history: () => S.me && S.me.role !== "storekeeper",
  cancel: () => S.me && S.me.role === "director",
};

// ---------------------------------------------------------------- отрисовка
function render() {
  document.documentElement.lang = S.lang;
  document.title = t("title");
  const app = $("#app");
  if (!S.me) { app.innerHTML = loginView(); bindLogin(); return; }
  if (!navItems().some((n) => n.id === S.view)) S.view = "stock";
  app.innerHTML = shellView();
  bindShell();
  loadView();
}

function langSwitch() {
  return `<span class="lang">${["ru", "uz"].map((l) =>
    `<button type="button" data-lang="${l}" class="${S.lang === l ? "on" : ""}">${l.toUpperCase()}</button>`).join("")}</span>`;
}

function loginView() {
  return `<div class="login"><form class="card" id="loginForm" novalidate>
    <div style="display:flex;justify-content:space-between;align-items:center"><div class="logo"><i>▦</i>${t("title")}</div>${langSwitch()}</div>
    <h1>${t("login_h")}</h1><p>${t("login_p")}</p>
    <label class="l" for="lg">${t("login")}</label><input class="f" id="lg" autocomplete="username" autocapitalize="none" required>
    <label class="l" for="pw">${t("password")}</label><input class="f" id="pw" type="password" autocomplete="current-password" maxlength="200" required>
    <div class="err" id="lerr"></div>
    <button class="btn btn-pri btn-block" id="lbtn">${t("enter")}</button>
  </form></div>`;
}

function bindLogin() {
  bindLang();
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#lbtn"); if (btn.disabled) return;
    btn.disabled = true; $("#lerr").textContent = "";
    try {
      const r = await api("POST", "/api/login", { login: $("#lg").value, password: $("#pw").value });
      S.me = r.user; S.view = "stock"; render();
    } catch (err) { $("#lerr").textContent = err.message; btn.disabled = false; }
  });
}

function bindLang() {
  document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => {
    S.lang = b.dataset.lang; try { localStorage.setItem("lang", S.lang); } catch {}
    render();
  }));
}

function navItems() {
  const items = [{ id: "stock", ic: "▤", label: t("stock") }];
  if (can.products()) items.push({ id: "products", ic: "◫", label: t("products") });
  if (can.history()) items.push({ id: "history", ic: "↻", label: t("history") });
  return items;
}

function shellView() {
  const nav = navItems();
  const role = t("role_" + S.me.role);
  return `<div class="shell">
    <aside><div class="logo"><i>▦</i>${t("title")}</div>
      ${nav.map((n) => `<a data-view="${n.id}" class="${S.view === n.id ? "on" : ""}">${n.ic}&nbsp; ${n.label}</a>`).join("")}
      <span class="sp"></span>
      <div class="who"><b>${role}</b>${esc(S.me.login)} · <button data-logout>${t("logout")}</button></div>
    </aside>
    <div class="mtop"><div class="logo"><i>▦</i>${t("title")}</div><span class="role">${role}</span>${langSwitch()}</div>
    <main id="main"></main>
    <nav class="tabbar">
      ${nav.map((n) => `<a data-view="${n.id}" class="${S.view === n.id ? "on" : ""}"><i>${n.ic}</i>${n.label}</a>`).join("")}
      <a data-logout><i>⎋</i>${t("logout")}</a>
    </nav>
  </div>`;
}

function bindShell() {
  bindLang();
  document.querySelectorAll("[data-view]").forEach((a) => a.addEventListener("click", () => {
    S.view = a.dataset.view; render(); window.scrollTo(0, 0);
  }));
  document.querySelectorAll("[data-logout]").forEach((b) => b.addEventListener("click", async () => {
    try { await api("POST", "/api/logout", {}); } catch {}
    S.me = null; render();
  }));
}

function topBar(title, extra = "") {
  return `<div class="top"><h1>${title}</h1><span class="desk-only">${langSwitch()}</span>${extra}</div>`;
}

async function loadView() {
  const main = $("#main");
  try {
    if (S.view === "stock") { S.stock = await api("GET", "/api/stock"); }
    if (S.view === "products") { S.products = await api("GET", "/api/products"); }
    if (S.view === "history") { S.history = await api("GET", "/api/history"); }
  } catch (err) {
    main.innerHTML = topBar(t(S.view + "_h")) + `<div class="err">⚠ ${esc(err.message)}</div>`;
    bindLang(); return;
  }
  drawView();
}

function drawView() {
  const main = $("#main");
  if (S.view === "stock") main.innerHTML = stockView();
  if (S.view === "products") main.innerHTML = productsView();
  if (S.view === "history") main.innerHTML = historyView();
  bindLang();
  bindView();
}

// ---------------------------------------------------------------- остатки
function stockRows() {
  const q = S.q.trim().toLowerCase();
  return S.stock.items.filter((i) => !q || i.name.toLowerCase().includes(q));
}

function stockView() {
  const prices = can.prices();
  const d = S.stock;
  let stats = "";
  if (prices) {
    stats = `<div class="stats">${Object.entries(d.totals).map(([c, v]) =>
      `<div class="stat"><small>${t(c)}</small><div class="num">${fmtMoney(v, c)}</div></div>`).join("")}</div>`;
  }
  const tools = `<div class="tools">
    <label class="search">⌕<input id="q" placeholder="${t("search")}" value="${esc(S.q)}" autocomplete="off"></label>
    ${can.ops() ? `<button class="btn btn-in" data-op="in">＋ ${t("btn_in")}</button><button class="btn btn-out" data-op="out">− ${t("btn_out")}</button>` : ""}
    <a class="btn btn-gh" href="/api/stock.xlsx?lang=${S.lang}" download>⭳ ${t("excel")}</a>
  </div>`;
  return topBar(t("stock_h")) + stats + `<div class="panel">${tools}<div id="stockList">${stockList()}</div></div>`;
}

function stockList() {
  const prices = can.prices();
  const rows = stockRows();
  if (!rows.length) return `<div class="empty">${S.stock.items.length ? t("nothing") : t("no_products")}</div>`;
  const totals = prices ? Object.entries(S.stock.totals).map(([c, v]) => `<span>${fmtMoney(v, c)}</span>`).join("") : "";
  const table = `<table><thead><tr><th>${t("c_product")}</th><th>${t("c_unit")}</th><th class="n">${t("c_stock")}</th>
      ${prices ? `<th class="n">${t("c_price")}</th><th class="n">${t("c_sum")}</th>` : ""}</tr></thead>
    <tbody>${rows.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td><span class="u">${t(r.unit)}</span></td>
      <td class="n ${isZero(r.stock) ? "zero" : ""}">${fmtQty(r.stock)}</td>
      ${prices ? `<td class="n">${fmtMoney(r.price, r.currency)}</td><td class="n"><b>${fmtMoney(r.sum, r.currency)}</b></td>` : ""}</tr>`).join("")}</tbody>
    ${prices ? `<tfoot><tr><td>${t("total")}</td><td colspan="4"><div class="tot">${totals}</div></td></tr></tfoot>` : ""}</table>`;
  const cards = `<div class="cards">${rows.map((r) => `<div class="card"><div class="h"><b>${esc(r.name)}</b>
      <span class="q num ${isZero(r.stock) ? "zero" : ""}">${fmtQty(r.stock)} <span class="u">${t(r.unit)}</span></span></div>
      ${prices ? `<div class="m"><span>${t("c_price")}: ${fmtMoney(r.price, r.currency)}</span><span>${t("c_sum")}: <b style="color:var(--ink)">${fmtMoney(r.sum, r.currency)}</b></span></div>` : ""}
    </div>`).join("")}
    ${prices ? `<div class="tot-m"><b>${t("total")}:</b> <div class="tot" style="justify-content:flex-start;margin-top:6px">${totals}</div></div>` : ""}</div>`;
  return table + cards;
}

// ---------------------------------------------------------------- товары
function productsView() {
  const rows = S.products.items;
  const extra = `<button class="btn btn-pri" data-newp>＋ ${t("add_product")}</button>`;
  if (!rows.length) return topBar(t("products_h"), extra) + `<div class="panel"><div class="empty">${t("no_products")}</div></div>`;
  const acts = (p) => `<button class="btn btn-gh btn-sm" data-editp="${p.id}">${t("edit")}</button>
      <button class="btn btn-gh btn-sm" data-arch="${p.id}" data-to="${p.archived ? 0 : 1}">${p.archived ? t("unarchive") : t("archive")}</button>
      ${p.has_moves ? "" : `<button class="btn btn-danger btn-sm" data-delp="${p.id}">${t("del")}</button>`}`;
  const status = (p) => p.archived ? `<span class="pill p-arch">${t("archived")}</span>` : `<span class="pill p-in">${t("active")}</span>`;
  return topBar(t("products_h"), extra) + `<div class="panel">
    <table><thead><tr><th>${t("c_product")}</th><th>${t("c_unit")}</th><th class="n">${t("c_price")}</th><th class="n">${t("c_stock")}</th><th>${t("c_status")}</th><th></th></tr></thead>
    <tbody>${rows.map((p) => `<tr><td><b>${esc(p.name)}</b></td><td><span class="u">${t(p.unit)}</span></td>
      <td class="n">${fmtMoney(p.price, p.currency)}</td><td class="n">${fmtQty(p.stock)}</td><td>${status(p)}</td>
      <td><div class="acts">${acts(p)}</div></td></tr>`).join("")}</tbody></table>
    <div class="cards">${rows.map((p) => `<div class="card"><div class="h"><b>${esc(p.name)}</b>${status(p)}</div>
      <div class="m"><span>${fmtMoney(p.price, p.currency)} / ${t(p.unit)}</span><span>${t("c_stock")}: ${fmtQty(p.stock)} ${t(p.unit)}</span></div>
      <div class="a">${acts(p)}</div></div>`).join("")}</div></div>`;
}

// ---------------------------------------------------------------- история
function opLabel(o) {
  const cls = { in: "p-in", out: "p-out", cancel: "p-c" }[o.kind];
  return `<span class="pill ${cls}">${t("k_" + o.kind)}</span>`;
}
function opNote(o) {
  if (o.kind === "cancel") return `<span class="note">${t("cancel_of_" + o.cancel_of_kind)}${o.cancel_of}</span>`;
  return esc(o.comment);
}
// Пользователи встроенные, поэтому имя = роль; показываем её на текущем языке.
const who = (role, name) => (role ? t("role_" + role) : esc(name));
function cancelledMark(o) {
  return o.cancelled_at ? `<span class="note">${t("cancelled")}: ${who(o.cancelled_by_role, o.cancelled_by)}, ${fmtTime(o.cancelled_at)}</span>` : "";
}
function cancelBtn(o) {
  return can.cancel() && o.kind !== "cancel" && !o.cancelled_at
    ? `<button class="btn btn-gh btn-sm" data-cancel="${o.id}">${t("cancel_op")}</button>` : "";
}

function historyView() {
  const rows = S.history.items;
  if (!rows.length) return topBar(t("history_h")) + `<div class="panel"><div class="empty">${t("no_ops")}</div></div>`;
  return topBar(t("history_h")) + `<div class="panel"><div class="err" id="herr"></div>
    <table><thead><tr><th>${t("op_no")}</th><th>${t("c_when")}</th><th>${t("c_who")}</th><th>${t("c_op")}</th><th>${t("c_product")}</th>
      <th class="n">${t("c_qty")}</th><th>${t("c_obj")}</th><th>${t("c_comment")}</th><th></th></tr></thead>
    <tbody>${rows.map((o) => `<tr class="${o.cancelled_at ? "x" : ""}">
      <td class="note">${o.id}</td><td style="white-space:nowrap">${fmtTime(o.created)}</td><td>${who(o.user_role, o.user)}</td>
      <td class="keep">${opLabel(o)}</td><td>${esc(o.product)}</td>
      <td class="n">${fmtQty(o.qty)} ${t(o.unit)}</td><td>${esc(o.object) || "—"}</td><td>${opNote(o)}</td>
      <td class="keep n">${cancelledMark(o)}${cancelBtn(o)}</td></tr>`).join("")}</tbody></table>
    <div class="cards">${rows.map((o) => `<div class="card ${o.cancelled_at ? "x" : ""}">
      <div class="h"><b class="strike">${esc(o.product)}</b>${opLabel(o)}</div>
      <div class="m"><span class="strike num" style="color:var(--ink);font-weight:600">${fmtQty(o.qty)} ${t(o.unit)}</span>
        ${o.object ? `<span class="strike">${esc(o.object)}</span>` : ""}</div>
      <div class="m"><span>№${o.id} · ${fmtTime(o.created)} · ${who(o.user_role, o.user)}</span>${o.comment || o.kind === "cancel" ? `<span>${opNote(o)}</span>` : ""}</div>
      ${o.cancelled_at ? `<div class="m">${cancelledMark(o)}</div>` : ""}
      ${cancelBtn(o) ? `<div class="a">${cancelBtn(o)}</div>` : ""}</div>`).join("")}</div></div>`;
}

// ---------------------------------------------------------------- события экрана
function bindView() {
  const q = $("#q");
  if (q) q.addEventListener("input", () => { S.q = q.value; $("#stockList").innerHTML = stockList(); });
  document.querySelectorAll("[data-op]").forEach((b) => b.addEventListener("click", () => openOp(b.dataset.op)));
  const np = $("[data-newp]"); if (np) np.addEventListener("click", () => openProduct(null));
  document.querySelectorAll("[data-editp]").forEach((b) => b.addEventListener("click", () =>
    openProduct(S.products.items.find((p) => p.id == b.dataset.editp))));
  document.querySelectorAll("[data-arch]").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try { await api("POST", `/api/products/${b.dataset.arch}/archive`, { archived: b.dataset.to === "1" }); toast(t("saved")); loadView(); }
    catch (err) { toast(err.message); b.disabled = false; }
  }));
  document.querySelectorAll("[data-delp]").forEach((b) => b.addEventListener("click", () =>
    confirmBox(t("del_q"), t("del_text"), t("del"), async () => {
      await api("DELETE", `/api/products/${b.dataset.delp}`); toast(t("saved")); loadView();
    })));
  document.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", () =>
    confirmBox(`${t("cancel_q")} №${b.dataset.cancel}`, t("cancel_text"), t("yes_cancel"), async () => {
      await api("POST", `/api/ops/${b.dataset.cancel}/cancel`, {}); toast(t("done_cancel")); loadView();
    })));
}

// ---------------------------------------------------------------- окна
function modal(html) {
  const dim = document.createElement("div");
  dim.className = "dim";
  dim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  document.body.appendChild(dim);
  const close = () => { dim.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  dim.addEventListener("mousedown", (e) => { if (e.target === dim) close(); });
  dim.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  return { el: dim, close };
}

// Отправка формы: кнопка блокируется сразу, а одинаковый key не даст серверу записать операцию дважды.
function submitOnce(form, btn, errBox, fn) {
  let busy = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true; btn.disabled = true; errBox.textContent = "";
    form.querySelectorAll(".bad").forEach((x) => x.classList.remove("bad"));
    try { await fn(); }
    catch (err) {
      errBox.innerHTML = `⚠ <div>${esc(err.message)}</div>`;
      if (err.field) { const f = form.querySelector(err.field); if (f) { f.classList.add("bad"); f.focus(); } }
      busy = false; btn.disabled = false;
    }
  });
}
function fieldErr(msg, field) { const e = new Error(msg); e.field = field; return e; }
function newKey() {
  try { return crypto.randomUUID(); } catch { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
}

async function openOp(kind) {
  let items;
  try { items = (await api("GET", "/api/stock")).items; } catch (err) { toast(err.message); return; }
  const key = newKey();
  const out = kind === "out";
  const m = modal(`<form id="opForm" novalidate>
    <h3>${out ? t("out_h") : t("in_h")}</h3>
    <label class="l" for="opP">${t("f_product")}</label>
    <select class="f" id="opP"><option value="">${t("choose")}</option>
      ${items.map((i) => `<option value="${i.id}">${esc(i.name)} — ${fmtQty(i.stock)} ${t(i.unit)} ${t("on_stock")}</option>`).join("")}</select>
    <label class="l" for="opQ">${t("f_qty")} <span id="opU"></span></label>
    <input class="f num" id="opQ" inputmode="decimal" autocomplete="off"><div class="hint" id="opH"></div>
    ${out ? `<label class="l" for="opO">${t("f_object")} *</label><input class="f" id="opO" placeholder="${t("ph_object")}" maxlength="500">` : ""}
    <label class="l" for="opC">${t("f_comment")}</label>
    <input class="f" id="opC" placeholder="${out ? t("optional") : t("ph_in_comment")}" maxlength="500">
    <div class="err" id="opE"></div>
    <div class="foot"><button class="btn btn-pri" id="opS">${t("save")}</button><button type="button" class="btn btn-gh" data-close>${t("cancel")}</button></div>
  </form>`);
  const sel = $("#opP", m.el);
  const syncUnit = () => {
    const it = items.find((i) => i.id == sel.value);
    $("#opU", m.el).textContent = it ? `(${t(it.unit)})` : "";
    $("#opH", m.el).textContent = it ? t(it.unit === "pcs" ? "hint_pcs" : "hint_m") : "";
  };
  sel.addEventListener("change", syncUnit);
  sel.focus();
  submitOnce($("#opForm", m.el), $("#opS", m.el), $("#opE", m.el), async () => {
    const qty = $("#opQ", m.el).value.trim();
    const obj = out ? $("#opO", m.el).value.trim() : "";
    if (!sel.value) throw fieldErr(t("need_product"), "#opP");
    if (!qty) throw fieldErr(t("need_qty"), "#opQ");
    if (out && !obj) throw fieldErr(t("need_object"), "#opO");
    try {
      await api("POST", "/api/ops", { kind, product_id: Number(sel.value), qty, object: obj, comment: $("#opC", m.el).value, key });
    } catch (err) {
      const f = { not_enough: "#opQ", qty_bad: "#opQ", qty_int: "#opQ", qty_frac: "#opQ", qty_big: "#opQ", object_need: "#opO" }[err.code];
      err.field = f; throw err;
    }
    m.close(); toast(out ? t("done_out") : t("done_in")); loadView();
  });
}

function openProduct(p) {
  const locked = p && p.has_moves;
  const st = { unit: p ? p.unit : "pcs", currency: p ? p.currency : "UZS" };
  const m = modal(`<form id="pForm" novalidate>
    <h3>${p ? t("edit_product") : t("add_product")}</h3>
    <label class="l" for="pN">${t("f_name")} *</label><input class="f" id="pN" maxlength="200" placeholder="${t("ph_name")}" value="${esc(p ? p.name : "")}">
    <label class="l">${t("f_unit")}</label>
    <div class="seg" id="pU">${["pcs", "m"].map((u) => `<button type="button" data-v="${u}" ${locked ? "disabled" : ""}>${t(u + "_full")}</button>`).join("")}</div>
    ${locked ? `<div class="hint">${t("unit_locked")}</div>` : ""}
    <div class="row2"><div><label class="l" for="pP">${t("f_price")} *</label><input class="f num" id="pP" inputmode="decimal" placeholder="0,80" value="${p ? fmtQty(p.price).replace(/\u00a0/g, "") : ""}"></div>
    <div><label class="l">${t("f_currency")}</label><select class="f" id="pC">${["UZS", "USD", "CNY"].map((c) =>
      `<option value="${c}" ${st.currency === c ? "selected" : ""}>${t(c)} (${CUR[c][S.lang]})</option>`).join("")}</select></div></div>
    <div class="err" id="pE"></div>
    <div class="foot"><button class="btn btn-pri" id="pS">${t("save")}</button><button type="button" class="btn btn-gh" data-close>${t("cancel")}</button></div>
  </form>`);
  const seg = $("#pU", m.el);
  const syncSeg = () => seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === st.unit));
  seg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { st.unit = b.dataset.v; syncSeg(); }));
  syncSeg();
  $("#pN", m.el).focus();
  submitOnce($("#pForm", m.el), $("#pS", m.el), $("#pE", m.el), async () => {
    const name = $("#pN", m.el).value.trim(), price = $("#pP", m.el).value.trim();
    if (!name) throw fieldErr(t("need_name"), "#pN");
    if (!price) throw fieldErr(t("need_price"), "#pP");
    const body = { name, unit: st.unit, price, currency: $("#pC", m.el).value };
    try {
      if (p) await api("PUT", `/api/products/${p.id}`, body); else await api("POST", "/api/products", body);
    } catch (err) {
      err.field = err.code && err.code.startsWith("price") ? "#pP" : err.code && err.code.startsWith("name") ? "#pN" : null;
      throw err;
    }
    m.close(); toast(t("saved")); loadView();
  });
}

function confirmBox(title, text, okLabel, fn) {
  const m = modal(`<form id="cf"><h3>${esc(title)}</h3><p class="note" style="font-size:14px">${esc(text)}</p>
    <div class="err" id="cfE"></div>
    <div class="foot"><button class="btn btn-pri" id="cfS">${esc(okLabel)}</button><button type="button" class="btn btn-gh" data-close>${t("close")}</button></div></form>`);
  submitOnce($("#cf", m.el), $("#cfS", m.el), $("#cfE", m.el), async () => { await fn(); m.close(); });
}

// ---------------------------------------------------------------- старт
(async function start() {
  try { S.me = (await api("GET", "/api/me")).user; } catch { S.me = null; }
  render();
})();

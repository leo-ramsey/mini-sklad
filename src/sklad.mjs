// Мини-склад: вся бизнес-логика и HTTP-API. Работает в Netlify Functions,
// данные хранятся одним JSON-документом в Netlify Blobs.
import crypto from "node:crypto";

// Количество хранится в тысячных долях единицы, цена — в сотых (центы/тийины).
// Только целые числа → никаких ошибок округления (0,10 $ × 3 = ровно 0,30 $).
const QS = 1000;
const PS = 100;

const UNITS = ["pcs", "m"];
const CURRENCIES = ["UZS", "USD", "CNY"];

const DIRECTOR = "director", STOREKEEPER = "storekeeper", MANAGER = "manager";
const ALL = [DIRECTOR, STOREKEEPER, MANAGER];
const SEE_PRICES = [DIRECTOR, MANAGER];
const DO_OPS = [DIRECTOR, STOREKEEPER];
const SEE_HISTORY = [DIRECTOR, MANAGER];

export const DEFAULT_USERS = [
  ["director", "director123", DIRECTOR, "Руководитель"],
  ["sklad", "sklad123", STOREKEEPER, "Кладовщик"],
  ["manager", "manager123", MANAGER, "Менеджер"],
];

// ---------------------------------------------------------------- сообщения
const MSG = {
  bad_login: ["Неверный логин или пароль.", "Login yoki parol noto‘g‘ri."],
  need_login: ["Вы не вошли в систему. Войдите заново.", "Tizimga kirmagansiz. Qaytadan kiring."],
  forbidden: ["У вашей роли нет доступа к этому действию.", "Sizning rolingizda bu amalga ruxsat yo‘q."],
  not_found: ["Не найдено. Обновите страницу.", "Topilmadi. Sahifani yangilang."],
  bad_json: ["Не удалось прочитать данные формы. Обновите страницу и попробуйте снова.",
    "Forma ma’lumotlarini o‘qib bo‘lmadi. Sahifani yangilab, qayta urinib ko‘ring."],
  server: ["Что-то пошло не так на сервере. Обновите страницу и попробуйте ещё раз.",
    "Serverda xatolik yuz berdi. Sahifani yangilab, qayta urinib ko‘ring."],
  busy: ["Сервер сейчас занят. Попробуйте ещё раз через пару секунд.",
    "Server hozir band. Bir necha soniyadan so‘ng qayta urinib ko‘ring."],
  name_empty: ["Введите название товара.", "Mahsulot nomini kiriting."],
  name_long: ["Название слишком длинное (максимум 200 символов).", "Nomi juda uzun (ko‘pi bilan 200 belgi)."],
  name_dup: ["Товар с таким названием уже есть.", "Bunday nomli mahsulot allaqachon bor."],
  bad_unit: ["Выберите единицу: штуки или метры.", "Birlikni tanlang: dona yoki metr."],
  bad_currency: ["Выберите валюту: сум, доллар или юань.", "Valyutani tanlang: so‘m, dollar yoki yuan."],
  price_empty: ["Введите цену за единицу.", "Birlik narxini kiriting."],
  price_neg: ["Цена не может быть отрицательной.", "Narx manfiy bo‘lishi mumkin emas."],
  price_bad: ["Цена — это число, например 0,80 или 125000.", "Narx son bo‘lishi kerak, masalan 0,80 yoki 125000."],
  price_frac: ["У цены не больше 2 знаков после запятой.", "Narxda verguldan keyin ko‘pi bilan 2 ta raqam."],
  price_big: ["Слишком большая цена.", "Narx juda katta."],
  unit_locked: ["Нельзя сменить единицу: по товару уже были движения.",
    "Birlikni o‘zgartirib bo‘lmaydi: mahsulot bo‘yicha harakatlar bo‘lgan."],
  has_moves: ["Товар нельзя удалить: по нему уже были движения. Его можно убрать в архив.",
    "Mahsulotni o‘chirib bo‘lmaydi: u bo‘yicha harakatlar bo‘lgan. Uni arxivga olish mumkin."],
  archived: ["Товар в архиве. Сначала верните его из архива.", "Mahsulot arxivda. Avval uni arxivdan qaytaring."],
  product_need: ["Выберите товар.", "Mahsulotni tanlang."],
  qty_empty: ["Введите количество.", "Miqdorni kiriting."],
  qty_bad: ["Количество — это число больше нуля, например 5 или 12,5.",
    "Miqdor noldan katta son bo‘lishi kerak, masalan 5 yoki 12,5."],
  qty_int: ["Для штук количество только целое: 1, 2, 3…", "Dona uchun miqdor faqat butun son: 1, 2, 3…"],
  qty_frac: ["Для метров — не больше 3 знаков после запятой.", "Metr uchun verguldan keyin ko‘pi bilan 3 ta raqam."],
  qty_big: ["Слишком большое количество.", "Miqdor juda katta."],
  object_need: ["Укажите объект: адрес или имя клиента.", "Obyektni kiriting: manzil yoki mijoz ismi."],
  text_long: ["Слишком длинный текст (максимум 500 символов).", "Matn juda uzun (ko‘pi bilan 500 belgi)."],
  not_enough: ["На складе только {left} {unit}.", "Omborda faqat {left} {unit} bor."],
  already_cancelled: ["Эта операция уже отменена.", "Bu amal allaqachon bekor qilingan."],
  cancel_cancel: ["Отмену отменить нельзя.", "Bekor qilishni bekor qilib bo‘lmaydi."],
  cancel_in_minus: [
    "Нельзя отменить этот приход: часть товара уже выдана. На складе {left} {unit}, а отмена спишет {qty} {unit} — остаток уйдёт в минус. Сначала отмените выдачи.",
    "Bu kirimni bekor qilib bo‘lmaydi: mahsulotning bir qismi berilgan. Omborda {left} {unit}, bekor qilish {qty} {unit} ayiradi — qoldiq manfiy bo‘ladi. Avval chiqimlarni bekor qiling."],
};
const UNIT_LABEL = { pcs: ["шт", "dona"], m: ["м", "m"] };
const CUR_LABEL = { UZS: ["сум", "so‘m"], USD: ["$", "$"], CNY: ["¥", "¥"] };

export class AppError extends Error {
  constructor(key, status = 400, params = {}) {
    super(key);
    this.key = key; this.status = status; this.params = params;
  }
  text(lang) {
    const i = lang === "uz" ? 1 : 0;
    return MSG[this.key][i].replace(/\{(\w+)\}/g, (_, k) => {
      const v = this.params[k];
      return Array.isArray(v) ? v[i] : v;
    });
  }
}
const err = (key, status = 400, params = {}) => new AppError(key, status, params);

// ---------------------------------------------------------------- числа
/** Целое во внутренних единицах → '69.5' / '0.8' (без лишних нулей). */
export function decStr(value, scale) {
  const v = BigInt(value), s = BigInt(scale);
  const neg = v < 0n, a = neg ? -v : v;
  const width = String(scale).length - 1;
  const frac = String(a % s).padStart(width, "0").replace(/0+$/, "");
  return (neg ? "-" : "") + String(a / s) + (frac ? "." + frac : "");
}
export function moneyStr(cents) {
  const v = BigInt(cents), neg = v < 0n, a = neg ? -v : v;
  return (neg ? "-" : "") + String(a / 100n) + "." + String(a % 100n).padStart(2, "0");
}
/** '12500000.5' → '12 500 000,5' (для текстов ошибок). */
function humanNum(s) {
  const [ip, fp] = s.split(".");
  return ip.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (fp ? "," + fp : "");
}

/** Строка с числом → [целая часть, дробная часть] без потери точности. */
function parseNumber(raw, emptyKey, badKey, negKey) {
  if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) throw err(emptyKey);
  if (typeof raw !== "string" && typeof raw !== "number") throw err(badKey);
  const s = String(raw).trim().replace(/[\s ]/g, "").replace(",", ".");
  if (s.startsWith("-") && negKey) throw err(negKey);
  const m = /^(\d{1,15})(?:\.(\d{1,12}))?$/.exec(s);
  if (!m) throw err(badKey);
  return [m[1], (m[2] || "").replace(/0+$/, "")];
}
function scaled(ip, fp, digits) {
  return Number(BigInt(ip) * 10n ** BigInt(digits) + BigInt((fp + "0".repeat(digits)).slice(0, digits) || "0"));
}

export function parseQty(raw, unit) {
  const [ip, fp] = parseNumber(raw, "qty_empty", "qty_bad", "qty_bad");
  if (/^0+$/.test(ip) && !fp) throw err("qty_bad");
  if (unit === "pcs" && fp) throw err("qty_int");
  if (fp.length > 3) throw err("qty_frac");
  if (BigInt(ip) > 1000000000n) throw err("qty_big");
  return scaled(ip, fp, 3);
}
export function parsePrice(raw) {
  const [ip, fp] = parseNumber(raw, "price_empty", "price_bad", "price_neg");
  if (fp.length > 2) throw err("price_frac");
  if (BigInt(ip) > 1000000000000n) throw err("price_big");
  return scaled(ip, fp, 2);
}
/** qty в тысячных × price в сотых → сумма в сотых, округление «половина вверх». */
export function lineSumCents(qty, price) {
  const p = BigInt(qty) * BigInt(price);
  return (p + 500n) / 1000n;
}
function cleanText(raw, limit = 500) {
  const s = (raw === null || raw === undefined ? "" : String(raw)).trim();
  if (s.length > limit) throw err(limit === 200 ? "name_long" : "text_long");
  return s;
}

const hashPassword = (pwd, salt) =>
  crypto.pbkdf2Sync(String(pwd), Buffer.from(salt, "hex"), 120000, 32, "sha256").toString("hex");

function now() {
  // Время Ташкента (UTC+5), чтобы история показывала местное время, а не время сервера Netlify.
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function freshState() {
  return {
    seq: { product: 0, op: 0 },
    users: DEFAULT_USERS.map(([login, pwd, role, name], i) => {
      const salt = crypto.randomBytes(16).toString("hex");
      return { id: i + 1, login, role, name, salt, pass_hash: hashPassword(pwd, salt) };
    }),
    sessions: {},
    products: [],
    ops: [],
  };
}

// ---------------------------------------------------------------- хранилище
/**
 * backend: { read() → {data, etag} | null, write(data, etag|null) → true | false (конфликт) }
 * Каждая запись — условная (по etag): если кто-то успел записать раньше, пересчитываем заново.
 * Так две одновременные выдачи никогда не уведут остаток в минус.
 */
export class Store {
  constructor(backend) { this.backend = backend; }

  async state() {
    const cur = await this.backend.read();
    if (cur) return cur.data;
    await this.tx(() => null); // создаёт начальное состояние
    return (await this.backend.read()).data;
  }

  async tx(fn) {
    for (let attempt = 0; attempt < 15; attempt++) {
      const cur = await this.backend.read();
      const data = cur ? cur.data : freshState();
      const result = await fn(data);
      if (await this.backend.write(data, cur ? cur.etag : null)) return result;
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 80));
    }
    throw err("busy", 503);
  }

  // -- авторизация
  async login(login, password) {
    return this.tx((s) => {
      const u = s.users.find((x) => x.login === String(login || "").trim());
      const ok = u && crypto.timingSafeEqual(Buffer.from(u.pass_hash, "hex"),
        Buffer.from(hashPassword(password || "", u.salt), "hex"));
      if (!ok) throw err("bad_login", 401);
      const token = crypto.randomBytes(32).toString("base64url");
      s.sessions[token] = { user_id: u.id, created: now() };
      const tokens = Object.keys(s.sessions);
      if (tokens.length > 500) tokens.slice(0, tokens.length - 500).forEach((t) => delete s.sessions[t]);
      return { token, user: userDict(u) };
    });
  }
  async logout(token) {
    if (!token) return;
    await this.tx((s) => { delete s.sessions[token]; });
  }
  async userByToken(token) {
    if (!token) return null;
    const s = await this.state();
    const sess = s.sessions[token];
    const u = sess && s.users.find((x) => x.id === sess.user_id);
    return u ? userDict(u) : null;
  }

  // -- остатки
  async stock(user, q = "") {
    require(user, ALL);
    const s = await this.state();
    const prices = SEE_PRICES.includes(user.role);
    const ql = String(q || "").trim().toLowerCase();
    const totals = { UZS: 0n, USD: 0n, CNY: 0n };
    const items = [];
    const rows = s.products.filter((p) => !p.archived)
      .sort((a, b) => a.name.localeCompare(b.name, "ru", { sensitivity: "base" }));
    for (const p of rows) {
      if (ql && !p.name.toLowerCase().includes(ql)) continue;
      const st = stockOf(s, p.id);
      const item = { id: p.id, name: p.name, unit: p.unit, stock: decStr(st, QS) };
      if (prices) { // кладовщику цены и суммы не отправляются вообще
        const sum = lineSumCents(st, p.price);
        totals[p.currency] += sum;
        Object.assign(item, { price: moneyStr(p.price), currency: p.currency, sum: moneyStr(sum) });
      }
      items.push(item);
    }
    const res = { items };
    if (prices) res.totals = Object.fromEntries(Object.entries(totals).map(([c, v]) => [c, moneyStr(v)]));
    return res;
  }

  // -- товары (только руководитель)
  async products(user) {
    require(user, [DIRECTOR]);
    const s = await this.state();
    const rows = [...s.products].sort((a, b) => (a.archived - b.archived) ||
      a.name.localeCompare(b.name, "ru", { sensitivity: "base" }));
    return {
      items: rows.map((p) => ({
        id: p.id, name: p.name, unit: p.unit, price: moneyStr(p.price), currency: p.currency,
        archived: !!p.archived, has_moves: s.ops.some((o) => o.product_id === p.id), stock: decStr(stockOf(s, p.id), QS),
      })),
    };
  }

  async createProduct(user, data) {
    require(user, [DIRECTOR]);
    const f = productFields(data);
    return this.tx((s) => {
      if (s.products.some((p) => p.name.toLowerCase() === f.name.toLowerCase())) throw err("name_dup");
      const id = ++s.seq.product;
      s.products.push({ id, ...f, archived: false, created: now() });
      return { id };
    });
  }
  async updateProduct(user, pid, data) {
    require(user, [DIRECTOR]);
    const f = productFields(data);
    return this.tx((s) => {
      const p = getProduct(s, pid);
      if (s.products.some((x) => x.id !== pid && x.name.toLowerCase() === f.name.toLowerCase())) throw err("name_dup");
      if (f.unit !== p.unit && s.ops.some((o) => o.product_id === pid)) throw err("unit_locked");
      Object.assign(p, f);
      return { id: pid };
    });
  }
  async archiveProduct(user, pid, archived) {
    require(user, [DIRECTOR]);
    return this.tx((s) => { getProduct(s, pid).archived = !!archived; return { id: pid, archived: !!archived }; });
  }
  async deleteProduct(user, pid) {
    require(user, [DIRECTOR]);
    return this.tx((s) => {
      getProduct(s, pid);
      if (s.ops.some((o) => o.product_id === pid)) throw err("has_moves");
      s.products = s.products.filter((p) => p.id !== pid);
      return { deleted: pid };
    });
  }

  // -- приход / выдача
  async createOp(user, data) {
    require(user, DO_OPS);
    const kind = data.kind;
    if (kind !== "in" && kind !== "out") throw err("bad_json");
    const key = cleanText(data.key, 100) || null;
    const pid = Number(data.product_id);
    if (!Number.isInteger(pid) || pid <= 0) throw err("product_need");
    let obj = cleanText(data.object);
    const comment = cleanText(data.comment);
    return this.tx((s) => {
      if (key) { // повторная отправка той же формы (двойное нажатие) → та же операция
        const dup = s.ops.find((o) => o.client_key === key && o.user_id === user.id);
        if (dup) return { id: dup.id, duplicate: true };
      }
      const p = getProduct(s, pid);
      if (p.archived) throw err("archived");
      const qty = parseQty(data.qty, p.unit);
      if (kind === "out") {
        if (!obj) throw err("object_need");
        const left = stockOf(s, pid);
        if (qty > left) throw err("not_enough", 400, { left: humanNum(decStr(left, QS)), unit: UNIT_LABEL[p.unit] });
      } else obj = "";
      const id = ++s.seq.op;
      s.ops.push({ id, kind, product_id: pid, qty, object: obj, comment, user_id: user.id, created: now(),
        cancel_of: null, cancelled_by: null, cancelled_at: null, client_key: key });
      return { id, stock: decStr(stockOf(s, pid), QS) };
    });
  }

  // -- отмена (только руководитель)
  async cancelOp(user, opId) {
    require(user, [DIRECTOR]);
    return this.tx((s) => {
      const op = s.ops.find((o) => o.id === opId);
      if (!op) throw err("not_found", 404);
      if (op.kind === "cancel") throw err("cancel_cancel");
      if (op.cancelled_at) throw err("already_cancelled");
      const p = getProduct(s, op.product_id);
      if (op.kind === "in") {
        const left = stockOf(s, op.product_id);
        if (left - op.qty < 0) throw err("cancel_in_minus", 400, {
          left: humanNum(decStr(left, QS)), qty: humanNum(decStr(op.qty, QS)), unit: UNIT_LABEL[p.unit] });
      }
      const t = now();
      op.cancelled_by = user.id; op.cancelled_at = t;
      const id = ++s.seq.op;
      s.ops.push({ id, kind: "cancel", product_id: op.product_id, qty: op.qty, object: op.object, comment: "",
        user_id: user.id, created: t, cancel_of: op.id, cancelled_by: null, cancelled_at: null, client_key: null });
      return { id: opId, stock: decStr(stockOf(s, op.product_id), QS) };
    });
  }

  // -- история
  async history(user) {
    require(user, SEE_HISTORY);
    const s = await this.state();
    const users = Object.fromEntries(s.users.map((u) => [u.id, u]));
    const prods = Object.fromEntries(s.products.map((p) => [p.id, p]));
    const ops = Object.fromEntries(s.ops.map((o) => [o.id, o]));
    return {
      items: [...s.ops].sort((a, b) => b.id - a.id).map((o) => ({
        id: o.id, kind: o.kind, created: o.created, user: users[o.user_id]?.name, user_role: users[o.user_id]?.role,
        product: prods[o.product_id]?.name, unit: prods[o.product_id]?.unit, qty: decStr(o.qty, QS),
        object: o.object, comment: o.comment, cancel_of: o.cancel_of,
        cancel_of_kind: o.cancel_of ? ops[o.cancel_of]?.kind : null, cancelled_at: o.cancelled_at,
        cancelled_by: o.cancelled_by ? users[o.cancelled_by]?.name : null,
        cancelled_by_role: o.cancelled_by ? users[o.cancelled_by]?.role : null,
      })),
    };
  }

  // -- Excel
  async stockXlsx(user, lang) {
    const data = await this.stock(user);
    const i = lang === "uz" ? 1 : 0;
    const prices = "totals" in data;
    const head = [["Товар", "Mahsulot"], ["Ед.", "Birlik"], ["Остаток", "Qoldiq"]];
    if (prices) head.push(["Цена", "Narx"], ["Валюта", "Valyuta"], ["Сумма", "Summa"]);
    const rows = [head.map((h) => h[i])];
    for (const it of data.items) {
      const row = [it.name, UNIT_LABEL[it.unit][i], { n: it.stock }];
      if (prices) row.push({ n: it.price }, CUR_LABEL[it.currency][i], { n: it.sum });
      rows.push(row);
    }
    if (prices) {
      rows.push([]);
      for (const [c, v] of Object.entries(data.totals)) rows.push([["Итого", "Jami"][i], "", "", "", CUR_LABEL[c][i], { n: v }]);
    }
    return makeXlsx(rows);
  }
}

function userDict(u) { return { id: u.id, login: u.login, role: u.role, name: u.name }; }
function require(user, roles) {
  if (!user) throw err("need_login", 401);
  if (!roles.includes(user.role)) throw err("forbidden", 403);
}
function getProduct(s, pid) {
  const p = s.products.find((x) => x.id === pid);
  if (!p) throw err("not_found", 404);
  return p;
}
function stockOf(s, pid) {
  let t = 0;
  for (const o of s.ops) {
    if (o.product_id !== pid || o.cancelled_at) continue;
    if (o.kind === "in") t += o.qty; else if (o.kind === "out") t -= o.qty;
  }
  return t;
}
function productFields(data) {
  const name = cleanText(data.name, 200);
  if (!name) throw err("name_empty");
  if (!UNITS.includes(data.unit)) throw err("bad_unit");
  if (!CURRENCIES.includes(data.currency)) throw err("bad_currency");
  return { name, unit: data.unit, price: parsePrice(data.price), currency: data.currency };
}

// ---------------------------------------------------------------- Excel без библиотек
const xmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function makeXlsx(rows) {
  const col = (n) => { let s = ""; n += 1; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
  const xmlRows = rows.map((row, ri) => `<row r="${ri + 1}">${row.map((v, ci) => {
    const ref = `${col(ci)}${ri + 1}`;
    if (v && typeof v === "object") return `<c r="${ref}"><v>${v.n}</v></c>`;
    return v === "" ? "" : `<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(v)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const files = {
    "[Content_Types].xml": X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels": X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sklad" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": X + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<cols><col min="1" max="1" width="36" customWidth="1"/><col min="2" max="6" width="14" customWidth="1"/></cols>' +
      `<sheetData>${xmlRows}</sheetData></worksheet>`,
  };
  return zipStore(Object.entries(files).map(([name, text]) => [name, Buffer.from(text, "utf8")]));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/** ZIP без сжатия (метод «stored») — Excel его открывает. */
function zipStore(entries) {
  const parts = [], central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name, "utf8"), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    parts.push(local, nameBuf, data);
    central.push(cen, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cenBuf, end]);
}

// ---------------------------------------------------------------- HTTP
function json(status, payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff", ...headers },
  });
}
function readCookie(req, name) {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.get("cookie") || "");
  return m ? decodeURIComponent(m[1]) : null;
}

export async function handle(req, store) {
  const lang = (req.headers.get("x-lang") || "").toLowerCase() === "uz" ? "uz" : "ru";
  try {
    return await route(req, store);
  } catch (e) {
    if (e instanceof AppError) return json(e.status, { error: e.text(lang), code: e.key });
    console.error(e);
    return json(500, { error: MSG.server[lang === "uz" ? 1 : 0], code: "server" });
  }
}

async function route(req, store) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = req.method;
  const secure = url.protocol === "https:" ? "; Secure" : "";
  if (method !== "GET" && !(req.headers.get("content-type") || "").includes("application/json")) {
    throw err("bad_json"); // защита от отправки форм с чужих сайтов
  }
  const body = async () => {
    if (method === "GET") return {};
    let d;
    try { const t = await req.text(); d = t ? JSON.parse(t) : {}; } catch { throw err("bad_json"); }
    if (!d || typeof d !== "object" || Array.isArray(d)) throw err("bad_json");
    return d;
  };
  const token = readCookie(req, "sid");

  if (path === "/api/login" && method === "POST") {
    const d = await body();
    const { token: t, user } = await store.login(d.login, d.password);
    return json(200, { user }, { "Set-Cookie": `sid=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure}` });
  }
  if (path === "/api/logout" && method === "POST") {
    await store.logout(token);
    return json(200, { ok: true }, { "Set-Cookie": `sid=; Path=/; Max-Age=0${secure}` });
  }

  const user = await store.userByToken(token);
  if (path === "/api/me" && method === "GET") {
    if (!user) throw err("need_login", 401);
    return json(200, { user });
  }
  if (path === "/api/stock" && method === "GET") return json(200, await store.stock(user, url.searchParams.get("q") || ""));
  if (path === "/api/stock.xlsx" && method === "GET") {
    const xl = await store.stockXlsx(user, url.searchParams.get("lang") === "uz" ? "uz" : "ru");
    return new Response(xl, { status: 200, headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ostatki-${now().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store" } });
  }
  if (path === "/api/products") {
    if (method === "GET") return json(200, await store.products(user));
    if (method === "POST") return json(200, await store.createProduct(user, await body()));
  }
  let m = /^\/api\/products\/(\d+)(\/archive)?$/.exec(path);
  if (m) {
    const pid = Number(m[1]);
    if (m[2] && method === "POST") return json(200, await store.archiveProduct(user, pid, !!(await body()).archived));
    if (!m[2] && method === "PUT") return json(200, await store.updateProduct(user, pid, await body()));
    if (!m[2] && method === "DELETE") return json(200, await store.deleteProduct(user, pid));
  }
  if (path === "/api/ops" && method === "POST") return json(200, await store.createOp(user, await body()));
  m = /^\/api\/ops\/(\d+)\/cancel$/.exec(path);
  if (m && method === "POST") return json(200, await store.cancelOp(user, Number(m[1])));
  if (path === "/api/history" && method === "GET") return json(200, await store.history(user));
  throw err("not_found", 404);
}

// ---------------------------------------------------------------- хранилища
const NO_ETAG = "*";

/** Netlify Blobs: один документ "db", запись только если etag не изменился. */
export function blobsBackend(blobStore) {
  return {
    async read() {
      const r = await blobStore.getWithMetadata("db", { type: "json" });
      // Локальный эмулятор (netlify dev) не отдаёт etag — там пишем без условия; на Netlify etag есть всегда.
      return r ? { data: r.data, etag: r.etag || NO_ETAG } : null;
    },
    async write(data, etag) {
      const opts = etag === null ? { onlyIfNew: true } : etag === NO_ETAG ? {} : { onlyIfMatch: etag };
      const r = await blobStore.setJSON("db", data, opts);
      return r.modified;
    },
  };
}

/** Хранилище в памяти — для автотестов. */
export function memoryBackend() {
  let cur = null, v = 0;
  return {
    async read() { return cur ? { data: structuredClone(cur.data), etag: cur.etag } : null; },
    async write(data, etag) {
      await new Promise((r) => setImmediate(r)); // даём «соперникам» вклиниться, как в сети
      if ((cur ? cur.etag : null) !== etag) return false;
      cur = { data: structuredClone(data), etag: String(++v) };
      return true;
    },
  };
}

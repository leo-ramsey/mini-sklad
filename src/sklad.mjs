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
  ["stockman", "sklad123", STOREKEEPER, "Кладовщик"],
  ["manager", "manager123", MANAGER, "Менеджер"],
];

// ---------------------------------------------------------------- сообщения
const MSG = {
  bad_login: ["Неверный логин или пароль.", "Login yoki parol noto‘g‘ri."],
  too_many: ["Слишком много неудачных попыток входа. Подождите {min} мин. и попробуйте снова.",
    "Kirishga juda ko‘p muvaffaqiyatsiz urinish. {min} daqiqa kutib, qayta urinib ko‘ring."],
  bad_origin: ["Запрос пришёл с чужого сайта и отклонён.", "So‘rov boshqa saytdan kelgan va rad etildi."],
  too_big: ["Слишком большой запрос.", "So‘rov juda katta."],
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
const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const safeEq = (a, b) => crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
const DUMMY_SALT = "00".repeat(16);

// ---------------------------------------------------------------- защита входа
export const SESSION_TTL_MS = 12 * 3600 * 1000;   // сессия живёт 12 часов
const FAIL_WINDOW_MS = 15 * 60 * 1000;            // окно подсчёта неудачных попыток
const MAX_FAILS_PER_LOGIN = 5;                     // после 5 ошибок логин блокируется на 15 минут
const MAX_FAILS_PER_IP = 20;                       // и с одного IP — не больше 20 попыток за 15 минут

/**
 * Пароль берётся из переменной окружения Netlify SKLAD_PASSWORD_<ЛОГИН> (их не видно в коде и на GitHub).
 * Если SKLAD_REQUIRE_ENV_PASSWORDS=1, а переменной нет — вход запрещён: стандартные пароли на сайте не работают.
 * Хеш считается всегда, даже для несуществующего логина, — по времени ответа нельзя угадать логины.
 */
function checkPassword(u, password) {
  const pw = String(password ?? "").slice(0, 200);
  const computed = hashPassword(pw, u ? u.salt : DUMMY_SALT);
  if (!u) return false;
  const envPw = process.env["SKLAD_PASSWORD_" + u.login.toUpperCase()];
  if (envPw) return safeEq(sha256(pw), sha256(envPw));
  if (process.env.SKLAD_REQUIRE_ENV_PASSWORDS === "1") return false;
  return safeEq(computed, u.pass_hash);
}

function recentFails(s, key, t) {
  return ((s.fails || {})[key] || []).filter((x) => t - x < FAIL_WINDOW_MS);
}
/** Сколько минут ещё ждать (0 — не заблокирован). */
function lockMinutes(s, login, ip, t) {
  const waits = [];
  const byLogin = recentFails(s, "l:" + login.toLowerCase(), t);
  if (byLogin.length >= MAX_FAILS_PER_LOGIN) waits.push(byLogin[byLogin.length - MAX_FAILS_PER_LOGIN]);
  if (ip) {
    const byIp = recentFails(s, "i:" + ip, t);
    if (byIp.length >= MAX_FAILS_PER_IP) waits.push(byIp[byIp.length - MAX_FAILS_PER_IP]);
  }
  if (!waits.length) return 0;
  return Math.max(1, Math.ceil((Math.max(...waits) + FAIL_WINDOW_MS - t) / 60000));
}
function addFail(s, login, ip, t) {
  s.fails = s.fails || {};
  for (const key of ["l:" + login.toLowerCase(), ip && "i:" + ip].filter(Boolean)) {
    s.fails[key] = [...recentFails(s, key, t), t].slice(-50);
  }
}
function pruneSecurity(s, t) {
  s.fails = s.fails || {};
  for (const k of Object.keys(s.fails)) if (!recentFails(s, k, t).length) delete s.fails[k];
  const keys = Object.keys(s.fails);
  if (keys.length > 2000) keys.slice(0, keys.length - 2000).forEach((k) => delete s.fails[k]);
  for (const [k, v] of Object.entries(s.sessions)) if (!(v.exp > t)) delete s.sessions[k];
  const tokens = Object.keys(s.sessions);
  if (tokens.length > 500) tokens.slice(0, tokens.length - 500).forEach((k) => delete s.sessions[k]);
}

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
    if (cur) return syncLogins(cur.data);
    await this.tx(() => null); // создаёт начальное состояние
    return syncLogins((await this.backend.read()).data);
  }

  async tx(fn) {
    for (let attempt = 0; attempt < 15; attempt++) {
      const cur = await this.backend.read();
      const data = cur ? syncLogins(cur.data) : freshState();
      const result = await fn(data);
      if (await this.backend.write(data, cur ? cur.etag : null)) return result;
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 80));
    }
    throw err("busy", 503);
  }

  // -- авторизация
  async login(login, password, ip = "") {
    const name = String(login ?? "").trim().slice(0, 100);
    const t0 = Date.now();
    const s0 = await this.state();
    const wait = lockMinutes(s0, name, ip, t0);
    if (wait) throw err("too_many", 429, { min: wait });
    const u = s0.users.find((x) => x.login === name);
    const ok = checkPassword(u, password); // тяжёлый хеш — вне транзакции, чтобы не повторять его при конфликте
    const res = await this.tx((s) => {
      const t = Date.now();
      pruneSecurity(s, t);
      if (!ok) { addFail(s, name, ip, t); return null; }
      delete s.fails["l:" + name.toLowerCase()];
      const token = crypto.randomBytes(32).toString("base64url");
      // В базе хранится только хеш токена: даже утечка данных не даст войти чужой сессией.
      s.sessions[sha256(token)] = { user_id: u.id, exp: t + SESSION_TTL_MS };
      return { token, user: userDict(u) };
    });
    if (!res) throw err("bad_login", 401);
    return res;
  }
  async logout(token) {
    if (!token) return;
    await this.tx((s) => { delete s.sessions[sha256(token)]; });
  }
  async userByToken(token) {
    if (!token || token.length > 100) return null;
    const s = await this.state();
    const sess = s.sessions[sha256(token)];
    if (!sess || !(sess.exp > Date.now())) return null;
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

/** Логины берутся из DEFAULT_USERS: если логин переименовали в коде, уже сохранённые данные подхватят новый. */
function syncLogins(s) {
  for (const u of s.users) {
    const d = DEFAULT_USERS[u.id - 1];
    if (d && d[2] === u.role) u.login = d[0];
  }
  return s;
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
const MAX_BODY = 20000; // ни одна форма сайта не отправляет больше

function json(status, payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff", ...headers },
  });
}
function readCookie(req, name) {
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
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
  const https = url.protocol === "https:";
  // На HTTPS — cookie с префиксом __Host-: браузер не даст её подменить с поддомена или по HTTP.
  const cookieName = https ? "__Host-sid" : "sid";
  const cookieAttrs = `Path=/; HttpOnly; SameSite=Strict${https ? "; Secure" : ""}`;

  if (!["GET", "POST", "PUT", "DELETE"].includes(method)) throw err("not_found", 404);
  if (method !== "GET") {
    // Защита от CSRF: только JSON и только со своего же сайта.
    if (!(req.headers.get("content-type") || "").includes("application/json")) throw err("bad_json");
    const origin = req.headers.get("origin");
    if (origin && origin !== url.origin) throw err("bad_origin", 403);
  }
  const body = async () => {
    if (method === "GET") return {};
    if (Number(req.headers.get("content-length") || 0) > MAX_BODY) throw err("too_big", 413);
    let d;
    const t = await req.text();
    if (t.length > MAX_BODY) throw err("too_big", 413);
    try { d = t ? JSON.parse(t) : {}; } catch { throw err("bad_json"); }
    if (!d || typeof d !== "object" || Array.isArray(d)) throw err("bad_json");
    return d;
  };
  const token = readCookie(req, cookieName);

  if (path === "/api/login" && method === "POST") {
    const d = await body();
    const ip = req.headers.get("x-nf-client-connection-ip") || "";
    const { token: t, user } = await store.login(d.login, d.password, ip);
    return json(200, { user }, { "Set-Cookie": `${cookieName}=${t}; ${cookieAttrs}; Max-Age=${SESSION_TTL_MS / 1000}` });
  }
  if (path === "/api/logout" && method === "POST") {
    await store.logout(token);
    return json(200, { ok: true }, { "Set-Cookie": `${cookieName}=; ${cookieAttrs}; Max-Age=0` });
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

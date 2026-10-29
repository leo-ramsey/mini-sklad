"""Мини-склад: сервер на чистом Python (stdlib) + SQLite.

Запуск: python server.py   → http://localhost:8000
"""
import hashlib
import io
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import threading
import traceback
import zipfile
from contextlib import contextmanager
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
from xml.sax.saxutils import escape

BASE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(BASE, "static")

# Количество хранится в тысячных долях единицы, цена — в сотых (центы/тийины).
# Только целые числа → никаких ошибок округления (0,10 $ × 3 = ровно 0,30 $).
QS = 1000
PS = 100

UNITS = ("pcs", "m")
CURRENCIES = ("UZS", "USD", "CNY")

DIRECTOR, STOREKEEPER, MANAGER = "director", "storekeeper", "manager"
SEE_PRICES = (DIRECTOR, MANAGER)
DO_OPS = (DIRECTOR, STOREKEEPER)
SEE_HISTORY = (DIRECTOR, MANAGER)

DEFAULT_USERS = [
    ("director", "director123", DIRECTOR, "Руководитель"),
    ("sklad", "sklad123", STOREKEEPER, "Кладовщик"),
    ("manager", "manager123", MANAGER, "Менеджер"),
]

# ---------------------------------------------------------------- сообщения
MSG = {
    "bad_login": ("Неверный логин или пароль.", "Login yoki parol noto‘g‘ri."),
    "need_login": ("Вы не вошли в систему. Войдите заново.", "Tizimga kirmagansiz. Qaytadan kiring."),
    "forbidden": ("У вашей роли нет доступа к этому действию.", "Sizning rolingizda bu amalga ruxsat yo‘q."),
    "not_found": ("Не найдено. Обновите страницу.", "Topilmadi. Sahifani yangilang."),
    "bad_json": ("Не удалось прочитать данные формы. Обновите страницу и попробуйте снова.",
                 "Forma ma’lumotlarini o‘qib bo‘lmadi. Sahifani yangilab, qayta urinib ko‘ring."),
    "server": ("Что-то пошло не так на сервере. Обновите страницу и попробуйте ещё раз.",
               "Serverda xatolik yuz berdi. Sahifani yangilab, qayta urinib ko‘ring."),
    "name_empty": ("Введите название товара.", "Mahsulot nomini kiriting."),
    "name_long": ("Название слишком длинное (максимум 200 символов).", "Nomi juda uzun (ko‘pi bilan 200 belgi)."),
    "name_dup": ("Товар с таким названием уже есть.", "Bunday nomli mahsulot allaqachon bor."),
    "bad_unit": ("Выберите единицу: штуки или метры.", "Birlikni tanlang: dona yoki metr."),
    "bad_currency": ("Выберите валюту: сум, доллар или юань.", "Valyutani tanlang: so‘m, dollar yoki yuan."),
    "price_empty": ("Введите цену за единицу.", "Birlik narxini kiriting."),
    "price_neg": ("Цена не может быть отрицательной.", "Narx manfiy bo‘lishi mumkin emas."),
    "price_bad": ("Цена — это число, например 0,80 или 125000.", "Narx son bo‘lishi kerak, masalan 0,80 yoki 125000."),
    "price_frac": ("У цены не больше 2 знаков после запятой.", "Narxda verguldan keyin ko‘pi bilan 2 ta raqam."),
    "price_big": ("Слишком большая цена.", "Narx juda katta."),
    "unit_locked": ("Нельзя сменить единицу: по товару уже были движения.",
                    "Birlikni o‘zgartirib bo‘lmaydi: mahsulot bo‘yicha harakatlar bo‘lgan."),
    "has_moves": ("Товар нельзя удалить: по нему уже были движения. Его можно убрать в архив.",
                  "Mahsulotni o‘chirib bo‘lmaydi: u bo‘yicha harakatlar bo‘lgan. Uni arxivga olish mumkin."),
    "archived": ("Товар в архиве. Сначала верните его из архива.", "Mahsulot arxivda. Avval uni arxivdan qaytaring."),
    "product_need": ("Выберите товар.", "Mahsulotni tanlang."),
    "qty_empty": ("Введите количество.", "Miqdorni kiriting."),
    "qty_bad": ("Количество — это число больше нуля, например 5 или 12,5.",
                "Miqdor noldan katta son bo‘lishi kerak, masalan 5 yoki 12,5."),
    "qty_int": ("Для штук количество только целое: 1, 2, 3…", "Dona uchun miqdor faqat butun son: 1, 2, 3…"),
    "qty_frac": ("Для метров — не больше 3 знаков после запятой.", "Metr uchun verguldan keyin ko‘pi bilan 3 ta raqam."),
    "qty_big": ("Слишком большое количество.", "Miqdor juda katta."),
    "object_need": ("Укажите объект: адрес или имя клиента.", "Obyektni kiriting: manzil yoki mijoz ismi."),
    "text_long": ("Слишком длинный текст (максимум 500 символов).", "Matn juda uzun (ko‘pi bilan 500 belgi)."),
    "not_enough": ("На складе только {left} {unit}.", "Omborda faqat {left} {unit} bor."),
    "already_cancelled": ("Эта операция уже отменена.", "Bu amal allaqachon bekor qilingan."),
    "cancel_cancel": ("Отмену отменить нельзя.", "Bekor qilishni bekor qilib bo‘lmaydi."),
    "cancel_in_minus": (
        "Нельзя отменить этот приход: часть товара уже выдана. На складе {left} {unit}, а отмена спишет {qty} {unit} — остаток уйдёт в минус. Сначала отмените выдачи.",
        "Bu kirimni bekor qilib bo‘lmaydi: mahsulotning bir qismi berilgan. Omborda {left} {unit}, bekor qilish {qty} {unit} ayiradi — qoldiq manfiy bo‘ladi. Avval chiqimlarni bekor qiling."),
}
UNIT_LABEL = {"pcs": ("шт", "dona"), "m": ("м", "m")}
CUR_LABEL = {"UZS": ("сум", "so‘m"), "USD": ("$", "$"), "CNY": ("¥", "¥")}


class AppError(Exception):
    def __init__(self, code, key, status=400, **params):
        self.key, self.status, self.params = key, status, params
        super().__init__(key)

    def text(self, lang):
        i = 1 if lang == "uz" else 0
        params = {k: (v[i] if isinstance(v, tuple) else v) for k, v in self.params.items()}
        return MSG[self.key][i].format(**params)


def err(key, status=400, **params):
    return AppError(None, key, status, **params)


# ---------------------------------------------------------------- числа
def dec_str(value, scale):
    """Целое во внутренних единицах → '69.5' / '0.8' (без лишних нулей)."""
    d = (Decimal(value) / scale).normalize()
    s = format(d, "f")
    return s


def money_str(cents):
    return format((Decimal(cents) / PS).quantize(Decimal("0.01")), "f")


def human_num(s):
    """'12500000.5' → '12 500 000,5' (для текстов ошибок)."""
    neg = s.startswith("-")
    s = s.lstrip("-")
    ip, _, fp = s.partition(".")
    ip = re.sub(r"(?<=\d)(?=(\d{3})+$)", " ", ip)
    return ("-" if neg else "") + ip + ("," + fp if fp else "")


def parse_number(raw, empty_key, bad_key, neg_key=None):
    if raw is None or (isinstance(raw, str) and raw.strip() == ""):
        raise err(empty_key)
    if isinstance(raw, bool):
        raise err(bad_key)
    s = str(raw).strip().replace(" ", "").replace(" ", "").replace(",", ".")
    if s.startswith("-") and neg_key:
        raise err(neg_key)
    if not re.fullmatch(r"\d{1,15}(\.\d{1,12})?", s):
        raise err(bad_key)
    return Decimal(s)


def parse_qty(raw, unit):
    d = parse_number(raw, "qty_empty", "qty_bad", "qty_bad")
    if d <= 0:
        raise err("qty_bad")
    if unit == "pcs" and d != d.to_integral_value():
        raise err("qty_int")
    scaled = d * QS
    if scaled != scaled.to_integral_value():
        raise err("qty_frac")
    if d > Decimal("1000000000"):
        raise err("qty_big")
    return int(scaled)


def parse_price(raw):
    d = parse_number(raw, "price_empty", "price_bad", "price_neg")
    scaled = d * PS
    if scaled != scaled.to_integral_value():
        raise err("price_frac")
    if d > Decimal("1000000000000"):
        raise err("price_big")
    return int(scaled)


def line_sum_cents(qty, price):
    # qty в тысячных, price в сотых → сумма в сотых, округление «как в бухгалтерии»
    return int((Decimal(qty) * Decimal(price) / QS).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def clean_text(raw, limit=500):
    s = ("" if raw is None else str(raw)).strip()
    if len(s) > limit:
        raise err("text_long")
    return s


# ---------------------------------------------------------------- база
SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, login TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL CHECK(unit IN ('pcs','m')),
  price INTEGER NOT NULL CHECK(price >= 0), currency TEXT NOT NULL CHECK(currency IN ('UZS','USD','CNY')),
  archived INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ops(
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('in','out','cancel')),
  product_id INTEGER NOT NULL REFERENCES products(id), qty INTEGER NOT NULL CHECK(qty > 0),
  object TEXT NOT NULL DEFAULT '', comment TEXT NOT NULL DEFAULT '',
  user_id INTEGER NOT NULL REFERENCES users(id), created TEXT NOT NULL,
  cancel_of INTEGER REFERENCES ops(id), cancelled_by INTEGER REFERENCES users(id), cancelled_at TEXT,
  client_key TEXT UNIQUE);
CREATE INDEX IF NOT EXISTS ops_product ON ops(product_id);
"""

STOCK_SQL = """COALESCE((SELECT SUM(CASE o.kind WHEN 'in' THEN o.qty ELSE -o.qty END) FROM ops o
  WHERE o.product_id = p.id AND o.kind IN ('in','out') AND o.cancelled_at IS NULL), 0)"""


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 120_000).hex()


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class Store:
    """Вся бизнес-логика склада. Права проверяются здесь, на сервере."""

    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()  # все записи — строго по одной
        with self.connect() as db:
            db.executescript(SCHEMA)
            for login, pwd, role, name in DEFAULT_USERS:
                if not db.execute("SELECT 1 FROM users WHERE login=?", (login,)).fetchone():
                    salt = secrets.token_hex(16)
                    db.execute("INSERT INTO users(login,pass_hash,salt,role,name) VALUES(?,?,?,?,?)",
                               (login, hash_password(pwd, salt), salt, role, name))

    @contextmanager
    def connect(self):
        """Одна транзакция: commit при успехе, rollback при ошибке, соединение всегда закрывается."""
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    # -- авторизация
    def login(self, login, password):
        with self.lock, self.connect() as db:
            u = db.execute("SELECT * FROM users WHERE login=?", ((login or "").strip(),)).fetchone()
            if not u or not secrets.compare_digest(u["pass_hash"], hash_password(password or "", u["salt"])):
                raise err("bad_login", 401)
            token = secrets.token_urlsafe(32)
            db.execute("INSERT INTO sessions VALUES(?,?,?)", (token, u["id"], now()))
            return token, self.user_dict(u)

    def logout(self, token):
        with self.lock, self.connect() as db:
            db.execute("DELETE FROM sessions WHERE token=?", (token,))

    def user_by_token(self, token):
        if not token:
            return None
        with self.connect() as db:
            u = db.execute("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?",
                           (token,)).fetchone()
            return self.user_dict(u) if u else None

    @staticmethod
    def user_dict(u):
        return {"id": u["id"], "login": u["login"], "role": u["role"], "name": u["name"]}

    @staticmethod
    def require(user, roles):
        if not user:
            raise err("need_login", 401)
        if user["role"] not in roles:
            raise err("forbidden", 403)

    # -- остатки
    def stock(self, user, q=""):
        self.require(user, (DIRECTOR, STOREKEEPER, MANAGER))
        prices = user["role"] in SEE_PRICES
        with self.connect() as db:
            rows = db.execute(f"SELECT p.*, {STOCK_SQL} AS stock FROM products p WHERE p.archived=0 "
                              "ORDER BY p.name COLLATE NOCASE").fetchall()
        ql = (q or "").strip().lower()
        items, totals = [], {c: 0 for c in CURRENCIES}
        for r in rows:
            if ql and ql not in r["name"].lower():
                continue
            item = {"id": r["id"], "name": r["name"], "unit": r["unit"], "stock": dec_str(r["stock"], QS)}
            if prices:  # кладовщику цены и суммы не отправляются вообще
                s = line_sum_cents(r["stock"], r["price"])
                totals[r["currency"]] += s
                item.update(price=money_str(r["price"]), currency=r["currency"], sum=money_str(s))
            items.append(item)
        res = {"items": items}
        if prices:
            res["totals"] = {c: money_str(v) for c, v in totals.items()}
        return res

    # -- товары (только руководитель)
    def products(self, user):
        self.require(user, (DIRECTOR,))
        with self.connect() as db:
            rows = db.execute(f"SELECT p.*, {STOCK_SQL} AS stock, "
                              "EXISTS(SELECT 1 FROM ops o WHERE o.product_id=p.id) AS has_moves "
                              "FROM products p ORDER BY p.archived, p.name COLLATE NOCASE").fetchall()
        return {"items": [{"id": r["id"], "name": r["name"], "unit": r["unit"], "price": money_str(r["price"]),
                           "currency": r["currency"], "archived": bool(r["archived"]),
                           "has_moves": bool(r["has_moves"]), "stock": dec_str(r["stock"], QS)} for r in rows]}

    def _product_fields(self, data):
        name = clean_text(data.get("name"), 200)
        if not name:
            raise err("name_empty")
        unit = data.get("unit")
        if unit not in UNITS:
            raise err("bad_unit")
        currency = data.get("currency")
        if currency not in CURRENCIES:
            raise err("bad_currency")
        return name, unit, parse_price(data.get("price")), currency

    def create_product(self, user, data):
        self.require(user, (DIRECTOR,))
        name, unit, price, currency = self._product_fields(data)
        with self.lock, self.connect() as db:
            if db.execute("SELECT 1 FROM products WHERE lower(name)=lower(?)", (name,)).fetchone():
                raise err("name_dup")
            cur = db.execute("INSERT INTO products(name,unit,price,currency,created) VALUES(?,?,?,?,?)",
                             (name, unit, price, currency, now()))
            return {"id": cur.lastrowid}

    def update_product(self, user, pid, data):
        self.require(user, (DIRECTOR,))
        name, unit, price, currency = self._product_fields(data)
        with self.lock, self.connect() as db:
            p = self._get_product(db, pid)
            if db.execute("SELECT 1 FROM products WHERE lower(name)=lower(?) AND id<>?", (name, pid)).fetchone():
                raise err("name_dup")
            if unit != p["unit"] and db.execute("SELECT 1 FROM ops WHERE product_id=?", (pid,)).fetchone():
                raise err("unit_locked")
            db.execute("UPDATE products SET name=?,unit=?,price=?,currency=? WHERE id=?",
                       (name, unit, price, currency, pid))
            return {"id": pid}

    def archive_product(self, user, pid, archived):
        self.require(user, (DIRECTOR,))
        with self.lock, self.connect() as db:
            self._get_product(db, pid)
            db.execute("UPDATE products SET archived=? WHERE id=?", (1 if archived else 0, pid))
            return {"id": pid, "archived": bool(archived)}

    def delete_product(self, user, pid):
        self.require(user, (DIRECTOR,))
        with self.lock, self.connect() as db:
            self._get_product(db, pid)
            if db.execute("SELECT 1 FROM ops WHERE product_id=?", (pid,)).fetchone():
                raise err("has_moves")
            db.execute("DELETE FROM products WHERE id=?", (pid,))
            return {"deleted": pid}

    @staticmethod
    def _get_product(db, pid):
        p = db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
        if not p:
            raise err("not_found", 404)
        return p

    @staticmethod
    def _stock_of(db, pid):
        return db.execute(f"SELECT {STOCK_SQL} FROM products p WHERE p.id=?", (pid,)).fetchone()[0]

    # -- приход / выдача
    def create_op(self, user, data):
        self.require(user, DO_OPS)
        kind = data.get("kind")
        if kind not in ("in", "out"):
            raise err("bad_json")
        key = clean_text(data.get("key"), 100) or None
        try:
            pid = int(data.get("product_id"))
        except (TypeError, ValueError):
            raise err("product_need")
        obj = clean_text(data.get("object"))
        comment = clean_text(data.get("comment"))
        with self.lock, self.connect() as db:
            if key:  # повторная отправка той же формы (двойное нажатие) → та же операция
                dup = db.execute("SELECT id FROM ops WHERE client_key=? AND user_id=?", (key, user["id"])).fetchone()
                if dup:
                    return {"id": dup["id"], "duplicate": True}
            p = self._get_product(db, pid)
            if p["archived"]:
                raise err("archived")
            qty = parse_qty(data.get("qty"), p["unit"])
            if kind == "out":
                if not obj:
                    raise err("object_need")
                left = self._stock_of(db, pid)
                if qty > left:
                    raise err("not_enough", left=human_num(dec_str(left, QS)), unit=UNIT_LABEL[p["unit"]])
            else:
                obj = ""
            cur = db.execute("INSERT INTO ops(kind,product_id,qty,object,comment,user_id,created,client_key) "
                             "VALUES(?,?,?,?,?,?,?,?)", (kind, pid, qty, obj, comment, user["id"], now(), key))
            return {"id": cur.lastrowid, "stock": dec_str(self._stock_of(db, pid), QS)}

    # -- отмена (только руководитель)
    def cancel_op(self, user, op_id):
        self.require(user, (DIRECTOR,))
        with self.lock, self.connect() as db:
            op = db.execute("SELECT o.*, p.unit FROM ops o JOIN products p ON p.id=o.product_id WHERE o.id=?",
                            (op_id,)).fetchone()
            if not op:
                raise err("not_found", 404)
            if op["kind"] == "cancel":
                raise err("cancel_cancel")
            if op["cancelled_at"]:
                raise err("already_cancelled")
            if op["kind"] == "in":
                left = self._stock_of(db, op["product_id"])
                if left - op["qty"] < 0:
                    raise err("cancel_in_minus", left=human_num(dec_str(left, QS)),
                              qty=human_num(dec_str(op["qty"], QS)), unit=UNIT_LABEL[op["unit"]])
            t = now()
            db.execute("UPDATE ops SET cancelled_by=?, cancelled_at=? WHERE id=? AND cancelled_at IS NULL",
                       (user["id"], t, op_id))
            db.execute("INSERT INTO ops(kind,product_id,qty,object,comment,user_id,created,cancel_of) "
                       "VALUES('cancel',?,?,?,?,?,?,?)",
                       (op["product_id"], op["qty"], op["object"], "", user["id"], t, op_id))
            return {"id": op_id, "stock": dec_str(self._stock_of(db, op["product_id"]), QS)}

    # -- история
    def history(self, user):
        self.require(user, SEE_HISTORY)
        with self.connect() as db:
            rows = db.execute("""
              SELECT o.*, p.name AS product, p.unit, u.name AS user_name, cu.name AS cancelled_by_name,
                     u.role AS user_role, cu.role AS cancelled_by_role,
                     orig.kind AS cancel_of_kind
              FROM ops o JOIN products p ON p.id=o.product_id JOIN users u ON u.id=o.user_id
              LEFT JOIN users cu ON cu.id=o.cancelled_by LEFT JOIN ops orig ON orig.id=o.cancel_of
              ORDER BY o.created DESC, o.id DESC""").fetchall()
        return {"items": [{
            "id": r["id"], "kind": r["kind"], "created": r["created"], "user": r["user_name"],
            "product": r["product"], "unit": r["unit"], "qty": dec_str(r["qty"], QS),
            "object": r["object"], "comment": r["comment"], "cancel_of": r["cancel_of"],
            "cancel_of_kind": r["cancel_of_kind"], "cancelled_at": r["cancelled_at"],
            "cancelled_by": r["cancelled_by_name"], "user_role": r["user_role"],
            "cancelled_by_role": r["cancelled_by_role"]} for r in rows]}

    # -- Excel
    def stock_xlsx(self, user, lang):
        data = self.stock(user)
        i = 1 if lang == "uz" else 0
        prices = "totals" in data
        head = [("Товар", "Mahsulot"), ("Ед.", "Birlik"), ("Остаток", "Qoldiq")]
        if prices:
            head += [("Цена", "Narx"), ("Валюта", "Valyuta"), ("Сумма", "Summa")]
        rows = [[h[i] for h in head]]
        for it in data["items"]:
            row = [it["name"], UNIT_LABEL[it["unit"]][i], Decimal(it["stock"])]
            if prices:
                row += [Decimal(it["price"]), CUR_LABEL[it["currency"]][i], Decimal(it["sum"])]
            rows.append(row)
        if prices:
            rows.append([])
            for c, v in data["totals"].items():
                rows.append([("Итого", "Jami")[i], "", "", "", CUR_LABEL[c][i], Decimal(v)])
        return make_xlsx(rows)


def make_xlsx(rows):
    """Минимальный .xlsx без сторонних библиотек."""
    def col(n):
        s = ""
        n += 1
        while n:
            n, r = divmod(n - 1, 26)
            s = chr(65 + r) + s
        return s

    xml_rows = []
    for ri, row in enumerate(rows, 1):
        cells = []
        for ci, v in enumerate(row):
            ref = f"{col(ci)}{ri}"
            if isinstance(v, Decimal):
                cells.append(f'<c r="{ref}"><v>{format(v, "f")}</v></c>')
            elif v != "":
                cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{escape(str(v))}</t></is></c>')
        xml_rows.append(f'<row r="{ri}">{"".join(cells)}</row>')
    sheet = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
             '<cols><col min="1" max="1" width="36" customWidth="1"/><col min="2" max="6" width="14" customWidth="1"/></cols>'
             f'<sheetData>{"".join(xml_rows)}</sheetData></worksheet>')
    files = {
        "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '</Types>',
        "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '</Relationships>',
        "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Sklad" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '</Relationships>',
        "xl/worksheets/sheet1.xml": sheet,
    }
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, content in files.items():
            z.writestr(name, content)
    return buf.getvalue()


# ---------------------------------------------------------------- HTTP
def make_handler(store):
    class Handler(BaseHTTPRequestHandler):
        server_version = "MiniSklad/1.0"

        def log_message(self, fmt, *args):
            pass

        @property
        def lang(self):
            return "uz" if (self.headers.get("X-Lang") or "").lower() == "uz" else "ru"

        def token(self):
            c = SimpleCookie(self.headers.get("Cookie") or "")
            return c["sid"].value if "sid" in c else None

        def body(self):
            n = int(self.headers.get("Content-Length") or 0)
            if n > 1_000_000:
                raise err("bad_json")
            raw = self.rfile.read(n) if n else b"{}"
            try:
                data = json.loads(raw or b"{}")
            except ValueError:
                raise err("bad_json")
            if not isinstance(data, dict):
                raise err("bad_json")
            return data

        def send(self, status, payload, ctype="application/json; charset=utf-8", headers=None):
            body = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            for k, v in (headers or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def handle_api(self, method):
            url = urlparse(self.path)
            path, qs = url.path, parse_qs(url.query)
            if path.startswith("/api/") and method != "GET" and \
                    "application/json" not in (self.headers.get("Content-Type") or ""):
                raise err("bad_json")  # защита от отправки форм с чужих сайтов
            user = store.user_by_token(self.token())

            if path == "/api/login" and method == "POST":
                d = self.body()
                token, u = store.login(d.get("login"), d.get("password"))
                return self.send(200, {"user": u}, headers={
                    "Set-Cookie": f"sid={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000"})
            if path == "/api/logout" and method == "POST":
                store.logout(self.token())
                return self.send(200, {"ok": True}, headers={"Set-Cookie": "sid=; Path=/; Max-Age=0"})
            if path == "/api/me" and method == "GET":
                if not user:
                    raise err("need_login", 401)
                return self.send(200, {"user": user})
            if path == "/api/stock" and method == "GET":
                return self.send(200, store.stock(user, (qs.get("q") or [""])[0]))
            if path == "/api/stock.xlsx" and method == "GET":
                lang = "uz" if (qs.get("lang") or ["ru"])[0] == "uz" else "ru"
                return self.send(200, store.stock_xlsx(user, lang),
                                 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                 {"Content-Disposition": f'attachment; filename="ostatki-{datetime.now():%Y-%m-%d}.xlsx"'})
            if path == "/api/products":
                if method == "GET":
                    return self.send(200, store.products(user))
                if method == "POST":
                    return self.send(200, store.create_product(user, self.body()))
            m = re.fullmatch(r"/api/products/(\d+)(/archive)?", path)
            if m:
                pid = int(m.group(1))
                if m.group(2) and method == "POST":
                    return self.send(200, store.archive_product(user, pid, bool(self.body().get("archived"))))
                if not m.group(2) and method == "PUT":
                    return self.send(200, store.update_product(user, pid, self.body()))
                if not m.group(2) and method == "DELETE":
                    return self.send(200, store.delete_product(user, pid))
            if path == "/api/ops" and method == "POST":
                return self.send(200, store.create_op(user, self.body()))
            m = re.fullmatch(r"/api/ops/(\d+)/cancel", path)
            if m and method == "POST":
                return self.send(200, store.cancel_op(user, int(m.group(1))))
            if path == "/api/history" and method == "GET":
                return self.send(200, store.history(user))
            raise err("not_found", 404)

        def serve_static(self):
            path = urlparse(self.path).path
            name = "index.html" if path in ("/", "") else path.lstrip("/")
            full = os.path.normpath(os.path.join(STATIC, name))
            if not full.startswith(STATIC) or not os.path.isfile(full):
                full = os.path.join(STATIC, "index.html")
            with open(full, "rb") as f:
                data = f.read()
            ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype.endswith("javascript"):
                ctype += "; charset=utf-8"
            self.send(200, data, ctype)

        def dispatch(self, method):
            try:
                if self.path.startswith("/api/"):
                    self.handle_api(method)
                elif method == "GET":
                    self.serve_static()
                else:
                    raise err("not_found", 404)
            except AppError as e:
                self.send(e.status, {"error": e.text(self.lang), "code": e.key})
            except Exception:
                traceback.print_exc()
                self.send(500, {"error": MSG["server"][1 if self.lang == "uz" else 0], "code": "server"})

        def do_GET(self):
            self.dispatch("GET")

        def do_POST(self):
            self.dispatch("POST")

        def do_PUT(self):
            self.dispatch("PUT")

        def do_DELETE(self):
            self.dispatch("DELETE")

    return Handler


def run(port=8000, db_path=None, host="0.0.0.0"):
    store = Store(db_path or os.environ.get("SKLAD_DB", os.path.join(BASE, "sklad.db")))
    httpd = ThreadingHTTPServer((host, port), make_handler(store))
    return httpd


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8000))
    httpd = run(port)
    print(f"Мини-склад запущен: http://localhost:{port}  (остановить: Ctrl+C)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass

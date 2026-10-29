// Автотесты: npm test  (или node --test tests/)
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Store, handle, memoryBackend } from "../src/sklad.mjs";

let store;
beforeEach(() => { store = new Store(memoryBackend()); });

class Client {
  constructor() { this.cookie = null; this.lang = "ru"; }
  async call(method, path, body, raw = false) {
    const headers = { "content-type": "application/json", "x-lang": this.lang };
    if (this.cookie) headers.cookie = this.cookie;
    const res = await handle(new Request("http://test" + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), store);
    const sc = res.headers.get("set-cookie");
    if (sc && sc.startsWith("sid=")) this.cookie = sc.split(";")[0];
    return [res.status, raw ? Buffer.from(await res.arrayBuffer()) : await res.json()];
  }
  async login(l, p) { const [st] = await this.call("POST", "/api/login", { login: l, password: p }); assert.equal(st, 200); return this; }
}
const boss = () => new Client().login("director", "director123");
const sklad = () => new Client().login("sklad", "sklad123");
const mgr = () => new Client().login("manager", "manager123");

async function product(c, name = "Кабель 3×1.5", unit = "m", price = "0,80", currency = "USD") {
  const [st, r] = await c.call("POST", "/api/products", { name, unit, price, currency });
  assert.equal(st, 200, JSON.stringify(r));
  return r.id;
}
const op = (c, kind, product_id, qty, object = "", key = null) =>
  c.call("POST", "/api/ops", { kind, product_id, qty, object, key });
const row = async (c, pid) => (await c.call("GET", "/api/stock"))[1].items.find((i) => i.id === pid);

test("пример из раздела 10 ТЗ, шаг за шагом", async () => {
  const b = await boss(), s = await sklad(), m = await mgr();
  const pid = await product(b);                                                         // 1
  let [st, r] = await op(s, "in", pid, "100"); assert.equal(st, 200); const inId = r.id;  // 2
  let it = await row(b, pid); assert.deepEqual([it.stock, it.sum], ["100", "80.00"]);
  [st, r] = await op(s, "out", pid, "30,5", "Юнусабад, кв. 12"); const outId = r.id;       // 3
  it = await row(b, pid); assert.deepEqual([it.stock, it.sum], ["69.5", "55.60"]);
  [st, r] = await op(s, "out", pid, "80", "Юнусабад, кв. 12");                             // 4
  assert.equal(st, 400); assert.equal(r.error, "На складе только 69,5 м.");
  [st, r] = await b.call("POST", `/api/ops/${inId}/cancel`, {});                          // 5
  assert.equal(st, 400); assert.match(r.error, /уже выдана/);
  [st] = await b.call("POST", `/api/ops/${outId}/cancel`, {});                            // 6
  assert.equal(st, 200); assert.equal((await row(b, pid)).stock, "100");
  it = await row(s, pid);                                                                 // 7
  assert.equal(it.stock, "100"); assert.ok(!("price" in it) && !("sum" in it));
  [st] = await op(m, "in", pid, "1"); assert.equal(st, 403);                              // 8
});

test("не в минус: выдать больше остатка нельзя", async () => {
  const b = await boss();
  const pid = await product(b, "Выключатель", "pcs", "50000", "UZS");
  await op(b, "in", pid, "5");
  const [st, r] = await op(b, "out", pid, "7", "Чиланзар");
  assert.deepEqual([st, r.error], [400, "На складе только 5 шт."]);
  assert.equal((await row(b, pid)).stock, "5");
});

test("не в минус: ровно весь остаток выдать можно", async () => {
  const b = await boss();
  const pid = await product(b, "Датчик", "pcs", "10", "CNY");
  await op(b, "in", pid, "3");
  assert.equal((await op(b, "out", pid, "3", "Объект"))[0], 200);
  assert.equal((await row(b, pid)).stock, "0");
});

test("не в минус: одновременные выдачи", async () => {
  const b = await boss(), s = await sklad();
  const pid = await product(b, "Реле", "pcs", "1", "USD");
  await op(b, "in", pid, "10");
  const res = await Promise.all(Array.from({ length: 8 }, () => op(s, "out", pid, "3", "X")));
  assert.equal(res.filter(([st]) => st === 200).length, 3);
  assert.equal((await row(b, pid)).stock, "1");
});

test("проверки ввода", async () => {
  const b = await boss();
  const pcs = await product(b, "Розетка", "pcs", "1", "USD");
  assert.equal((await op(b, "in", pcs, "1,5"))[1].code, "qty_int");
  const m = await product(b);
  assert.equal((await op(b, "in", m, "12,5"))[0], 200);
  for (const q of ["0", "-1", "abc", ""]) assert.equal((await op(b, "in", m, q))[0], 400, q);
  assert.equal((await op(b, "out", m, "1", "   "))[1].code, "object_need");
  const bad = async (d) => (await b.call("POST", "/api/products", { name: "A", unit: "m", price: "1", currency: "USD", ...d }))[1].code;
  assert.equal(await bad({ name: " " }), "name_empty");
  assert.equal(await bad({ price: "-1" }), "price_neg");
  assert.equal(await bad({ unit: "kg" }), "bad_unit");
  assert.equal(await bad({ currency: "EUR" }), "bad_currency");
  const [st, r] = await b.call("POST", "/api/ops", { kind: "in", product_id: "abc", qty: null });
  assert.equal(st, 400); assert.ok(r.error);
});

test("деньги без ошибок округления: 3 × 0,10 $ = 0,30 $", async () => {
  const b = await boss();
  const pid = await product(b, "Клемма", "pcs", "0,10", "USD");
  await op(b, "in", pid, "3");
  assert.equal((await row(b, pid)).sum, "0.30");
});

test("итоги по каждой валюте отдельно", async () => {
  const b = await boss();
  const a = await product(b, "A", "pcs", "500000", "UZS");
  const c = await product(b, "B", "pcs", "17", "USD");
  const d = await product(b, "C", "pcs", "100", "CNY");
  await op(b, "in", a, "25"); await op(b, "in", c, "20"); await op(b, "in", d, "12");
  assert.deepEqual((await b.call("GET", "/api/stock"))[1].totals, { UZS: "12500000.00", USD: "340.00", CNY: "1200.00" });
});

test("кладовщик: цены не приходят ни в одном ответе", async () => {
  const b = await boss(), s = await sklad();
  await product(b);
  const [, r] = await s.call("GET", "/api/stock");
  assert.ok(!("totals" in r)); assert.ok(!JSON.stringify(r).includes("price"));
  assert.equal((await s.call("GET", "/api/products"))[0], 403);
  assert.equal((await s.call("GET", "/api/history"))[0], 403);
  const [st, xl] = await s.call("GET", "/api/stock.xlsx", undefined, true);
  assert.equal(st, 200);
  const text = xl.toString("utf8");
  assert.ok(text.includes("Остаток") && !text.includes("Цена") && !text.includes("0.80"));
});

test("кладовщик: товары и отмена запрещены", async () => {
  const b = await boss(), s = await sklad();
  const pid = await product(b);
  const p = { name: "X", unit: "m", price: "1", currency: "USD" };
  assert.equal((await s.call("POST", "/api/products", p))[0], 403);
  assert.equal((await s.call("PUT", `/api/products/${pid}`, p))[0], 403);
  const [, r] = await op(s, "in", pid, "5");
  assert.equal((await s.call("POST", `/api/ops/${r.id}/cancel`, {}))[0], 403);
});

test("менеджер только смотрит", async () => {
  const b = await boss(), m = await mgr();
  const pid = await product(b);
  const [st, r] = await m.call("GET", "/api/stock");
  assert.equal(st, 200); assert.ok("totals" in r);
  assert.equal((await m.call("GET", "/api/history"))[0], 200);
  assert.equal((await op(m, "in", pid, "1"))[0], 403);
  assert.equal((await m.call("POST", "/api/products", { name: "X", unit: "m", price: "1", currency: "USD" }))[0], 403);
});

test("без входа и с неверным паролем", async () => {
  assert.equal((await new Client().call("GET", "/api/stock"))[0], 401);
  assert.equal((await new Client().call("POST", "/api/login", { login: "director", password: "x" }))[0], 401);
});

test("отмена: дважды нельзя, остаётся в истории, отмену не отменить", async () => {
  const b = await boss(), s = await sklad(), m = await mgr();
  const pid = await product(b);
  const [, r] = await op(s, "in", pid, "5");
  assert.equal((await b.call("POST", `/api/ops/${r.id}/cancel`, {}))[0], 200);
  const [st, e] = await b.call("POST", `/api/ops/${r.id}/cancel`, {});
  assert.deepEqual([st, e.code], [400, "already_cancelled"]);
  assert.equal((await row(b, pid)).stock, "0");
  const items = (await m.call("GET", "/api/history"))[1].items;
  assert.deepEqual(items.map((i) => i.kind), ["cancel", "in"]); // новые сверху
  assert.equal(items[1].cancelled_by, "Руководитель"); assert.ok(items[1].cancelled_at);
  assert.equal((await b.call("POST", `/api/ops/${items[0].id}/cancel`, {}))[1].code, "cancel_cancel");
});

test("отмена прихода разрешена, если остаток позволяет", async () => {
  const b = await boss();
  const pid = await product(b);
  const [, a] = await op(b, "in", pid, "10");
  await op(b, "in", pid, "10"); await op(b, "out", pid, "5", "X");
  assert.equal((await b.call("POST", `/api/ops/${a.id}/cancel`, {}))[0], 200);
  assert.equal((await row(b, pid)).stock, "5");
});

test("двойное нажатие: один ключ — одна операция (в том числе одновременно)", async () => {
  const b = await boss(), s = await sklad();
  const pid = await product(b);
  const r1 = (await op(s, "in", pid, "10", "", "k-1"))[1];
  const r2 = (await op(s, "in", pid, "10", "", "k-1"))[1];
  assert.equal(r1.id, r2.id);
  await Promise.all(Array.from({ length: 6 }, () => op(s, "in", pid, "10", "", "same")));
  assert.equal((await row(b, pid)).stock, "20");
});

test("товар с движениями не удаляется, только в архив", async () => {
  const b = await boss(), s = await sklad();
  const pid = await product(b);
  await op(b, "in", pid, "1");
  const [st, r] = await b.call("DELETE", `/api/products/${pid}`);
  assert.deepEqual([st, r.code], [400, "has_moves"]);
  assert.equal((await b.call("POST", `/api/products/${pid}/archive`, { archived: true }))[0], 200);
  assert.deepEqual((await s.call("GET", "/api/stock"))[1].items, []);
  const p2 = await product(b, "Без движений");
  assert.equal((await b.call("DELETE", `/api/products/${p2}`))[0], 200);
});

test("ошибки на узбекском", async () => {
  const b = await boss();
  const pid = await product(b, "Kabel", "pcs", "1", "USD");
  b.lang = "uz";
  assert.equal((await op(b, "out", pid, "7", "X"))[1].error, "Omborda faqat 0 dona bor.");
});

test("неизвестный адрес и мусор вместо JSON — понятная ошибка, не 500", async () => {
  const b = await boss();
  assert.equal((await b.call("GET", "/api/nope"))[0], 404);
  const res = await handle(new Request("http://test/api/ops", {
    method: "POST", headers: { "content-type": "application/json", cookie: b.cookie }, body: "{oops" }), store);
  assert.equal(res.status, 400);
  assert.ok((await res.json()).error);
});

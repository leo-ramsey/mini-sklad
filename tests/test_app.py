"""Автотесты: python -m unittest discover tests"""
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server  # noqa: E402


class Client:
    def __init__(self, base):
        self.base, self.cookie = base, None

    def call(self, method, path, body=None, raw=False):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if self.cookie:
            req.add_header("Cookie", self.cookie)
        try:
            with urllib.request.urlopen(req) as r:
                status, payload, headers = r.status, r.read(), r.headers
        except urllib.error.HTTPError as e:
            status, payload, headers = e.code, e.read(), e.headers
        sc = headers.get("Set-Cookie")
        if sc and sc.startswith("sid="):
            self.cookie = sc.split(";")[0]
        return status, (payload if raw else json.loads(payload))

    def login(self, login, pwd):
        st, _ = self.call("POST", "/api/login", {"login": login, "password": pwd})
        assert st == 200
        return self


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = os.path.join(self.tmp.name, "t.db")
        self.start()

    def start(self):
        self.httpd = server.run(0, self.db, "127.0.0.1")
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        self.boss = Client(self.base).login("director", "director123")
        self.sklad = Client(self.base).login("sklad", "sklad123")
        self.mgr = Client(self.base).login("manager", "manager123")

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()

    def tearDown(self):
        self.stop()
        self.tmp.cleanup()

    def product(self, name="Кабель 3×1.5", unit="m", price="0,80", cur="USD"):
        st, r = self.boss.call("POST", "/api/products", {"name": name, "unit": unit, "price": price, "currency": cur})
        self.assertEqual(st, 200, r)
        return r["id"]

    def op(self, who, kind, pid, qty, obj="", key=None):
        return who.call("POST", "/api/ops", {"kind": kind, "product_id": pid, "qty": qty, "object": obj, "key": key})

    def row(self, who, pid):
        return next(i for i in who.call("GET", "/api/stock")[1]["items"] if i["id"] == pid)


class ScenarioFromSpec(Base):
    """Раздел 10 ТЗ, шаг за шагом."""

    def test_full_scenario(self):
        pid = self.product()                                                    # 1
        st, r = self.op(self.sklad, "in", pid, "100"); self.assertEqual(st, 200)  # 2
        in_id = r["id"]
        row = self.row(self.boss, pid)
        self.assertEqual((row["stock"], row["sum"]), ("100", "80.00"))
        st, r = self.op(self.sklad, "out", pid, "30,5", "Юнусабад, кв. 12")      # 3
        out_id = r["id"]
        row = self.row(self.boss, pid)
        self.assertEqual((row["stock"], row["sum"]), ("69.5", "55.60"))
        st, r = self.op(self.sklad, "out", pid, "80", "Юнусабад, кв. 12")        # 4
        self.assertEqual(st, 400)
        self.assertEqual(r["error"], "На складе только 69,5 м.")
        st, r = self.boss.call("POST", f"/api/ops/{in_id}/cancel")              # 5
        self.assertEqual(st, 400)
        self.assertIn("уже выдана", r["error"])
        st, r = self.boss.call("POST", f"/api/ops/{out_id}/cancel")             # 6
        self.assertEqual(st, 200)
        self.assertEqual(self.row(self.boss, pid)["stock"], "100")
        row = self.row(self.sklad, pid)                                          # 7
        self.assertEqual(row["stock"], "100")
        self.assertNotIn("price", row); self.assertNotIn("sum", row)
        st, r = self.op(self.mgr, "in", pid, "1")                                # 8
        self.assertEqual(st, 403)


class NoMinus(Base):
    def test_out_more_than_stock(self):
        pid = self.product("Выключатель", "pcs", "50000", "UZS")
        self.op(self.boss, "in", pid, "5")
        st, r = self.op(self.boss, "out", pid, "7", "Чиланзар")
        self.assertEqual((st, r["error"]), (400, "На складе только 5 шт."))
        self.assertEqual(self.row(self.boss, pid)["stock"], "5")

    def test_out_exact_stock_ok(self):
        pid = self.product("Датчик", "pcs", "10", "CNY")
        self.op(self.boss, "in", pid, "3")
        self.assertEqual(self.op(self.boss, "out", pid, "3", "Объект")[0], 200)
        self.assertEqual(self.row(self.boss, pid)["stock"], "0")

    def test_parallel_outs_never_go_negative(self):
        pid = self.product("Реле", "pcs", "1", "USD")
        self.op(self.boss, "in", pid, "10")
        results = []
        ts = [threading.Thread(target=lambda: results.append(self.op(self.sklad, "out", pid, "3", "X")[0]))
              for _ in range(8)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual(results.count(200), 3)
        self.assertEqual(self.row(self.boss, pid)["stock"], "1")


class Validation(Base):
    def test_pcs_integer_only(self):
        pid = self.product("Розетка", "pcs", "1", "USD")
        st, r = self.op(self.boss, "in", pid, "1,5")
        self.assertEqual(r["code"], "qty_int")

    def test_meters_fraction(self):
        pid = self.product()
        self.assertEqual(self.op(self.boss, "in", pid, "12,5")[0], 200)

    def test_bad_qty(self):
        pid = self.product()
        for q in ("0", "-1", "abc", ""):
            self.assertEqual(self.op(self.boss, "in", pid, q)[0], 400, q)

    def test_object_required(self):
        pid = self.product()
        self.op(self.boss, "in", pid, "10")
        st, r = self.op(self.boss, "out", pid, "1", "   ")
        self.assertEqual(r["code"], "object_need")

    def test_product_rules(self):
        c = self.boss
        self.assertEqual(c.call("POST", "/api/products", {"name": " ", "unit": "m", "price": "1", "currency": "USD"})[1]["code"], "name_empty")
        self.assertEqual(c.call("POST", "/api/products", {"name": "A", "unit": "m", "price": "-1", "currency": "USD"})[1]["code"], "price_neg")
        self.assertEqual(c.call("POST", "/api/products", {"name": "A", "unit": "kg", "price": "1", "currency": "USD"})[1]["code"], "bad_unit")
        self.assertEqual(c.call("POST", "/api/products", {"name": "A", "unit": "m", "price": "1", "currency": "EUR"})[1]["code"], "bad_currency")

    def test_no_crash_on_garbage(self):
        st, r = self.boss.call("POST", "/api/ops", {"kind": "in", "product_id": "abc", "qty": None})
        self.assertEqual(st, 400)
        self.assertTrue(r["error"])


class Money(Base):
    def test_no_float_errors(self):
        pid = self.product("Клемма", "pcs", "0,10", "USD")
        self.op(self.boss, "in", pid, "3")
        row = self.row(self.boss, pid)
        self.assertEqual(row["sum"], "0.30")

    def test_totals_per_currency_not_converted(self):
        a = self.product("A", "pcs", "500000", "UZS")
        b = self.product("B", "pcs", "17", "USD")
        c = self.product("C", "pcs", "100", "CNY")
        self.op(self.boss, "in", a, "25"); self.op(self.boss, "in", b, "20"); self.op(self.boss, "in", c, "12")
        totals = self.boss.call("GET", "/api/stock")[1]["totals"]
        self.assertEqual(totals, {"UZS": "12500000.00", "USD": "340.00", "CNY": "1200.00"})


class Roles(Base):
    def test_storekeeper_never_gets_prices(self):
        pid = self.product()
        st, r = self.sklad.call("GET", "/api/stock")
        self.assertNotIn("totals", r)
        self.assertNotIn("price", json.dumps(r))
        self.assertEqual(self.sklad.call("GET", "/api/products")[0], 403)
        self.assertEqual(self.sklad.call("GET", "/api/history")[0], 403)
        st, raw = self.sklad.call("GET", "/api/stock.xlsx", raw=True)
        self.assertEqual(st, 200)
        import io, zipfile
        sheet = zipfile.ZipFile(io.BytesIO(raw)).read("xl/worksheets/sheet1.xml").decode()
        self.assertNotIn("Цена", sheet); self.assertNotIn("0.80", sheet)

    def test_storekeeper_cannot_manage(self):
        pid = self.product()
        self.assertEqual(self.sklad.call("POST", "/api/products", {"name": "X", "unit": "m", "price": "1", "currency": "USD"})[0], 403)
        self.assertEqual(self.sklad.call("PUT", f"/api/products/{pid}", {"name": "X", "unit": "m", "price": "1", "currency": "USD"})[0], 403)
        _, r = self.op(self.sklad, "in", pid, "5")
        self.assertEqual(self.sklad.call("POST", f"/api/ops/{r['id']}/cancel")[0], 403)

    def test_manager_read_only(self):
        pid = self.product()
        st, r = self.mgr.call("GET", "/api/stock")
        self.assertEqual(st, 200); self.assertIn("totals", r)
        self.assertEqual(self.mgr.call("GET", "/api/history")[0], 200)
        self.assertEqual(self.op(self.mgr, "in", pid, "1")[0], 403)
        self.assertEqual(self.mgr.call("POST", "/api/products", {"name": "X", "unit": "m", "price": "1", "currency": "USD"})[0], 403)

    def test_anonymous(self):
        self.assertEqual(Client(self.base).call("GET", "/api/stock")[0], 401)

    def test_bad_password(self):
        st, r = Client(self.base).call("POST", "/api/login", {"login": "director", "password": "x"})
        self.assertEqual(st, 401)


class Cancel(Base):
    def test_cancel_twice(self):
        pid = self.product()
        _, r = self.op(self.boss, "in", pid, "5")
        self.assertEqual(self.boss.call("POST", f"/api/ops/{r['id']}/cancel")[0], 200)
        st, e = self.boss.call("POST", f"/api/ops/{r['id']}/cancel")
        self.assertEqual((st, e["code"]), (400, "already_cancelled"))
        self.assertEqual(self.row(self.boss, pid)["stock"], "0")

    def test_cancel_stays_in_history(self):
        pid = self.product()
        _, r = self.op(self.sklad, "in", pid, "5")
        self.boss.call("POST", f"/api/ops/{r['id']}/cancel")
        items = self.mgr.call("GET", "/api/history")[1]["items"]
        self.assertEqual([i["kind"] for i in items], ["cancel", "in"])  # новые сверху
        orig = items[1]
        self.assertEqual(orig["cancelled_by"], "Руководитель")
        self.assertTrue(orig["cancelled_at"])
        cancel_row = items[0]
        self.assertEqual(self.boss.call("POST", f"/api/ops/{cancel_row['id']}/cancel")[1]["code"], "cancel_cancel")

    def test_cancel_in_ok_when_stock_allows(self):
        pid = self.product()
        _, a = self.op(self.boss, "in", pid, "10")
        self.op(self.boss, "in", pid, "10")
        self.op(self.boss, "out", pid, "5", "X")
        self.assertEqual(self.boss.call("POST", f"/api/ops/{a['id']}/cancel")[0], 200)
        self.assertEqual(self.row(self.boss, pid)["stock"], "5")


class DoubleClick(Base):
    def test_same_key_written_once(self):
        pid = self.product()
        r1 = self.op(self.sklad, "in", pid, "10", key="k-1")[1]
        r2 = self.op(self.sklad, "in", pid, "10", key="k-1")[1]
        self.assertEqual(r1["id"], r2["id"])
        self.assertEqual(self.row(self.boss, pid)["stock"], "10")

    def test_parallel_same_key(self):
        pid = self.product()
        ts = [threading.Thread(target=lambda: self.op(self.sklad, "in", pid, "10", key="same")) for _ in range(6)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual(self.row(self.boss, pid)["stock"], "10")


class ProductsArchive(Base):
    def test_cannot_delete_with_moves(self):
        pid = self.product()
        self.op(self.boss, "in", pid, "1")
        st, r = self.boss.call("DELETE", f"/api/products/{pid}")
        self.assertEqual((st, r["code"]), (400, "has_moves"))
        self.assertEqual(self.boss.call("POST", f"/api/products/{pid}/archive", {"archived": True})[0], 200)
        self.assertEqual(self.sklad.call("GET", "/api/stock")[1]["items"], [])

    def test_delete_without_moves(self):
        pid = self.product()
        self.assertEqual(self.boss.call("DELETE", f"/api/products/{pid}")[0], 200)


class Persistence(Base):
    def test_survives_restart(self):
        pid = self.product()
        self.op(self.boss, "in", pid, "42")
        self.stop()
        self.start()
        self.assertEqual(self.row(self.boss, pid)["stock"], "42")


class Lang(Base):
    def test_uzbek_errors(self):
        pid = self.product("Kabel", "pcs", "1", "USD")
        req = urllib.request.Request(self.base + "/api/ops", method="POST",
                                     data=json.dumps({"kind": "out", "product_id": pid, "qty": "7", "object": "X"}).encode())
        req.add_header("Content-Type", "application/json"); req.add_header("X-Lang", "uz")
        req.add_header("Cookie", self.boss.cookie)
        with self.assertRaises(urllib.error.HTTPError) as cm:
            urllib.request.urlopen(req)
        self.assertEqual(json.loads(cm.exception.read())["error"], "Omborda faqat 0 dona bor.")


if __name__ == "__main__":
    unittest.main()

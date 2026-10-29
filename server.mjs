// Мини-склад: локальный сервер. Запуск: npm start  →  http://localhost:8000
//
// Настройки (файл .env рядом с этим файлом или переменные окружения):
//   PORT=8000                  порт
//   HOST=127.0.0.1             127.0.0.1 — только этот компьютер; 0.0.0.0 — ещё и телефоны в той же Wi-Fi сети
//   SKLAD_DATA=data/sklad.json где хранить данные
//   SKLAD_PASSWORD_DIRECTOR / SKLAD_PASSWORD_STOCKMAN / SKLAD_PASSWORD_MANAGER, SKLAD_REQUIRE_ENV_PASSWORDS=1
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Store, fileBackend, handle } from "./src/sklad.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "127.0.0.1";
const DATA = path.resolve(ROOT, process.env.SKLAD_DATA || "data/sklad.json");
const MAX_BODY = 64 * 1024;

// Заголовки безопасности на каждый ответ: скрипты только свои (XSS), сайт нельзя встроить в чужую страницу,
// браузер не угадывает типы файлов, адрес не утекает в Referer, нет доступа к камере/микрофону/геолокации.
const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
    "connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

const store = new Store(fileBackend(DATA));

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.normalize(path.join(PUBLIC, urlPath === "/" ? "index.html" : urlPath));
  // Только файлы из public/ — никаких «../server.mjs» или данных склада.
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    file = path.join(PUBLIC, "index.html");
  }
  const body = fs.readFileSync(file);
  res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
    "Content-Length": body.length, "Cache-Control": "no-cache" });
  res.end(req.method === "HEAD" ? undefined : body);
}

async function serveApi(req, res) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) { res.writeHead(413, SECURITY_HEADERS); res.end(); req.destroy(); return; }
    chunks.push(c);
  }
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const request = new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const response = await handle(request, store, { ip: req.socket.remoteAddress || "" });
  const out = { ...SECURITY_HEADERS };
  response.headers.forEach((v, k) => { out[k] = v; });
  res.writeHead(response.status, out);
  res.end(Buffer.from(await response.arrayBuffer()));
}

/**
 * Защита от DNS rebinding: чужой сайт может направить своё доменное имя на 127.0.0.1 и обращаться к серверу
 * из браузера жертвы. Поэтому принимаем только обращения по localhost или по IP-адресу.
 */
function allowedHost(host) {
  const name = String(host || "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  return name === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(name) || /^[0-9a-f:]+$/.test(name);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!allowedHost(req.headers.host)) { res.writeHead(421, SECURITY_HEADERS); res.end("Misdirected Request"); return; }
    if (req.url.startsWith("/api/")) await serveApi(req, res);
    else if (req.method === "GET" || req.method === "HEAD") serveStatic(req, res);
    else { res.writeHead(405, SECURITY_HEADERS); res.end(); }
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500, { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Что-то пошло не так на сервере. Обновите страницу и попробуйте ещё раз.", code: "server" }));
  }
});
// Защита от «медленных» клиентов, которые держат соединения открытыми.
server.headersTimeout = 15000;
server.requestTimeout = 30000;

server.listen(PORT, HOST, () => {
  console.log(`Мини-склад запущен: http://localhost:${PORT}  (данные: ${path.relative(ROOT, DATA)}; остановить: Ctrl+C)`);
  if (HOST === "0.0.0.0") console.log("Доступ из локальной сети открыт: http://<IP-этого-компьютера>:" + PORT);
});

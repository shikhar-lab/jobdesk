// SERVER: shows your website, answers the API, and runs the bot — all in one command:  node server.js
const http = require("http"), fs = require("fs"), path = require("path");
const db = require("./db"), bot = require("./bot");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};

function send(res, code, body, type, headers) {
  res.writeHead(code, Object.assign({ "Content-Type": type }, headers));
  res.end(body);
}

const server = http.createServer((req, res) => {
  let u;
  try { u = new URL(req.url, "http://localhost"); } catch (e) { return send(res, 400, "Bad request", "text/plain"); }

  // API: the website asks for jobs here.  Example: /api/jobs?q=data&source=Greenhouse&limit=30
  if (u.pathname === "/api/jobs") {
    try {
      const p = u.searchParams;
      const { total, jobs } = db.listJobs({
        q: p.get("q") || "", source: p.get("source") || "", limit: p.get("limit") || 30, offset: p.get("offset") || 0
      });
      return send(res, 200, JSON.stringify({ total, jobs, sources: db.sources(), lastScan: db.lastScan() }),
        "application/json", { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
    } catch (e) {
      console.log("API error:", e.message);
      return send(res, 500, JSON.stringify({ error: "Server error" }), "application/json");
    }
  }

  // jobs.json: the website loads all jobs from here and filters them in the browser
  if (u.pathname === "/jobs.json") {
    return send(res, 200, JSON.stringify({ jobs: db.recent(2000), lastScan: db.lastScan() }), "application/json", { "Cache-Control": "no-store" });
  }

  // Bot health: shows when each source was last scanned and if it failed.  Open /api/status
  if (u.pathname === "/api/status") {
    return send(res, 200, JSON.stringify(db.scanReport(), null, 2), "application/json", { "Cache-Control": "no-store" });
  }

  // Everything else = website files from the "public" folder
  let p;
  try { p = decodeURIComponent(u.pathname); } catch (e) { return send(res, 400, "Bad request", "text/plain"); }
  if (p === "/") p = "/index.html";
  const file = path.join(PUBLIC, path.normalize(p));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, "Forbidden", "text/plain");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain");
    send(res, 200, data, TYPES[path.extname(file)] || "application/octet-stream");
  });
});

server.on("error", e => {
  if (e.code === "EADDRINUSE") console.log("Port " + PORT + " is already in use. Close the other terminal that runs the server and try again.");
  else console.log("Server error:", e.message);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log("Website is live:  http://localhost:" + PORT);
  console.log("Job data (API):   http://localhost:" + PORT + "/api/jobs");
  console.log("Bot status:       http://localhost:" + PORT + "/api/status");
  bot.start();
});

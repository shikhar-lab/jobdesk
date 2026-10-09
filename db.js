// DATABASE: saves every job in one file (data/jobs.db). Needs Node 22.13 or newer.
const { DatabaseSync } = require("node:sqlite");
const fs = require("fs"), path = require("path");

const FILE = process.env.DB_FILE || path.join(__dirname, "data", "jobs.db");
if (FILE !== ":memory:") fs.mkdirSync(path.dirname(FILE), { recursive: true });
const db = new DatabaseSync(FILE);

db.exec(`
CREATE TABLE IF NOT EXISTS jobs (
  id       TEXT PRIMARY KEY,           -- unique id, so the same job is never saved twice
  title    TEXT NOT NULL,
  company  TEXT,
  location TEXT,
  url      TEXT NOT NULL,              -- link to the original job post
  source   TEXT NOT NULL,              -- which site the bot found it on
  posted   TEXT,                       -- date given by the source site
  seen_at  INTEGER NOT NULL DEFAULT 0  -- when our bot found it (0 = existed before the bot started)
);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_seen ON jobs(seen_at);
CREATE TABLE IF NOT EXISTS scans (
  source TEXT PRIMARY KEY,             -- one row per source: result of its latest scan
  ok     INTEGER,
  last   INTEGER,
  added  INTEGER,
  error  TEXT
);
`);

const insert = db.prepare(
  "INSERT OR IGNORE INTO jobs (id,title,company,location,url,source,posted,seen_at) VALUES (?,?,?,?,?,?,?,?)"
);

// Save a list of jobs. Returns how many were NEW. Jobs already saved are skipped.
// firstScan = true means "these jobs already existed", so they are not marked NEW.
function addMany(list, source, firstScan) {
  const t = firstScan ? 0 : Date.now();
  let added = 0;
  db.exec("BEGIN");
  try {
    for (const j of list) {
      if (!j.id || !j.title || !j.url) continue;
      const r = insert.run(String(j.id), String(j.title), j.company ?? null, j.location ?? null,
        String(j.url), source, j.posted == null ? null : String(j.posted), t);
      added += Number(r.changes);
    }
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  return added;
}

// Get jobs for the website: newest first, with search, source filter and paging.
function listJobs({ q = "", source = "", limit = 30, offset = 0 } = {}) {
  const where = [], args = [];
  if (source) { where.push("source = ?"); args.push(source); }
  if (q) {
    const like = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
    where.push("(title LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\')");
    args.push(like, like, like);
  }
  const w = where.length ? " WHERE " + where.join(" AND ") : "";
  const total = Number(db.prepare("SELECT COUNT(*) AS n FROM jobs" + w).get(...args).n);
  const rows = db.prepare(
    "SELECT id,title,company,location,url,source,posted,seen_at FROM jobs" + w +
    " ORDER BY seen_at DESC, rowid DESC LIMIT ? OFFSET ?"
  ).all(...args, Math.min(+limit || 30, 200), +offset || 0);
  return { total, jobs: rows.map(r => ({ ...r, seenAt: r.seen_at, seen_at: undefined })) };
}

const sources = () => db.prepare("SELECT DISTINCT source FROM jobs ORDER BY source").all().map(r => r.source);

function recordScan(source, ok, added = 0, error = null) {
  db.prepare("INSERT OR REPLACE INTO scans (source,ok,last,added,error) VALUES (?,?,?,?,?)")
    .run(source, ok ? 1 : 0, Date.now(), added, error);
}
const isFirstScan = source => !db.prepare("SELECT 1 FROM scans WHERE source = ? AND ok = 1").get(source);
const lastScan = () => Number(db.prepare("SELECT COALESCE(MAX(last),0) AS t FROM scans").get().t);
const scanReport = () => db.prepare("SELECT * FROM scans ORDER BY source").all();

// Keep the database small: delete the oldest jobs beyond `max`.
function prune(max = 20000) {
  db.prepare("DELETE FROM jobs WHERE rowid NOT IN (SELECT rowid FROM jobs ORDER BY seen_at DESC, rowid DESC LIMIT ?)").run(max);
}

const has = id => !!db.prepare("SELECT 1 FROM jobs WHERE id = ?").get(String(id));

// Newest jobs in one list (used by the website's jobs.json and the free-hosting export)
function recent(n = 2000) {
  return db.prepare("SELECT id,title,company,location,url,source,posted,seen_at FROM jobs ORDER BY seen_at DESC, rowid DESC LIMIT ?")
    .all(n).map(r => ({ id: r.id, title: r.title, company: r.company, location: r.location, url: r.url, source: r.source, posted: r.posted, seenAt: r.seen_at }));
}

module.exports = { addMany, listJobs, sources, recordScan, isFirstScan, lastScan, scanReport, prune, has, recent };

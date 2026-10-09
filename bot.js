// BOT: visits job sites again and again and saves new jobs into the database.
//   node bot.js --once   -> scan every source one time, print result, stop (use this to test)
//   node bot.js          -> keep scanning forever (stop with Ctrl+C)
const db = require("./db");

// ---- EDIT THIS PART ----
const GREENHOUSE = ["stripe", "airbnb", "discord", "cloudflare", "figma", "postman", "razorpaysoftwareprivatelimited", "groww", "browserstack"]; // names from boards.greenhouse.io/NAME
const LEVER = ["palantir", "spotify", "cred", "meesho", "paytm", "upgrad"];                                      // names from jobs.lever.co/NAME
const COMPANY_SCAN_SECONDS = 60;   // company boards are checked this often
const BOARD_SCAN_MINUTES = 30;     // big job boards are checked this often (faster gets you blocked)
// ------------------------

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const log = m => console.log("[" + new Date().toLocaleTimeString() + "] " + m);
async function getJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": "JobBot/1.0" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

// Every source = a name, how often to check, and how to read its jobs.
// Each job is turned into the same shape: { id, title, company, location, url, posted }
const SOURCES = [];
GREENHOUSE.forEach(t => SOURCES.push({
  key: "Greenhouse: " + t, source: "Greenhouse", every: COMPANY_SCAN_SECONDS * 1000,
  load: async () => (await getJSON("https://boards-api.greenhouse.io/v1/boards/" + t + "/jobs")).jobs
    .map(j => ({ id: "gh" + j.id, title: j.title, company: cap(t), location: (j.location || {}).name, url: j.absolute_url, posted: j.updated_at }))
}));
LEVER.forEach(c => SOURCES.push({
  key: "Lever: " + c, source: "Lever", every: COMPANY_SCAN_SECONDS * 1000,
  load: async () => (await getJSON("https://api.lever.co/v0/postings/" + c + "?mode=json"))
    .map(j => ({ id: "lv" + j.id, title: j.text, company: cap(c), location: (j.categories || {}).location, url: j.hostedUrl, posted: j.createdAt }))
}));
SOURCES.push(
  { key: "Remotive", source: "Remotive", every: BOARD_SCAN_MINUTES * 60000,
    load: async () => (await getJSON("https://remotive.com/api/remote-jobs")).jobs
      .map(j => ({ id: "rm" + j.id, title: j.title, company: j.company_name, location: j.candidate_required_location, url: j.url, posted: j.publication_date })) },
  { key: "RemoteOK", source: "RemoteOK", every: BOARD_SCAN_MINUTES * 60000,
    load: async () => (await getJSON("https://remoteok.com/api")).filter(j => j.id)
      .map(j => ({ id: "ro" + j.id, title: j.position, company: j.company, location: j.location || "Remote", url: j.url, posted: j.date })) },
  { key: "Arbeitnow", source: "Arbeitnow", every: BOARD_SCAN_MINUTES * 60000,
    load: async () => (await getJSON("https://www.arbeitnow.com/api/job-board-api")).data
      .map(j => ({ id: "an" + j.slug, title: j.title, company: j.company_name, location: j.location, url: j.url, posted: j.created_at })) }
);

// Adzuna India (official free API). Needs ADZUNA_ID and ADZUNA_KEY secrets. Runs every 4 hours to stay inside the free limit.
if (process.env.ADZUNA_ID && process.env.ADZUNA_KEY) SOURCES.push({
  key: "Adzuna India", source: "Adzuna", every: 4 * 3600 * 1000,
  load: async () => {
    const out = [];
    for (const p of [1, 2]) {
      const d = await getJSON("https://api.adzuna.com/v1/api/jobs/in/search/" + p + "?app_id=" + process.env.ADZUNA_ID + "&app_key=" + process.env.ADZUNA_KEY + "&results_per_page=50&sort_by=date");
      for (const j of d.results || []) out.push({ id: "az" + j.id, title: String(j.title || "").replace(/<[^>]+>/g, ""), company: (j.company || {}).display_name || "Company not stated", location: (j.location || {}).display_name, url: j.redirect_url, posted: j.created });
    }
    return out;
  }
});

// Free translation (MyMemory). If it fails or the daily free limit is over, the original title is kept.
const needsEnglish = t => /[^\x00-\x7F\u2010-\u2015\u2018-\u201F\u00A0\u2026\u00B7\u2022]/.test(t) || /\((m|w|f|d)\/(m|w|f|d)(\/(m|w|f|d))?\)/i.test(t);
async function toEnglish(t) {
  try {
    const from = /[\u0900-\u097F]/.test(t) ? "hi" : "Autodetect";
    const r = await getJSON("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(t) + "&langpair=" + from + "|en");
    const out = r.responseData && r.responseData.translatedText;
    return out && r.responseStatus == 200 && !/MYMEMORY WARNING/i.test(out) ? out : t;
  } catch (e) { return t; }
}

const busy = new Set(), done = new Set();
async function scan(s) {
  if (busy.has(s.key)) return;
  busy.add(s.key);
  try {
    // The very first scan only loads jobs that already existed, so they are not marked NEW.
    const first = !done.has(s.key) && db.isFirstScan(s.key);
    const list = await s.load();
    // Titles in Hindi, German etc. are translated to English (only new jobs, max 40 per scan to stay inside the free limit)
    list.filter(j => !db.has(j.id) && needsEnglish(j.title)).slice(0, 40).forEach(j => j.pending = true);
    for (const j of list) if (j.pending) { j.title = await toEnglish(j.title); delete j.pending; }
    const added = db.addMany(list, s.source, first);
    db.recordScan(s.key, true, added);
    done.add(s.key);
    log(s.key + ": " + added + " " + (first ? "jobs saved (first scan)" : "NEW jobs"));
  } catch (e) {
    db.recordScan(s.key, false, 0, String(e.message || e));
    log(s.key + " FAILED: " + (e.message || e));
  } finally { busy.delete(s.key); }
}

function start() {
  log("Bot started. Watching " + SOURCES.length + " sources.");
  SOURCES.forEach((s, i) => setTimeout(() => { scan(s); setInterval(() => scan(s), s.every); }, i * 1500)); // staggered
  setInterval(() => db.prune(), 6 * 3600 * 1000);
}

module.exports = { start };

if (require.main === module) {
  if (process.argv.includes("--once")) {
    (async () => {
      const rep = db.scanReport();
      for (const s of SOURCES) {
        const r = rep.find(x => x.source === s.key);
        if (r && Date.now() - r.last < s.every - 60000) continue; // not due yet: keeps big boards and Adzuna inside their free limits
        await scan(s);
      }
      log("Done. Jobs in database: " + db.listJobs().total);
      process.exit(0);
    })();
  } else start();
}

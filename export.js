// Writes public/jobs.json from the database (used by the free GitHub Actions setup).
const fs = require("fs"), path = require("path"), db = require("./db");
const out = path.join(__dirname, "public", "jobs.json");
const jobs = db.recent(2000);
let old = [];
try { old = JSON.parse(fs.readFileSync(out, "utf8")).jobs; } catch (e) {}
if (JSON.stringify(old) === JSON.stringify(jobs)) console.log("No new jobs, file unchanged.");
else { fs.writeFileSync(out, JSON.stringify({ jobs, lastScan: db.lastScan() })); console.log("Saved " + jobs.length + " jobs to public/jobs.json"); }

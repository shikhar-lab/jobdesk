// Run:  node test-db.js   — checks that the database works (uses temporary memory, saves nothing)
process.env.DB_FILE = ":memory:";
const db = require("./db");

const sample = [
  { id: "t1", title: "Data Analyst", company: "Brightleaf", location: "Bhopal", url: "https://example.com/1", posted: "2026-10-07" },
  { id: "t2", title: "Backend Engineer", company: "Northwind", location: "Remote", url: "https://example.com/2", posted: "2026-10-07" },
  { id: "t3", title: "Product Designer", company: "Kite", location: "Bengaluru", url: "https://example.com/3", posted: "2026-10-06" }
];

console.log("1. Save 3 jobs, new ones =", db.addMany(sample, "test", false), "(expected 3)");
console.log("2. Save same jobs again, new ones =", db.addMany(sample, "test", false), "(expected 0, no duplicates)");
db.recordScan("test", true, 3);
console.log("3. Search 'data' finds:", db.listJobs({ q: "data" }).jobs.map(j => j.title), "(expected Data Analyst)");
console.log("4. Total jobs =", db.listJobs().total, "(expected 3)");
console.log("5. Sources =", db.sources(), "| first scan of 'test'?", db.isFirstScan("test"), "(expected false)");
console.log("\nDatabase works.");

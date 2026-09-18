import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const readJson = async (path) => JSON.parse(await readFile(resolve(path), "utf8"));
const opportunities = await readJson("dist/data/opportunities.json");
const openReview = await readJson("dist/data/openreview.json");
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const isHttps = (value) => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};

assert(opportunities.schemaVersion === 2, "Opportunity cache must use schema version 2");
assert(Array.isArray(opportunities.records) && opportunities.records.length > 0, "Opportunity cache must contain records");
assert(Array.isArray(openReview.records) && openReview.records.length > 0, "OpenReview cache must contain records");

const ids = new Set();
for (const record of opportunities.records || []) {
  assert(!ids.has(record.id), `Duplicate opportunity id: ${record.id}`);
  ids.add(record.id);
  assert(record.source?.authoritative === true, `Opportunity lacks authoritative source flag: ${record.id}`);
  assert(isHttps(record.source?.url), `Opportunity source URL is not HTTPS: ${record.id}`);
  assert(isHttps(record.applicationUrl), `Opportunity application URL is not HTTPS: ${record.id}`);
  assert(["Funding", "Challenge", "Speaking"].includes(record.type), `Unapproved opportunity type: ${record.type}`);
}

const calculatedCounts = Object.fromEntries((opportunities.records || []).reduce((map, record) => map.set(record.source.name, (map.get(record.source.name) || 0) + 1), new Map()));
assert(JSON.stringify(calculatedCounts) === JSON.stringify(opportunities.counts), "Opportunity source counts do not match records");

for (const record of openReview.records || []) {
  assert(record.id?.startsWith("openreview:"), `Invalid OpenReview id: ${record.id}`);
  assert(isHttps(record.url) && new URL(record.url).hostname === "openreview.net", `Invalid OpenReview record URL: ${record.id}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Validated ${opportunities.records.length} opportunities and ${openReview.records.length} OpenReview records`);

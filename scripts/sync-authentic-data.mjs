import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = resolve(root, "dist/data/opportunities.json");
const queries = [
  "artificial intelligence research",
  "cybersecurity research",
  "financial technology",
  "distributed systems",
  "STEM education technology",
];

const clean = (value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString();
};

async function searchGrants(keyword) {
  const response = await fetch("https://api.grants.gov/v1/api/search2", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ keyword, rows: 20, oppStatuses: "forecasted|posted" }),
  });
  if (!response.ok) throw new Error(`Grants.gov returned ${response.status}`);
  const payload = await response.json();
  if (payload.errorcode !== 0) throw new Error(payload.msg || "Grants.gov search failed");
  return payload.data?.oppHits || [];
}

const batches = await Promise.all(queries.map(searchGrants));
const retrievedAt = new Date().toISOString();
const records = [...new Map(batches.flat().map((item) => [String(item.id), item])).values()]
  .map((item) => ({
    id: `grantsgov:${item.id}`,
    sourceRecordId: String(item.id),
    type: "Funding",
    icon: "$",
    title: clean(item.title) || "Untitled funding opportunity",
    org: clean(item.agencyName || item.agencyCode) || "U.S. Government agency",
    agencyCode: clean(item.agencyCode),
    opportunityNumber: clean(item.number),
    openDate: toIsoDate(item.openDate),
    deadline: item.closeDate || "See official record",
    status: clean(item.oppStatus) || "posted",
    why: "Official federal funding opportunity returned by the Grants.gov public API.",
    tags: ["Official source", "Federal funding", clean(item.agencyCode)].filter(Boolean),
    proof: "Funded research or community program",
    effort: "Review eligibility",
    source: {
      name: "Grants.gov",
      authority: "U.S. General Services Administration",
      api: "https://api.grants.gov/v1/api/search2",
      documentation: "https://grants.gov/api/api-guide",
      url: `https://www.grants.gov/search-results-detail/${item.id}`,
      retrievedAt,
      authoritative: true,
    },
  }))
  .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));

const output = {
  schemaVersion: 1,
  generatedAt: retrievedAt,
  source: {
    name: "Grants.gov",
    authority: "U.S. General Services Administration",
    endpoint: "https://api.grants.gov/v1/api/search2",
    documentation: "https://grants.gov/api/api-guide",
  },
  queries,
  records,
};

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${records.length} verified opportunities to ${outputFile}`);

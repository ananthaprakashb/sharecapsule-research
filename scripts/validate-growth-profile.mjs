import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const taxonomy = JSON.parse(await readFile("dist/data/growth-taxonomy.json", "utf8"));
const opportunities = JSON.parse(await readFile("dist/data/opportunities.json", "utf8"));
const canonicalize = (value) => Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, Array.isArray(entry) ? [...entry].sort() : entry]));
const hash = (vector) => createHash("sha256").update(JSON.stringify(canonicalize(vector))).digest("hex");
const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9+#.]+/g, " ");

const first = {
  version: taxonomy.hashVersion,
  role: "builder",
  careerStage: "senior",
  domains: ["software", "security", "ai"],
  goals: ["speak", "research"],
  opportunityTypes: ["Speaking", "Funding"],
  geographies: ["global", "remote"],
  commitment: "light",
  applicantContexts: ["individual", "team"]
};
const reordered = {
  ...first,
  domains: ["ai", "security", "software"],
  goals: ["research", "speak"],
  opportunityTypes: ["Funding", "Speaking"],
  geographies: ["remote", "global"],
  applicantContexts: ["team", "individual"]
};
if (hash(first) !== hash(reordered)) throw new Error("Equivalent category vectors must produce the same segment hash");

const selectedDomains = taxonomy.domains.filter((domain) => first.domains.includes(domain.id));
const matches = opportunities.records.filter((record) => {
  const text = normalize(`${record.title} ${record.org} ${record.why || ""} ${(record.tags || []).join(" ")}`);
  return selectedDomains.some((domain) => domain.terms.some((term) => text.includes(normalize(term).trim())));
});
if (!matches.length) throw new Error("Reference category vector must match at least one verified opportunity");

const resumeFixture = normalize("Senior software engineering and SRE leader working on cybersecurity, artificial intelligence, cloud platforms, and payment systems.");
const detected = taxonomy.domains.filter((domain) => domain.terms.some((term) => resumeFixture.includes(normalize(term).trim()))).map((domain) => domain.id);
for (const expected of ["ai", "security", "payments", "software", "reliability"]) {
  if (!detected.includes(expected)) throw new Error(`Resume suggestions did not detect ${expected}`);
}

const allowedKeys = new Set(["version", "role", "careerStage", "domains", "goals", "opportunityTypes", "geographies", "commitment", "applicantContexts"]);
if (Object.keys(first).some((key) => !allowedKeys.has(key))) throw new Error("Category vector contains a disallowed field");

console.log(`Validated deterministic ${taxonomy.hashVersion} hashing and ${matches.length} reference opportunity matches`);

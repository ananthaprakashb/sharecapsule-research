import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const opportunitiesFile = resolve(root, "dist/data/opportunities.json");
const openReviewFile = resolve(root, "dist/data/openreview.json");
const config = JSON.parse(await readFile(resolve(root, "config/approved-sources.json"), "utf8"));

const decodeHtml = (value) => String(value || "")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">");
const clean = (value) => decodeHtml(String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const valueOf = (field) => field && typeof field === "object" && "value" in field ? field.value : field;
const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString();
};

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "ImpactCommons/0.2 authentic-source-sync" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function searchGrants(keyword) {
  const payload = await fetchJson("https://api.grants.gov/v1/api/search2", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ keyword, rows: 20, oppStatuses: "forecasted|posted" })
  });
  if (payload.errorcode !== 0) throw new Error(payload.msg || "Grants.gov search failed");
  return payload.data?.oppHits || [];
}

async function syncGrants(retrievedAt) {
  const batches = await Promise.all(config.grantsGovQueries.map(searchGrants));
  return [...new Map(batches.flat().map((item) => [String(item.id), item])).values()].map((item) => ({
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
    applicationUrl: `https://www.grants.gov/search-results-detail/${item.id}`,
    source: {
      name: "Grants.gov",
      authority: "U.S. General Services Administration",
      api: "https://api.grants.gov/v1/api/search2",
      documentation: "https://grants.gov/api/api-guide",
      url: `https://www.grants.gov/search-results-detail/${item.id}`,
      retrievedAt,
      authoritative: true
    }
  }));
}

function extractTableValue(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return clean(html.match(new RegExp(`<tr>\\s*<th[^>]*>${escaped}<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, "i"))?.[1]);
}

async function syncUsaGovChallenges(retrievedAt) {
  const directoryUrl = "https://www.usa.gov/find-active-challenge";
  const directory = await fetchText(directoryUrl);
  const cardPattern = /<a href="(\/challenges\/[^"]+)" class="usa-card__container[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>[\s\S]*?<div class="usa-card__body[^>]*>\s*<p>([\s\S]*?)<\/p>/gi;
  const cards = [...directory.matchAll(cardPattern)].map((match) => ({
    path: match[1],
    title: clean(match[2]),
    summary: clean(match[3])
  }));
  if (!cards.length) throw new Error("USA.gov active challenge directory format was not recognized");
  const details = await Promise.allSettled(cards.map(async (card) => {
    const url = new URL(card.path, directoryUrl).href;
    const html = await fetchText(url);
    const agency = extractTableValue(html, "Sponsoring agency") || "U.S. Government agency";
    const deadline = extractTableValue(html, "End date") || "See official record";
    const challengeType = extractTableValue(html, "Challenge type");
    const prizes = extractTableValue(html, "Prizes");
    const applicationAnchor = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
      .find((match) => /^(?:Apply for|Participate in|Enter the)/i.test(clean(match[2])));
    const applicationUrl = decodeHtml(applicationAnchor?.[1]) || url;
    return {
      id: `usagov:${card.path.split("/").pop()}`,
      sourceRecordId: card.path,
      type: "Challenge",
      icon: "⚑",
      title: card.title,
      org: agency,
      deadline,
      status: "active",
      why: card.summary || "Active federal challenge listed by USA.gov.",
      tags: ["Official source", "Federal challenge", challengeType, prizes].filter(Boolean),
      proof: "Challenge submission or public-interest prototype",
      effort: "Review rules and eligibility",
      applicationUrl,
      source: {
        name: "USA.gov",
        authority: "U.S. General Services Administration",
        directory: directoryUrl,
        url,
        retrievedAt,
        authoritative: true
      }
    };
  }));
  return details.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
}

function extractLabeledHeading(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return clean(html.match(new RegExp(`${escaped}[\\s\\S]{0,220}?<\\/div>\\s*<h2[^>]*>([\\s\\S]*?)<\\/h2>`, "i"))?.[1]);
}

async function syncSessionizeCall(entry, retrievedAt) {
  const html = await fetchText(entry.url);
  if (!/badge badge-primary">\s*open,/i.test(html) || /Call for (?:Speakers|Sessions|Proposals) is closed/i.test(html)) return null;
  const title = clean(html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]).replace(/\s*:\s*Call for (?:Speakers|Sessions|Proposals).*$/i, "");
  const description = clean(html.match(/<meta property="og:description" content="([^"]+)"/i)?.[1]);
  const deadline = extractLabeledHeading(html, "Call closes at") || "See official call";
  const eventStart = extractLabeledHeading(html, "event starts");
  const location = extractLabeledHeading(html, "location");
  if (!title) throw new Error(`Sessionize title missing for ${entry.url}`);
  return {
    id: `sessionize:${new URL(entry.url).pathname.split("/").filter(Boolean).pop()}`,
    sourceRecordId: entry.url,
    type: "Speaking",
    icon: "◈",
    title,
    org: "Sessionize public CFP",
    openDate: null,
    deadline,
    status: "open",
    why: description || `Verified public call for speakers${eventStart ? ` for an event starting ${eventStart}` : ""}.`,
    tags: ["Verified CFP", ...entry.tags, location].filter(Boolean),
    proof: "Accepted conference proposal or public talk",
    effort: "Prepare and submit a proposal",
    applicationUrl: entry.url,
    source: {
      name: "Sessionize",
      authority: "Organizer-published public CFP",
      documentation: "https://sessionize.com/",
      url: entry.url,
      retrievedAt,
      authoritative: true
    }
  };
}

async function syncSessionize(retrievedAt) {
  const settled = await Promise.allSettled(config.sessionizeCalls.map((entry) => syncSessionizeCall(entry, retrievedAt)));
  return settled.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
}

async function searchOpenReview(query) {
  const params = new URLSearchParams({ query, content: "all", source: "forum", limit: "12" });
  const payload = await fetchJson(`https://api2.openreview.net/notes/search?${params}`);
  return payload.notes || [];
}

async function syncOpenReview(retrievedAt) {
  const settled = await Promise.allSettled(config.openReviewQueries.map(searchOpenReview));
  const notes = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const records = [...new Map(notes.map((note) => [note.id, note])).values()].map((note) => {
    const content = note.content || {};
    const htmlUrl = String(valueOf(content.html) || "");
    const doi = htmlUrl.match(/doi\.org\/(.+)$/i)?.[1] || null;
    const date = new Date(note.pdate || note.cdate || note.tcdate || 0);
    return {
      id: `openreview:${note.id}`,
      title: clean(valueOf(content.title)) || "Untitled OpenReview record",
      authors: (valueOf(content.authors) || []).slice(0, 8).map(clean).filter(Boolean),
      year: Number.isNaN(date.valueOf()) || !date.valueOf() ? null : date.getUTCFullYear(),
      venue: clean(valueOf(content.venue)),
      abstract: clean(valueOf(content.abstract)),
      keywords: (valueOf(content.keywords) || valueOf(content.subject_areas) || []).map?.(clean).filter(Boolean) || [],
      citations: 0,
      doi,
      url: `https://openreview.net/forum?id=${encodeURIComponent(note.id)}`,
      type: "reviewed work",
      source: {
        name: "OpenReview",
        authority: "OpenReview public scholarly review infrastructure",
        documentation: "https://docs.openreview.net/reference/api-v2",
        retrievedAt
      }
    };
  });
  if (!records.length) throw new Error("OpenReview returned no public records; preserving the prior cache is safer than overwriting it");
  return {
    schemaVersion: 1,
    generatedAt: retrievedAt,
    queries: config.openReviewQueries,
    source: {
      name: "OpenReview",
      endpoint: "https://api2.openreview.net/notes/search",
      documentation: "https://docs.openreview.net/reference/api-v2"
    },
    records
  };
}

const retrievedAt = new Date().toISOString();
const [grants, challenges, speaking, openReview] = await Promise.all([
  syncGrants(retrievedAt),
  syncUsaGovChallenges(retrievedAt),
  syncSessionize(retrievedAt),
  syncOpenReview(retrievedAt)
]);

const records = [...grants, ...challenges, ...speaking].sort((a, b) => {
  const aDate = new Date(String(a.deadline).replace(/\s+(?:ET|PT|CT|MT)\b/i, "").replace(/\s*\([^)]*\)\s*$/, "")).valueOf();
  const bDate = new Date(String(b.deadline).replace(/\s+(?:ET|PT|CT|MT)\b/i, "").replace(/\s*\([^)]*\)\s*$/, "")).valueOf();
  return (Number.isNaN(aDate) ? Number.MAX_SAFE_INTEGER : aDate) - (Number.isNaN(bDate) ? Number.MAX_SAFE_INTEGER : bDate);
});
const counts = Object.fromEntries(records.reduce((map, record) => map.set(record.source.name, (map.get(record.source.name) || 0) + 1), new Map()));
const opportunities = {
  schemaVersion: 2,
  generatedAt: retrievedAt,
  source: { name: "Approved authentic-source registry", authority: "Issuers and official public directories" },
  sources: [
    { name: "Grants.gov", endpoint: "https://api.grants.gov/v1/api/search2", documentation: "https://grants.gov/api/api-guide" },
    { name: "USA.gov", endpoint: "https://www.usa.gov/find-active-challenge", documentation: "https://www.usa.gov/challenges" },
    { name: "Sessionize", endpoint: "Allowlisted organizer CFP pages", documentation: "https://sessionize.com/" }
  ],
  counts,
  records
};

await mkdir(dirname(opportunitiesFile), { recursive: true });
await Promise.all([
  writeFile(opportunitiesFile, `${JSON.stringify(opportunities, null, 2)}\n`, "utf8"),
  writeFile(openReviewFile, `${JSON.stringify(openReview, null, 2)}\n`, "utf8")
]);
console.log(`Wrote ${records.length} verified opportunities (${JSON.stringify(counts)})`);
console.log(`Wrote ${openReview.records.length} public OpenReview records`);

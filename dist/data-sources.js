(function () {
  const SOURCE_REGISTRY = {
    grantsGov: {
      name: "Grants.gov",
      authority: "U.S. General Services Administration",
      documentation: "https://grants.gov/api/api-guide",
      method: "Scheduled official API ingestion",
    },
    crossref: {
      name: "Crossref",
      authority: "Crossref member-deposited scholarly metadata",
      documentation: "https://www.crossref.org/documentation/retrieve-metadata/rest-api/",
      method: "Live REST API",
    },
    openAlex: {
      name: "OpenAlex",
      authority: "OurResearch open scholarly index",
      documentation: "https://openalex.org/about",
      method: "Live REST API",
    },
    openReview: {
      name: "OpenReview",
      authority: "OpenReview public scholarly review infrastructure",
      documentation: "https://docs.openreview.net/reference/api-v2",
      method: "Daily official API ingestion",
    },
    usaGov: {
      name: "USA.gov",
      authority: "U.S. General Services Administration",
      documentation: "https://www.usa.gov/challenges",
      method: "Scheduled official directory ingestion",
    },
    sessionize: {
      name: "Sessionize",
      authority: "Organizer-published public CFP pages",
      documentation: "https://sessionize.com/",
      method: "Scheduled allowlisted page verification",
    },
  };

  const clean = (value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const yearFromParts = (parts) => parts?.[0]?.[0] || null;
  const unique = (items, key) => [...new Map(items.map((item) => [key(item), item])).values()];

  async function fetchJson(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadCachedOpportunities() {
    const payload = await fetchJson("./data/opportunities.json", { cache: "no-store" });
    if (!payload?.records || !Array.isArray(payload.records)) throw new Error("Invalid opportunity cache");
    return payload;
  }

  async function searchCachedOpenReview(query, rows = 8) {
    const payload = await fetchJson("./data/openreview.json", { cache: "no-store" });
    if (!payload?.records || !Array.isArray(payload.records)) throw new Error("Invalid OpenReview cache");
    const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !["and", "the", "for", "with", "from", "into", "that", "this"].includes(token));
    return payload.records
      .map((record) => {
        const title = clean(record.title).toLowerCase();
        const haystack = `${title} ${record.abstract || ""} ${record.venue || ""} ${(record.keywords || []).join(" ")}`.toLowerCase();
        const score = tokens.reduce((total, token) => total + (title.includes(token) ? 4 : haystack.includes(token) ? 1 : 0), 0);
        return { ...record, score, source: SOURCE_REGISTRY.openReview };
      })
      .filter((record) => record.score > 0)
      .sort((a, b) => b.score - a.score || (b.year || 0) - (a.year || 0))
      .slice(0, rows)
      .map(({ score, abstract, keywords, ...record }) => record);
  }

  async function searchCrossref(query, rows = 8) {
    const params = new URLSearchParams({
      query,
      rows: String(rows),
      select: "DOI,title,author,published,URL,publisher,type,is-referenced-by-count,container-title",
    });
    const payload = await fetchJson(`https://api.crossref.org/works?${params}`);
    return (payload?.message?.items || []).map((item) => ({
      id: `crossref:${item.DOI}`,
      title: clean(item.title?.[0]) || "Untitled work",
      authors: (item.author || []).slice(0, 4).map((author) => clean(`${author.given || ""} ${author.family || ""}`)).filter(Boolean),
      year: yearFromParts(item.published?.["date-parts"]),
      venue: clean(item["container-title"]?.[0] || item.publisher),
      citations: Number(item["is-referenced-by-count"] || 0),
      doi: item.DOI || null,
      url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : null),
      type: item.type || "work",
      source: SOURCE_REGISTRY.crossref,
    }));
  }

  async function searchOpenAlex(query, rows = 8) {
    const params = new URLSearchParams({ search: query, "per-page": String(rows) });
    const payload = await fetchJson(`https://api.openalex.org/works?${params}`);
    return (payload?.results || []).map((item) => ({
      id: `openalex:${item.id}`,
      title: clean(item.display_name) || "Untitled work",
      authors: (item.authorships || []).slice(0, 4).map((entry) => clean(entry.author?.display_name)).filter(Boolean),
      year: item.publication_year || null,
      venue: clean(item.primary_location?.source?.display_name),
      citations: Number(item.cited_by_count || 0),
      doi: item.doi ? item.doi.replace("https://doi.org/", "") : null,
      url: item.doi || item.primary_location?.landing_page_url || item.id,
      type: item.type || "work",
      source: SOURCE_REGISTRY.openAlex,
    }));
  }

  async function searchResearch(query) {
    const sources = [SOURCE_REGISTRY.crossref, SOURCE_REGISTRY.openAlex, SOURCE_REGISTRY.openReview];
    const settled = await Promise.allSettled([searchCrossref(query), searchOpenAlex(query), searchCachedOpenReview(query)]);
    const records = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const errors = settled.flatMap((result, index) => result.status === "rejected" ? [{
      source: sources[index].name,
      message: result.reason?.message || "Source unavailable",
    }] : []);
    const merged = unique(records, (record) => record.doi?.toLowerCase() || record.title.toLowerCase());
    merged.sort((a, b) => (b.citations || 0) - (a.citations || 0));
    return { records: merged, errors, retrievedAt: new Date().toISOString() };
  }

  window.AuthenticData = { SOURCE_REGISTRY, loadCachedOpportunities, searchResearch };
})();

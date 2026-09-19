(function () {
  const storageKey = "impactCommonsGrowthProfileV1";
  let taxonomy;

  const readStored = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "null"); }
    catch { return null; }
  };
  const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9+#.]+/g, " ");
  const selectedValues = (name) => [...document.querySelectorAll(`[name="${name}"]:checked`)].map((input) => input.value).sort();
  const optionMap = (items) => new Map(items.map((item) => [item.id, item]));
  const findLabels = (items, ids) => { const map = optionMap(items); return ids.map((id) => map.get(id)?.label).filter(Boolean); };
  const canonicalize = (value) => Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, Array.isArray(entry) ? [...entry].sort() : entry]));
  const nextBatchAt = () => {
    const next = new Date();
    next.setUTCHours(5, 17, 0, 0);
    if (next <= new Date()) next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString();
  };
  async function hashVector(vector) {
    const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(vector)));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  function renderChoices(containerId, items, name, multiple = true) {
    const target = document.querySelector(`#${containerId}`);
    target.innerHTML = items.map((item) => `<label class="choice-card"><input type="${multiple ? "checkbox" : "radio"}" name="${name}" value="${item.id}"><span><strong>${item.label}</strong></span></label>`).join("");
  }
  function detectResume(text) {
    const normalized = normalize(text);
    const domainScores = taxonomy.domains.map((domain) => ({
      ...domain,
      score: domain.terms.reduce((score, term) => score + (normalized.includes(normalize(term).trim()) ? 1 : 0), 0)
    })).filter((domain) => domain.score > 0).sort((a, b) => b.score - a.score || b.weight - a.weight);
    const roleScores = taxonomy.roles.map((role) => ({
      ...role,
      score: role.terms.reduce((score, term) => score + (normalized.includes(normalize(term).trim()) ? 1 : 0), 0)
    })).filter((role) => role.score > 0).sort((a, b) => b.score - a.score);
    return { domains: domainScores.slice(0, 6), role: roleScores[0] || null };
  }
  function applySuggestions(detection) {
    document.querySelectorAll('[name="growth-domains"]').forEach((input) => { input.checked = detection.domains.some((domain) => domain.id === input.value); });
    if (detection.role) {
      const input = document.querySelector(`[name="growth-role"][value="${detection.role.id}"]`);
      if (input) input.checked = true;
    }
    const labels = detection.domains.map((domain) => domain.label);
    document.querySelector("#resume-detection").innerHTML = labels.length
      ? `<strong>Suggested from the résumé</strong><div class="detected-tags">${labels.map((label) => `<span>${label}</span>`).join("")}</div><small>Confirm or change every option below. Suggestions are not final decisions.</small>`
      : `<strong>No clear category was detected</strong><small>Select the areas that best represent the person’s experience and direction.</small>`;
    document.querySelector("#domain-question").textContent = labels.length
      ? `The résumé suggests ${labels.slice(0, 3).join(", ")}. Which areas should drive recommendations?`
      : "Which experience areas should drive recommendations?";
    document.querySelector("#growth-questions").hidden = false;
  }
  async function resumeText() {
    const pasted = document.querySelector("#resume-text").value.trim();
    const file = document.querySelector("#resume-file").files[0];
    if (!file) return pasted;
    if (!/\.(txt|md|rtf)$/i.test(file.name)) throw new Error("This privacy-first preview reads TXT, Markdown, and RTF files. For PDF or DOCX, paste the résumé text below.");
    return `${await file.text()}\n${pasted}`.trim();
  }
  function renderProfile(profile) {
    const result = document.querySelector("#growth-profile-result");
    if (!profile) { result.hidden = true; return; }
    const domainLabels = findLabels(taxonomy.domains, profile.vector.domains);
    const goalLabels = findLabels(taxonomy.goals, profile.vector.goals);
    result.hidden = false;
    result.innerHTML = `<div><span class="eyebrow">Reusable growth segment</span><h3>${profile.shortHash}</h3><p>${domainLabels.join(" · ")}</p><div class="detected-tags">${goalLabels.map((label) => `<span>${label}</span>`).join("")}</div></div><div class="batch-status"><span>Next verified-source batch</span><strong>${new Date(profile.nextBatchAt).toLocaleString()}</strong><small>People with this same confirmed category vector receive the same segment hash and opportunity ranking.</small></div>`;
    document.querySelector("#growth-readiness").innerHTML = `100<small>%</small>`;
    document.querySelector("#growth-status-title").textContent = `Segment ${profile.shortHash}`;
    document.querySelector("#growth-status-copy").textContent = "Ready for shared opportunity batches";
  }
  function getSignals(profile = readStored()) {
    if (!profile) return [];
    const map = optionMap(taxonomy.domains);
    return profile.vector.domains.map((id) => map.get(id)).filter(Boolean);
  }
  function scoreOpportunity(record, profile = readStored()) {
    if (!profile) return { score: 0, reasons: [] };
    const text = normalize(`${record.title} ${record.org} ${record.why || ""} ${(record.tags || []).join(" ")}`);
    const matchedDomains = getSignals(profile).filter((domain) => domain.terms.some((term) => text.includes(normalize(term).trim())));
    if (!matchedDomains.length) return { score: 0, reasons: [] };
    const desiredType = profile.vector.opportunityTypes.includes(record.type);
    const score = Math.min(98, 48 + matchedDomains.reduce((total, domain) => total + domain.weight, 0) + (desiredType ? 14 : 0) + (record.source?.authoritative ? 4 : 0));
    const reasons = matchedDomains.map((domain) => domain.label);
    if (desiredType) reasons.push(`${record.type} selected`);
    return { score, reasons };
  }
  async function initialize() {
    taxonomy = await fetch("./data/growth-taxonomy.json", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("Growth taxonomy unavailable");
      return response.json();
    });
    renderChoices("growth-role-options", taxonomy.roles, "growth-role", false);
    renderChoices("growth-domain-options", taxonomy.domains, "growth-domains");
    renderChoices("growth-stage-options", taxonomy.careerStages, "growth-stage", false);
    renderChoices("growth-goal-options", taxonomy.goals, "growth-goals");
    renderChoices("growth-type-options", taxonomy.opportunityTypes, "growth-types");
    renderChoices("growth-geography-options", taxonomy.geographies, "growth-geographies");
    renderChoices("growth-commitment-options", taxonomy.commitments, "growth-commitment", false);
    renderChoices("growth-context-options", taxonomy.applicantContexts, "growth-contexts");
    const stored = readStored();
    if (stored) {
      Object.entries({"growth-role":[stored.vector.role],"growth-domains":stored.vector.domains,"growth-stage":[stored.vector.careerStage],"growth-goals":stored.vector.goals,"growth-types":stored.vector.opportunityTypes,"growth-geographies":stored.vector.geographies,"growth-commitment":[stored.vector.commitment],"growth-contexts":stored.vector.applicantContexts}).forEach(([name, values]) => values.filter(Boolean).forEach((value) => { const input = document.querySelector(`[name="${name}"][value="${value}"]`); if (input) input.checked = true; }));
      document.querySelector("#growth-questions").hidden = false;
    }
    renderProfile(stored);
    document.querySelector("#analyze-resume").addEventListener("click", async () => {
      const status = document.querySelector("#resume-status");
      try {
        const text = await resumeText();
        if (text.length < 80) throw new Error("Add more résumé text so the system can suggest meaningful options.");
        applySuggestions(detectResume(text));
        status.textContent = "Résumé analyzed in this browser. Confirm the suggested options below.";
        status.className = "resume-status success";
      } catch (error) {
        status.textContent = error.message;
        status.className = "resume-status error";
      }
    });
    document.querySelector("#growth-profile-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const vector = canonicalize({
        role: selectedValues("growth-role")[0] || "exploring",
        careerStage: selectedValues("growth-stage")[0] || "exploring",
        domains: selectedValues("growth-domains"),
        goals: selectedValues("growth-goals"),
        opportunityTypes: selectedValues("growth-types"),
        geographies: selectedValues("growth-geographies"),
        commitment: selectedValues("growth-commitment")[0] || "light",
        applicantContexts: selectedValues("growth-contexts")
      });
      if (!vector.domains.length || !vector.goals.length || !vector.opportunityTypes.length) {
        document.querySelector("#profile-form-status").textContent = "Choose at least one experience area, growth goal, and opportunity type.";
        return;
      }
      const fullHash = await hashVector({ version: taxonomy.hashVersion, ...vector });
      const profile = { version: taxonomy.hashVersion, segmentHash: fullHash, shortHash: `${taxonomy.hashVersion}_${fullHash.slice(0, 16)}`, vector, createdAt: new Date().toISOString(), nextBatchAt: nextBatchAt() };
      localStorage.setItem(storageKey, JSON.stringify(profile));
      document.querySelector("#resume-text").value = "";
      document.querySelector("#resume-file").value = "";
      document.querySelector("#profile-form-status").textContent = "Growth segment created. Raw résumé content was not saved.";
      renderProfile(profile);
      window.dispatchEvent(new CustomEvent("growth-profile-updated", { detail: profile }));
    });
  }

  const ready = initialize().catch((error) => {
    const status = document.querySelector("#resume-status");
    if (status) { status.textContent = error.message; status.className = "resume-status error"; }
    throw error;
  });
  window.GrowthProfile = { ready, getProfile: readStored, getSignals, scoreOpportunity };
})();

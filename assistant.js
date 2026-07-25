/* =========================================================
   PRIVATE — Sameer Singh's AI Portfolio Assistant
   Self-contained: no build step, no dependencies.
   Drop this file next to your other .html files and add:
       <script src="assistant.js" defer></script>
   right before </body> on every page.
   ========================================================= */
 
(function () {
  "use strict";
 
  const DATA_URL = "assistant-data.json";
  const GITHUB_USER = "SameerSingh017";
  const GITHUB_CACHE_KEY = "priv_github_cache_v1";
  const GITHUB_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
 
  // Same public Firebase config already used in script.js — safe to reuse,
  // it's a client-side key scoped to this project with public-read rules.
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBWDwISSrpAEXbWPG_-QmzgnVvTchun7iI",
    authDomain: "knowaboutsam-40396.firebaseapp.com",
    projectId: "knowaboutsam-40396",
    storageBucket: "knowaboutsam-40396.firebasestorage.app",
    messagingSenderId: "324249076457",
    appId: "1:324249076457:web:8d1f9ac232f086a1cc6678"
  };
 
  // Cloudflare Worker that answers questions the rule-based matcher can't —
  // see FREE_LLM_UPGRADE.md and private-llm-worker/ for how this is deployed.
  const LLM_ENDPOINT = "https://private-llm-worker.askprivate.workers.dev";
 
  function markdownToHtml(text) {
    // The LLM sometimes returns **bold**/*italic* markdown — convert the
    // common cases to real tags. Input is already HTML-escaped by the caller,
    // so this only ever touches literal asterisks, never injects raw HTML.
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  }
 
  async function askLLM(question) {
    try {
      const res = await fetch(LLM_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, context: KB })
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.answer) return null;
      return `<p>${markdownToHtml(escapeHtml(data.answer))}</p>`;
    } catch (e) {
      console.error("Private: LLM call failed", e);
      return null; // fails silently — caller falls back to the rule-based message
    }
  }
 
  let KB = null; // knowledge base, loaded from assistant-data.json
  let firestoreDb = null; // lazily initialized, only if posts/thoughts are asked about
 
  // Topics that are NOT covered by the knowledge base at all — asking about
  // these should never be guessed at from the bio text, just declined clearly.
  const OFF_TOPIC_PATTERN =
    /\b(girlfriend|boyfriend|wife|husband|dating|relationship status|married|siblings?|brother|sister|religion|caste|political|salary|income|net worth|weight|height|book(s)? (is|are) (he|sameer) reading|currently reading)\b/;
 
  /* ---------------- utilities ---------------- */
 
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }
 
  function el(tag, className, html) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
 
  async function loadKB() {
    if (KB) return KB;
    const res = await fetch(DATA_URL, { cache: "no-store" });
    KB = await res.json();
    return KB;
  }
 
  async function fetchGithubRepos() {
    try {
      const cached = sessionStorage.getItem(GITHUB_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < GITHUB_CACHE_TTL) return parsed.repos;
      }
    } catch (e) { /* ignore cache errors */ }
 
    try {
      const res = await fetch(
        `https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=100`
      );
      if (!res.ok) return [];
      const repos = await res.json();
      const slim = repos
        .filter(r => !r.fork)
        .map(r => ({
          name: r.name,
          description: r.description,
          language: r.language,
          url: r.html_url,
          updated: r.updated_at
        }));
      sessionStorage.setItem(GITHUB_CACHE_KEY, JSON.stringify({ ts: Date.now(), repos: slim }));
      return slim;
    } catch (e) {
      return []; // offline / rate-limited — fail silently, curated data still works
    }
  }
 
  async function getFirestoreDb() {
    if (firestoreDb) return firestoreDb;
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    const app = initializeApp(FIREBASE_CONFIG, "private-assistant");
    firestoreDb = getFirestore(app);
    return firestoreDb;
  }
 
  async function fetchFirestoreEntries(collectionName, limitCount) {
    try {
      const db = await getFirestoreDb();
      const { collection, query, orderBy, limit, getDocs } = await import(
        "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js"
      );
      const q = query(collection(db, collectionName), orderBy("createdAt", "desc"), limit(limitCount));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error(`Private: failed to fetch ${collectionName}`, e);
      return null; // null = fetch failed, distinct from [] = genuinely empty
    }
  }
 
  /* ---------------- language keyword map ---------------- */
 
  const LANGUAGE_ALIASES = {
    java: "Java",
    python: "Python",
    javascript: "JavaScript",
    js: "JavaScript",
    react: "React",
    node: "Node.js",
    "node.js": "Node.js",
    html: "HTML",
    css: "CSS",
    sql: "MySQL",
    mysql: "MySQL",
    aws: "AWS",
    tailwind: "Tailwind CSS"
  };
 
  function extractLanguage(msg) {
    for (const key of Object.keys(LANGUAGE_ALIASES)) {
      const re = new RegExp(`\\b${key.replace(".", "\\.")}\\b`, "i");
      if (re.test(msg)) return LANGUAGE_ALIASES[key];
    }
    return null;
  }
 
  /* ---------------- answer builders ---------------- */
 
  function buildAboutAnswer() {
    const { name, status, location, bio } = KB;
    return `
      <p><strong>${escapeHtml(name)}</strong> — ${escapeHtml(status)}, based in ${escapeHtml(location)}.</p>
      <p>${bio.map(escapeHtml).join(" ")}</p>
      <p class="priv-hint">Ask me about his <strong>AWS internship</strong>, <strong>skills</strong>, <strong>projects</strong>, or <strong>DSA progress</strong>.</p>
    `;
  }
 
 function buildInternshipAnswer(concise) {
  const i = KB.internship;
  if (concise) {
    const shortPoints = i.highlights.map(h => h.split(" — ")[0]);
    return `
      <p><strong>${escapeHtml(i.title)}</strong> (${escapeHtml(i.duration)}) — key takeaways:</p>
      <ul class="priv-list">
        ${shortPoints.map(p => `<li><strong>${escapeHtml(p)}</strong></li>`).join("")}
      </ul>
      <p class="priv-tags">${i.tools.map(t => `<span class="priv-tag">${escapeHtml(t)}</span>`).join("")}</p>
      <p class="priv-hint">Ask for "internship details" for the full breakdown.</p>
    `;
  }
  return `
    <p>
      <strong>${escapeHtml(i.title)}</strong><br>
      <span class="priv-muted">${escapeHtml(i.organization)} · ${escapeHtml(i.duration)}</span>
    </p>
    <p>${escapeHtml(i.summary)}</p>
    <ul class="priv-list">
      ${i.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join("")}
    </ul>
    <p class="priv-tags">${i.tools.map(t => `<span class="priv-tag">${escapeHtml(t)}</span>`).join("")}</p>
  `;
}
 
  function extractSkillCategory(msg) {
    if (/\bfront[\s-]?end\b/.test(msg)) return "frontend";
    if (/\bback[\s-]?end\b/.test(msg)) return "backend";
    if (/\bmachine learning\b|\bml\b|\bai\b/.test(msg)) return "machine_learning";
    if (/\bdatabase(s)?\b/.test(msg)) return "database";
    if (/\bcloud\b/.test(msg)) return "clodep";
    if (/\bdeployment\b/.test(msg)) return "clodep";
    if (/\bsoft skills?\b/.test(msg)) return "soft";
    if (/\btools?\b/.test(msg)) return "tools";
    return null;
  }
 
  function tagsHtml(arr) {
    return `<p class="priv-tags">${arr.map(t => `<span class="priv-tag">${escapeHtml(t)}</span>`).join("")}</p>`;
  }
 
  function buildSkillsAnswer(language, category) {
    const s = KB.skills;
 
    if (category === "frontend") return `<p>Sameer's frontend skills:</p>${tagsHtml(s.frontend)}`;
    if (category === "backend") return `<p>Sameer's backend skills:</p>${tagsHtml(s.backend)}`;
    if (category === "machine_learning") return `<p>Sameer's machine learning skills:</p>${tagsHtml(s.machine_learning)}`;
    if (category === "database") return `<p>Sameer's database skills:</p>${tagsHtml(s.databases)}`;
    if (category === "clodep") return `<p>Sameer's cloud and deployment skills:</p>${tagsHtml(s.clodep)}`;
    if (category === "soft") return `<p>Sameer's soft skills:</p>${tagsHtml(s.soft_skills)}`;
    if (category === "tools") return `<p>Sameer's tools:</p>${tagsHtml(s.tools)}`;
 
    if (language) {
      const found = Object.entries(s).some(([, arr]) =>
        arr.some(item => item.toLowerCase().includes(language.toLowerCase()))
      );
      if (found) {
        return `<p>Yes — <strong>${escapeHtml(language)}</strong> is one of Sameer's skills. Here's his full skill set:</p>` + skillGroupsHtml(s);
      }
    }
    return `<p>Here's Sameer's skill set:</p>` + skillGroupsHtml(s);
  }
 
  function skillGroupsHtml(s) {
    const groups = [
      ["Languages", s.languages],
      ["Machine Learning", s.machine_learning],
      ["Frontend", s.frontend],
      ["Backend", s.backend],
      ["Databases", s.databases],
      ["Cloud & Deployment", s.clodep],
      ["Tools", s.tools],
      ["Soft Skills", s.soft_skills]
    ];
    return groups
      .map(
        ([label, arr]) => `
        <div class="priv-skill-group">
          <span class="priv-skill-label">${escapeHtml(label)}</span>
          <span class="priv-tags">${arr.map(t => `<span class="priv-tag">${escapeHtml(t)}</span>`).join("")}</span>
        </div>`
      )
      .join("");
  }
 
  async function buildProjectsAnswer(language) {
    let projects = KB.projects;
    let noteExtra = "";
 
    if (language) {
      const filtered = projects.filter(p =>
        p.tags.some(t => t.toLowerCase().includes(language.toLowerCase()))
      );
      if (filtered.length) {
        projects = filtered;
      } else {
        noteExtra = `<p class="priv-hint">No curated ${escapeHtml(language)} projects listed, showing everything instead.</p>`;
      }
    }
 
    let cardsHtml = projects.map(projectCardHtml).join("");
 
    // Supplement with a live GitHub check for repos not featured on the portfolio
    const repos = await fetchGithubRepos();
    if (repos.length && language) {
      const curatedNames = new Set(KB.projects.map(p => p.name.toLowerCase()));
      const extra = repos.filter(
        r =>
          r.language &&
          r.language.toLowerCase() === language.toLowerCase() &&
          !curatedNames.has(r.name.toLowerCase())
      );
      if (extra.length) {
        cardsHtml += `<p class="priv-hint" style="margin-top:10px;">Also found on GitHub:</p>`;
        cardsHtml += extra
          .slice(0, 5)
          .map(
            r => `
          <a class="priv-repo-link" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">
            ${escapeHtml(r.name)} <span class="priv-muted">(${escapeHtml(r.language)})</span>
          </a>`
          )
          .join("");
      }
    }
 
    return `
      <p>${language ? `${escapeHtml(language)} projects:` : "Here's what Sameer's built:"}</p>
      ${cardsHtml}
      ${noteExtra}
      <p class="priv-hint">Full source on <a href="${escapeHtml(KB.contact.github)}" target="_blank" rel="noopener">GitHub</a>.</p>
    `;
  }
 
  function projectCardHtml(p) {
    return `
      <div class="priv-project-card">
        <div class="priv-project-title">${escapeHtml(p.name)}${p.featured ? ' <span class="priv-badge">Featured</span>' : ""}</div>
        <p class="priv-project-desc">${escapeHtml(p.description)}</p>
        <p class="priv-tags">${p.tags.map(t => `<span class="priv-tag">${escapeHtml(t)}</span>`).join("")}</p>
        <a href="${escapeHtml(p.github)}" target="_blank" rel="noopener" class="priv-repo-link">View source →</a>
      </div>
    `;
  }
 
  function buildDsaAnswer() {
    const d = KB.dsa_progress;
    const topicsHtml = Object.entries(d.topics)
      .map(
        ([topic, count]) => `
        <div class="priv-dsa-row">
          <span>${escapeHtml(topic)}</span>
          <span class="priv-dsa-count">${count}</span>
        </div>`
      )
      .join("");
 
    return `
      <p><strong>${d.total_solved}</strong> problems solved on <strong>${escapeHtml(d.platform)}</strong> as of ${escapeHtml(d.last_updated)}.</p>
      <div class="priv-dsa-grid">${topicsHtml}</div>
      ${d.profile_url ? `<p class="priv-hint"><a href="${escapeHtml(d.profile_url)}" target="_blank" rel="noopener">View live profile →</a></p>` : ""}
      <p class="priv-hint">Progress updated manually by Sameer.</p>
    `;
  }
 
  function buildContactAnswer() {
    const c = KB.contact;
    return `
      <p>Best ways to reach Sameer:</p>
      <div class="priv-contact-row"><a href="mailto:${escapeHtml(c.email)}">📧 ${escapeHtml(c.email)}</a></div>
      <div class="priv-contact-row"><a href="${escapeHtml(c.linkedin)}" target="_blank" rel="noopener">💼 LinkedIn</a></div>
      <div class="priv-contact-row"><a href="${escapeHtml(c.telegram)}" target="_blank" rel="noopener">✈️ Telegram</a></div>
      <div class="priv-contact-row"><a href="${escapeHtml(c.resume)}" download>⬇ Download Resume</a></div>
    `;
  }
 
  async function buildPostsAnswer() {
    const live = await fetchFirestoreEntries("posts", 8);
    const seed = KB.seed_posts || [];
    // Seeds render first on the actual page (script.js appends live ones after them),
    // so match that order here.
    const entries = live === null ? seed : [...seed, ...live];
    if (entries.length === 0) {
      return `<p>No posts yet — check the <a href="posts.html">Posts page</a> again soon.</p>`;
    }
    const itemsHtml = entries
      .map(
        p => `
        <div class="priv-project-card">
          <p class="priv-tags" style="margin-bottom:6px;"><span class="priv-tag">${escapeHtml(p.tag || "Note")}</span> <span class="priv-muted">${escapeHtml(p.date || "")}</span></p>
          <p class="priv-project-desc" style="margin-bottom:0;">${escapeHtml(p.body || "")}</p>
        </div>`
      )
      .join("");
    return `<p>Sameer's latest posts:</p>${itemsHtml}<p class="priv-hint">See all on the <a href="posts.html">Posts page</a>.</p>`;
  }
 
  async function buildThoughtsAnswer() {
    const live = await fetchFirestoreEntries("thoughts", 5);
    const seed = KB.seed_thoughts || [];
    const entries = live === null ? seed : [...seed, ...live];
    if (entries.length === 0) {
      return `<p>No thoughts published yet — check the <a href="thoughts.html">Thoughts page</a> again soon.</p>`;
    }
    const itemsHtml = entries
      .map(
        t => `
        <div class="priv-project-card">
          <div class="priv-project-title">${escapeHtml(t.title || "Untitled")}</div>
          ${t.subtitle ? `<p class="priv-project-desc" style="font-style:italic;">${escapeHtml(t.subtitle)}</p>` : ""}
          <p class="priv-tags"><span class="priv-tag">${escapeHtml(t.tag || "Personal")}</span> <span class="priv-muted">${escapeHtml(t.date || "")}</span></p>
        </div>`
      )
      .join("");
    return `<p>Sameer's latest thoughts:</p>${itemsHtml}<p class="priv-hint">Read them in full on the <a href="thoughts.html">Thoughts page</a>.</p>`;
  }
 
  function buildBirthAnswer() {
    return `<p>Sameer was born on <strong>${escapeHtml(KB.born)}</strong>, making him <strong>${escapeHtml(String(KB.age).split(" (")[0])}</strong> years old.</p>`;
  }
 
  function buildEducationAnswer() {
    const current = KB.education[0]; // most recent / current entry
    return `
      <p><strong>${escapeHtml(KB.status)}</strong></p>
      <p>${escapeHtml(current.institution)} · ${escapeHtml(current.duration)} · ${escapeHtml(current.score)}</p>
      <p class="priv-hint">Full academic history is on the <a href="about.html">About page</a>.</p>
    `;
  }
 
  function buildLocationAnswer() {
    return `<p>Sameer is based in <strong>${escapeHtml(KB.location)}</strong>.</p><p class="priv-hint">Ask about his <strong>background</strong>, <strong>skills</strong>, or <strong>projects</strong> for more.</p>`;
  }
 
  function buildOffTopicAnswer() {
    return `
      <p>That's outside what I know — I only have Sameer's professional/portfolio info, not personal details like that.</p>
      <p class="priv-hint">Try asking about his <strong>background</strong>, <strong>AWS internship</strong>, <strong>skills</strong>, <strong>projects</strong>, <strong>DSA progress</strong>, <strong>posts</strong>, <strong>thoughts</strong>, or how to <strong>contact</strong> him.</p>
    `;
  }
 
  function buildGreetingAnswer() {
    return `
      <p>Hey! I'm <strong>Private</strong> — Sameer's portfolio assistant. Ask me things like:</p>
      <div class="priv-suggestions">
        ${suggestionChipsHtml()}
      </div>
    `;
  }
 
  function buildFallbackAnswer() {
    return `
      <p>I'm not sure about that one. I can tell you about Sameer's <strong>background</strong>, <strong>AWS internship</strong>, <strong>skills</strong>, <strong>projects</strong> (try "show Java projects"), <strong>DSA progress</strong>, his <strong>posts</strong> or <strong>thoughts</strong>, or how to <strong>contact</strong> him.</p>
    `;
  }
 
  function suggestionChipsHtml() {
    const chips = [
      "Tell me about Sameer",
      "Tell me about his AWS internship",
      "What are his skills?",
      "Show Java projects",
      "Show DSA progress",
      "How do I contact him?"
    ];
    return chips.map(c => `<button class="priv-chip" data-q="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");
  }
 
  /* ---------------- intent routing ---------------- */
 
  async function answer(rawMsg) {
    const msg = rawMsg.toLowerCase().trim();
    await loadKB();
 
    // Off-topic guard runs FIRST — personal-life questions and other things
    // genuinely absent from the data should never fall through to a loosely
    // matched "about" answer that sounds confident but isn't relevant.
    if (OFF_TOPIC_PATTERN.test(msg)) {
      return buildOffTopicAnswer();
    }
 
    if (/\b(dsa|leetcode|gfg|geeksforgeeks|data structures?|problems? solved|competitive programming)\b/.test(msg)) {
      return buildDsaAnswer();
    }
    if (/\b(intern(ship)?|aws academy|eduskills|data engineering)\b/.test(msg)) {
      const concise = /\b(key insight|insights|summary|briefly|short|takeaways?|highlights?)\b/.test(msg);
      return buildInternshipAnswer(concise);
    }
    if (/\b(born|birthday|birth date|dob|how old|age)\b/.test(msg)) {
      return buildBirthAnswer();
    }
    if (/\b(semester|college|university|cgpa|degree|course|studying|academic year|which year|what year|current year)\b/.test(msg)) {
      return buildEducationAnswer();
    }
    if (/\b(resume|cv)\b/.test(msg)) {
      return buildContactAnswer();
    }
    if (/\b(contact|email|reach|hire|linkedin|telegram)\b/.test(msg)) {
      return buildContactAnswer();
    }
    if (/\bposts?\b/.test(msg) && !/\bblog post\b/.test(msg)) {
      return await buildPostsAnswer();
    }
    if (/\bthoughts?\b|\bessays?\b/.test(msg)) {
      return await buildThoughtsAnswer();
    }
    if (/\b(project|projects|repo|repos|repository|github|built|collaboration|team)\b/.test(msg)) {
      return await buildProjectsAnswer(extractLanguage(msg));
    }
    if (
      /\b(skill|skills|tech stack|technologies|technology|stack|proficient|programming language|coding language|language(s)?|framework(s)?)\b/.test(
        msg
      )
    ) {
      return buildSkillsAnswer(extractLanguage(msg), extractSkillCategory(msg));
    }
    if (/\bwhere.*(live|lives|based|from)\b|\blocation\b|\bhometown\b|\bbased in\b/.test(msg)) {
      return buildLocationAnswer();
    }
    if (
      /\b(about|who is sameer(?!'s)|who are you|bio|background|tell me about sameer|what does (he|sameer) do|profession|occupation|current role|what is his job)\b/.test(
        msg
      )
    ) {
      return buildAboutAnswer();
    }
    if (/\b(hi|hello|hey|yo|sup|greetings)\b/.test(msg)) {
      return buildGreetingAnswer();
    }
    const llmAnswer = await askLLM(rawMsg);
    return llmAnswer || buildFallbackAnswer();
  }
 
  /* ---------------- UI ---------------- */
 
  const CSS = `
    .priv-toggle-btn {
      position: fixed; left: 28px; bottom: 28px; z-index: 999;
      display: flex; align-items: center; gap: 8px;
      background: #2d2621; color: #f2ede4; border: none;
      padding: 12px 18px; border-radius: 30px; cursor: pointer;
      font-family: 'Syne', 'Helvetica Neue', sans-serif; font-weight: 600; font-size: 0.82rem;
      letter-spacing: 0.5px; box-shadow: 0 8px 28px rgba(0,0,0,0.18);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .priv-toggle-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.22); }
    .priv-toggle-btn .priv-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #7bd88f;
      box-shadow: 0 0 0 0 rgba(123,216,143,0.6); animation: priv-pulse 2s infinite;
    }
    @keyframes priv-pulse {
      0% { box-shadow: 0 0 0 0 rgba(123,216,143,0.5); }
      70% { box-shadow: 0 0 0 8px rgba(123,216,143,0); }
      100% { box-shadow: 0 0 0 0 rgba(123,216,143,0); }
    }
    .priv-panel {
      position: fixed; left: 28px; bottom: 90px; z-index: 999;
      width: 380px; max-width: calc(100vw - 40px); max-height: 70vh;
      background: #f2ede4; border-radius: 18px; box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      display: none; flex-direction: column; overflow: hidden;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      border: 1px solid rgba(45,38,33,0.08);
    }
    .priv-panel.priv-open { display: flex; }
    .priv-header {
      background: #2d2621; color: #f2ede4; padding: 16px 18px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .priv-header-title { font-family: 'DM Serif Display', serif; font-size: 1.15rem; }
    .priv-header-sub { font-size: 0.7rem; opacity: 0.65; letter-spacing: 0.5px; margin-top: 2px; }
    .priv-close-btn {
      background: none; border: none; color: #f2ede4; font-size: 1.2rem; cursor: pointer;
      opacity: 0.7; line-height: 1;
    }
    .priv-close-btn:hover { opacity: 1; }
    .priv-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
    }
    .priv-msg { max-width: 92%; font-size: 0.86rem; line-height: 1.55; }
    .priv-msg p { margin: 0 0 8px; }
    .priv-msg p:last-child { margin-bottom: 0; }
    .priv-msg.priv-user {
      align-self: flex-end; background: #2d2621; color: #f2ede4;
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
    }
    .priv-msg.priv-bot {
      align-self: flex-start; background: #fff; color: #2d2621;
      padding: 12px 14px; border-radius: 14px 14px 14px 2px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.06);
    }
    .priv-msg.priv-loading { align-self: flex-start; color: #a89a8c; font-style: italic; font-size: 0.8rem; }
    .priv-hint { color: #a89a8c; font-size: 0.76rem; }
    .priv-muted { color: #a89a8c; }
    .priv-list { margin: 6px 0 8px 18px; padding: 0; }
    .priv-list li { margin-bottom: 6px; }
    .priv-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .priv-tag {
      background: #efe6d8; color: #6b5d4f; font-size: 0.68rem; font-weight: 600;
      padding: 3px 9px; border-radius: 20px; letter-spacing: 0.3px;
    }
    .priv-skill-group { margin-bottom: 10px; }
    .priv-skill-label { display: block; font-size: 0.72rem; font-weight: 700; color: #c5a891; letter-spacing: 0.5px; margin-bottom: 4px; text-transform: uppercase; }
    .priv-project-card {
      background: #fbf8f2; border: 1px solid rgba(45,38,33,0.08); border-radius: 10px;
      padding: 10px 12px; margin-bottom: 8px;
    }
    .priv-project-title { font-weight: 700; font-size: 0.88rem; margin-bottom: 4px; }
    .priv-project-desc { font-size: 0.8rem; color: #57493d; margin-bottom: 6px; }
    .priv-badge {
      background: #c5a891; color: #fff; font-size: 0.6rem; padding: 2px 7px; border-radius: 10px;
      vertical-align: middle; letter-spacing: 0.4px;
    }
    .priv-repo-link { display: inline-block; margin-top: 6px; font-size: 0.78rem; font-weight: 600; color: #2d2621; text-decoration: underline; }
    .priv-dsa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin: 8px 0; }
    .priv-dsa-row { display: flex; justify-content: space-between; font-size: 0.8rem; border-bottom: 1px dashed rgba(45,38,33,0.12); padding-bottom: 4px; }
    .priv-dsa-count { font-weight: 700; color: #c5a891; }
    .priv-contact-row { margin-bottom: 6px; }
    .priv-contact-row a { color: #2d2621; text-decoration: none; font-weight: 600; font-size: 0.85rem; }
    .priv-contact-row a:hover { color: #c5a891; }
    .priv-suggestions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .priv-chip {
      background: #efe6d8; border: none; color: #2d2621; font-size: 0.72rem; font-weight: 600;
      padding: 6px 11px; border-radius: 20px; cursor: pointer; transition: background 0.15s;
    }
    .priv-chip:hover { background: #c5a891; color: #fff; }
    .priv-input-row {
      display: flex; gap: 8px; padding: 12px 14px; border-top: 1px solid rgba(45,38,33,0.08); background: #fff;
    }
    .priv-input-row input {
      flex: 1; border: 1px solid rgba(45,38,33,0.15); border-radius: 22px; padding: 9px 14px;
      font-size: 0.85rem; outline: none; font-family: inherit;
    }
    .priv-input-row input:focus { border-color: #c5a891; }
    .priv-send-btn {
      background: #2d2621; color: #f2ede4; border: none; width: 38px; height: 38px; border-radius: 50%;
      cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: background 0.15s;
    }
    .priv-send-btn:hover { background: #c5a891; }
    @media (max-width: 480px) {
      .priv-panel { left: 12px; right: 12px; width: auto; bottom: 84px; }
      .priv-toggle-btn { left: 12px; bottom: 16px; }
    }
  `;
 
  function buildUI() {
    const style = el("style");
    style.textContent = CSS;
    document.head.appendChild(style);
 
    const toggleBtn = el(
      "button",
      "priv-toggle-btn",
      `<span class="priv-dot"></span> Ask Private`
    );
    toggleBtn.setAttribute("aria-label", "Open Private, the AI portfolio assistant");
 
    const panel = el("div", "priv-panel");
    panel.innerHTML = `
      <div class="priv-header">
        <div>
          <div class="priv-header-title">Private</div>
        </div>
        <button class="priv-close-btn" aria-label="Close">✕</button>
      </div>
      <div class="priv-messages" id="privMessages"></div>
      <div class="priv-input-row">
        <input type="text" id="privInput" placeholder="Ask about Sameer..." autocomplete="off" />
        <button class="priv-send-btn" id="privSend" aria-label="Send">➤</button>
      </div>
    `;
 
    document.body.appendChild(toggleBtn);
    document.body.appendChild(panel);
 
    const messagesEl = panel.querySelector("#privMessages");
    const inputEl = panel.querySelector("#privInput");
    const sendBtn = panel.querySelector("#privSend");
    const closeBtn = panel.querySelector(".priv-close-btn");
 
    let greeted = false;
 
    function openPanel() {
      panel.classList.add("priv-open");
      if (!greeted) {
        greeted = true;
        appendBotMessage(buildGreetingAnswer());
      }
      inputEl.focus();
    }
 
    function closePanel() {
      panel.classList.remove("priv-open");
    }
 
    toggleBtn.addEventListener("click", () => {
      panel.classList.contains("priv-open") ? closePanel() : openPanel();
    });
    closeBtn.addEventListener("click", closePanel);
 
    function appendUserMessage(text) {
      const bubble = el("div", "priv-msg priv-user", escapeHtml(text));
      messagesEl.appendChild(bubble);
      scrollToBottom();
    }
 
    function appendBotMessage(html) {
      const bubble = el("div", "priv-msg priv-bot", html);
      messagesEl.appendChild(bubble);
      wireChips(bubble);
      scrollToBottom();
    }
 
    function appendLoading() {
      const bubble = el("div", "priv-msg priv-loading", "Private is thinking…");
      bubble.id = "privLoadingBubble";
      messagesEl.appendChild(bubble);
      scrollToBottom();
      return bubble;
    }
 
    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
 
    function wireChips(scope) {
      scope.querySelectorAll(".priv-chip").forEach(chip => {
        chip.addEventListener("click", () => handleUserQuery(chip.dataset.q));
      });
    }
 
    async function handleUserQuery(text) {
      if (!text || !text.trim()) return;
      appendUserMessage(text);
      inputEl.value = "";
      const loadingBubble = appendLoading();
      try {
        const html = await answer(text);
        loadingBubble.remove();
        appendBotMessage(html);
      } catch (e) {
        loadingBubble.remove();
        appendBotMessage(`<p>Something went wrong loading that. Please try again.</p>`);
        console.error("Private assistant error:", e);
      }
    }
 
    sendBtn.addEventListener("click", () => handleUserQuery(inputEl.value));
    inputEl.addEventListener("keypress", e => {
      if (e.key === "Enter") handleUserQuery(inputEl.value);
    });
  }
 
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildUI);
  } else {
    buildUI();
  }
})();
/**
 * test-intents.js — regression suite for Private's intent matching.
 *
 * Run before every deploy:
 *     node test-intents.js
 *
 * IMPORTANT: this file mirrors the regexes inside assistant.js's answer()
 * function. Whenever you edit a pattern in assistant.js, copy the same
 * edit here, then add a test case for whatever you just fixed. This is
 * what stops you from re-breaking a phrase you already fixed once.
 */
 
const OFF_TOPIC_PATTERN =
  /\b(girlfriend|boyfriend|wife|husband|dating|relationship status|married|siblings?|brother|sister|religion|caste|political|salary|income|net worth|weight|height|book(s)? (is|are) (he|sameer) reading|currently reading)\b/;
 
const CODING_TRIGGER =
  /\bcodechef\b|\brating\b|\bcontest(s)?\b|\bbadges?\b|\bcoding profile(s)?\b|\bcompetitive programming profile(s)?\b|\bcoding stats?\b|\bcoding page\b/;
 
function extractCodingPlatform(msg) {
  if (/\bleetcode\b/.test(msg)) return "leetcode";
  if (/\bgfg\b|\bgeeksforgeeks\b/.test(msg)) return "gfg";
  if (/\bcodechef\b/.test(msg)) return "codechef";
  return null;
}
 
function extractCodingStat(msg) {
  if (/\brating\b/.test(msg)) return "rating";
  if (/\bcontest(s)?\b/.test(msg)) return "contests";
  if (/\bbadges?\b/.test(msg)) return "badges";
  if (/\bproblems?( solved)?\b/.test(msg)) return "problems";
  return null;
}
 
const fs = require("fs");
const path = require("path");
const KB = JSON.parse(fs.readFileSync(path.join(__dirname, "assistant-data.json"), "utf8"));
 
function extractProjectName(msg) {
  const projects = KB.projects || [];
  const msgNorm = msg.replace(/[^a-z0-9]/gi, "").toLowerCase();
  for (const p of projects) {
    const key = p.name.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (key && msgNorm.includes(key)) return p;
  }
  return null;
}
 
function route(msgRaw) {
  const msg = msgRaw.toLowerCase().trim();
 
  if (OFF_TOPIC_PATTERN.test(msg)) return "OFF_TOPIC";
 
  const namedProject = extractProjectName(msg);
  if (namedProject) return `PROJECTS(${namedProject.name})`;
 
  if (CODING_TRIGGER.test(msg)) {
    const platform = extractCodingPlatform(msg);
    const stat = extractCodingStat(msg);
    return `CODING(${platform || "all"},${stat || "overview"})`;
  }
  if (/\b(dsa|leetcode|gfg|geeksforgeeks|data structures?|problems? solved|competitive programming)\b/.test(msg))
    return "DSA";
  if (/\b(intern(ship)?|aws academy|eduskills|data engineering)\b/.test(msg)) {
    const durationOnly = /\bduration\b|\bhow long\b|\bwhen (was|did)\b.*\bintern/.test(msg);
    const concise = /\b(key insight|insights|summary|briefly|short|takeaways?|highlights?)\b/.test(msg);
    if (durationOnly) return "INTERNSHIP(duration)";
    return concise ? "INTERNSHIP(concise)" : "INTERNSHIP(full)";
  }
  if (/\b(born|birthday|birth date|dob|how old|age)\b/.test(msg)) return "BIRTH";
  if (
    /\b(semester|college|university|cgpa|degree|course|studying|academic year|which year|what year|current year)\b/.test(
      msg
    )
  )
    return "EDUCATION";
  if (/\b(resume|cv)\b/.test(msg)) return "CONTACT";
  if (/\b(contact|email|reach|hire|linkedin|telegram)\b/.test(msg)) return "CONTACT";
  if (/\bposts?\b/.test(msg) && !/\bblog post\b/.test(msg)) return "POSTS";
  if (/\bthoughts?\b|\bessays?\b/.test(msg)) return "THOUGHTS";
  if (/\b(project|projects|repo|repos|repository|github|built|collaboration|team)\b/.test(msg)) return "PROJECTS";
  if (
    /\b(skill|skills|tech stack|technologies|technology|stack|proficient|programming language|coding language|language(s)?|framework(s)?)\b/.test(
      msg
    )
  ) {
    if (/\bfront[\s-]?end\b/.test(msg)) return "SKILLS(frontend)";
    if (/\bback[\s-]?end\b/.test(msg)) return "SKILLS(backend)";
    if (/\bdatabase(s)?\b/.test(msg)) return "SKILLS(database)";
    if (/\bmachine learning\b|\bml\b/.test(msg)) return "SKILLS(machine_learning)";
    return "SKILLS";
  }
  if (/\bwhere.*(live|lives|based|from)\b|\blocation\b|\bhometown\b|\bbased in\b/.test(msg)) return "LOCATION";
  if (
    /\b(about (sameer|him)\b|who is sameer(?!'s)|who are you|\bbio\b|background|tell me about sameer|what does (he|sameer) do|profession|occupation|current role|what is his job)\b/.test(
      msg
    )
  )
    return "ABOUT";
  if (/\b(hi|hello|hey|yo|sup|greetings)\b/.test(msg)) return "GREETING";
  return "FALLBACK";
}
 
// [phrase, expectedIntent] — every question from every bug report so far.
// Add new rows here whenever you fix something new.
const TESTS = [
  // Round 1
  ["where does sameer lives", "LOCATION"],
  ["who is sameer's girlfriend", "OFF_TOPIC"],
  ["in which language is sameer proficient in?", "SKILLS"],
  ["what is sameer's aliases", "FALLBACK"],
  ["which project did he built in collaboration with few other members", "PROJECTS"],
  ["which book is sameer currently reading", "OFF_TOPIC"],
  ["list all current posts of sameer", "POSTS"],
  ["list all current thoughts of sameer", "THOUGHTS"],
  ["show java projects", "PROJECTS"],
  ["tell me about his aws internship", "INTERNSHIP(full)"],
  ["what are his skills", "SKILLS"],
 
  // Round 2
  ["when was sameer born?", "BIRTH"],
  ["how old is sameer?", "BIRTH"],
  ["what does sameer do?", "ABOUT"],
  ["in which semester is sameer currently studying", "EDUCATION"],
  ["in which college is sameer is studying", "EDUCATION"],
  ["in which year is he currently in", "EDUCATION"],
  ["list his frontend skills", "SKILLS(frontend)"],
  ["list backend skills", "SKILLS(backend)"],
  ["what are his machine learning skills", "SKILLS(machine_learning)"],
 
  // Round 4 — coding profiles (LeetCode/GfG/CodeChef)
  ["what's his codechef rating", "CODING(codechef,rating)"],
  ["how many contests has he done", "CODING(all,contests)"],
  ["show his coding profiles", "CODING(all,overview)"],
  ["what badges does he have on leetcode", "CODING(leetcode,badges)"],
  ["how many problems has he solved on codechef", "CODING(codechef,problems)"],
  ["show his coding page", "CODING(all,overview)"],
  ["what's his gfg rating", "CODING(gfg,rating)"],
  ["list his key insights about his internship", "INTERNSHIP(concise)"],
 
  // Round 5 — real bugs found from live screenshots (2026-07-26)
  ["tell me about his leafscan work", "PROJECTS(LeafScan)"],
  ["tell me about his leafscan project", "PROJECTS(LeafScan)"],
  ["list his aws internship duration", "INTERNSHIP(duration)"],
  ["how long was his internship", "INTERNSHIP(duration)"],
  ["about reading", "FALLBACK"],
 
  // Round 3 — over-matching bugs (rule matched when it should have deferred to the LLM)
  ["who is sameer's favourite actor", "FALLBACK"],
  ["where does sameer live", "LOCATION"],
  ["who is sameer", "ABOUT"],
  ["who is sameer's best friend", "FALLBACK"],
 
  // Sanity checks — things that should NOT be reclassified by future edits
  ["hi", "GREETING"],
  ["hello there", "GREETING"],
  ["how do I contact him", "CONTACT"],
  ["can I see his resume", "CONTACT"],
  ["show his thoughts", "THOUGHTS"],
  ["show python projects", "PROJECTS"],
  ["what is his cgpa", "EDUCATION"]
];
 
let pass = 0;
let fail = 0;
 
console.log("Running Private intent regression suite...\n");
 
TESTS.forEach(([phrase, expected]) => {
  const actual = route(phrase);
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(
    `${ok ? "✅ PASS" : "❌ FAIL"}  ${phrase.padEnd(65)} expected=${expected.padEnd(20)} got=${actual}`
  );
});
 
console.log(`\n${pass} passed, ${fail} failed, ${TESTS.length} total.`);
if (fail > 0) {
  console.log("\nFix the regex(es) above before deploying — see DEBUGGING_GUIDE.md.");
  process.exit(1);
}
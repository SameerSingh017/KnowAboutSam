# Sameer Singh — Personal Portfolio
 
A hand-crafted personal portfolio website built with pure HTML, CSS, and JavaScript. No frameworks, no frontend build tools — just clean, fast, and responsive web pages. Thoughts and Posts are powered by Firebase Firestore, making them live and visible to all visitors in real time. All writes are handled by a small Cloudflare Worker backend, so nothing sensitive — passwords, keys, or credentials — ever ships to the browser.

 ### Live Link - https://knowaboutsam.netlify.app/ 
---
 
## Pages
 
| Page | File | Description |
|---|---|---|
| Home | `index.html` | Hero section with intro, tagline, and about snapshot |
| About | `about.html` | Bio, education, experience, **skills**, and **certifications** — both rendered dynamically |
| Projects | `projects.html` | Showcase of selected work |
| Coding | `coding.html` | Displays competitive programming profiles |
| Thoughts | `thoughts.html` | Long-form essays and reflections (Firebase-powered) |
| Posts | `posts.html` | Short microblog-style entries (Firebase-powered) |
| Contact | `contact.html` | Email, LinkedIn, and Telegram links |
 
---
 
## File Structure
 
```
portfolio/
│
├── index.html            # Home page
├── about.html             # About page — skills & certifications render dynamically here
├── projects.html
|---coding.html
├── thoughts.html            # Thoughts page (Firebase-powered)
├── posts.html                 # Posts page (Firebase-powered)
├── contact.html
│
├── styles.css             # Core styles (original)
├── extra.css                # Extended styles for new pages
├── script.js                  # Nav, Firebase reads, admin auth, dynamic skills/certifications rendering
├── assistant.js                 # "Private" — AI portfolio assistant widget (self-contained)
├── assistant-data.json           # Single source of truth: bio, skills, certifications, projects, DSA progress
├── test-intents.js                # Regression tests for assistant.js's rule-based intent router
├── firestore.rules                 # Firestore security rules (all client writes denied)
├── .gitignore
│
├── assets/
│   ├── hero-headshot.png
│   ├── 1000031928.jpeg
│   └── ss_resume.pdf
|   |-- leafscan-screenshot.png
│
├── private-llm-worker/               # Cloudflare Worker — admin auth, Firestore write proxy, LLM fallback
│   ├── src/index.js
│   ├── wrangler.toml
│   └── package.json
│
└── README.md
```
 
---
 
## Features
 
### Design
- Warm earthy color palette (`#f2ede4`, `#c5a891`, `#2d2621`)
- Fully responsive — mobile hamburger menu, fluid layouts
- Subtle hover animations and micro-interactions throughout
- Consistent typography and spacing across all pages
### Projects Showcase
Each project card includes a tech stack breakdown, deployment badges, and a custom visual — details maintained directly in `projects.html` and mirrored in `assistant-data.json` so Private can answer questions about them.
 
### Dynamic Skills & Certifications
Both sections on `about.html` are rendered entirely from `assistant-data.json` via `script.js` — there's no hardcoded HTML for either anymore.
 
- **Skills** are grouped by category (Languages, Machine Learning, Frontend, Backend, Databases, Cloud & Deployment, Developer Tools, Soft Skills). Icons are looked up from a `SKILL_ICONS` map in `script.js`; a skill without a matching icon still renders correctly as text-only.
- **Certifications** render as a list of cards (name, issuer, date, and a link to the certificate) directly from the `certifications` array in the JSON.
To add a new skill or certificate, edit `assistant-data.json` only — no HTML editing required. (Optionally add a matching icon URL to `SKILL_ICONS` in `script.js` if you want a logo for a new skill.)
 
### Firebase-Powered CMS (Thoughts & Posts)
Thoughts and Posts are stored in **Firebase Firestore** and rendered in real time for every visitor via `onSnapshot` listeners — publishing or deleting an entry reflects instantly across all browsers, no page refresh needed.
 
#### How to publish
1. Open `thoughts.html` or `posts.html`
2. Click the ✦ button in the bottom-right corner
3. Enter the admin password
4. Fill in the compose panel and click Publish / Post
#### How it works (secure by design)
Writes do not go directly from the browser to Firestore. The flow is:
 
1. Browser sends the password to the Worker's `/admin-login` endpoint
2. Worker checks it against an encrypted `ADMIN_PASS` secret and, if correct, returns a signed session token (valid 24h)
3. Publishing/deleting sends that token to the Worker's `/posts` or `/thoughts` endpoints
4. The Worker verifies the token, then writes to Firestore itself using a service account
5. Firestore's own rules (`firestore.rules`) reject any direct write from a browser, authenticated-looking or not — the Worker is the only path in
See **Admin Authentication & Security** below for the full picture, including how to rotate the password.
 
### Contact Page
Direct links to Email, LinkedIn, and Telegram with animated hover cards and a live availability indicator (green pulse dot).
 
### Private — AI Portfolio Assistant
A floating chat assistant that answers visitor questions about Sameer — background, AWS internship, skills (including "frontend skills only" or "machine learning skills"), projects (filterable by language, e.g. "show Java projects"), certifications, DSA progress, and contact info.
 
- **Knowledge base** — reads from `assistant-data.json` on every page load; edit that file directly to update what Private knows, no code changes needed.
- **Rule-based first, LLM fallback second** — a fast regex-based intent router (mirrored in `test-intents.js`) handles common questions instantly. Anything it can't classify is sent to the Cloudflare Worker, which asks an LLM (Cloudflare Workers AI) to answer using the same JSON as context — the LLM is instructed to only use given facts and admit when it doesn't know something.
- **Live GitHub check** — for project questions, it also queries the public GitHub API to surface repos not yet featured in `assistant-data.json`, cached in `sessionStorage` for 10 minutes.
- **Maintenance rule:** the live HTML pages and Private's knowledge base don't sync automatically. Whenever you add something new to the site, mirror it into `assistant-data.json` too.
Run `node test-intents.js` before every deploy — it catches regressions when editing the intent router's regex patterns.
 
---
 
## Admin Authentication & Security
 
This project previously had the admin password hardcoded directly in `script.js`. That's been replaced with a proper backend-verified flow, because anything in client-side JS ships to every visitor regardless of whether the GitHub repo is public or private.
 
**Current design:**
- `ADMIN_PASS`, `ADMIN_TOKEN_SECRET`, and the Firebase service account credentials all live exclusively as Wrangler-encrypted secrets — never in any committed file
- Firestore rules deny all client writes outright (`allow write: if false`) — see `firestore.rules`
- All writes route through `private-llm-worker`, which is the only thing authorized to write to Firestore (via a service account, which bypasses security rules entirely)
**To change the admin password**, don't edit any file — rotate the Wrangler secret instead:
```bash
cd private-llm-worker
wrangler secret put ADMIN_PASS
```
 
**Full secret list needed to run the Worker:**
```bash
wrangler secret put ADMIN_PASS               # admin login password
wrangler secret put ADMIN_TOKEN_SECRET         # random string — signs admin session tokens
wrangler secret put FIREBASE_CLIENT_EMAIL       # from Firebase service account JSON
wrangler secret put FIREBASE_PRIVATE_KEY         # from Firebase service account JSON
```
 
---
 
## Firebase Setup
 
This portfolio uses **Firebase Firestore** as its database.
 
### Project details
| Key | Value |
|---|---|
| Project ID | `knowaboutsam-40396` |
| Auth Domain | `knowaboutsam-40396.firebaseapp.com` |
| Firestore collections | `thoughts`, `posts` |
 
### Firestore Security Rules
```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public can only read. All writes happen through the Cloudflare
    // Worker (private-llm-worker), authenticated as a service account,
    // which bypasses these rules entirely. No client writes directly —
    // not even an admin-logged-in browser.
    match /thoughts/{id} {
      allow read: if true;
      allow write: if false;
    }
    match /posts/{id} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```
 
The Firebase `apiKey` in `script.js`/`assistant.js` is safe to be public — it's a client identifier, not a secret. Real access control is enforced by these rules plus the Worker's admin auth, not by hiding the key.
 
---
 
## Cloudflare Worker (`private-llm-worker/`)
 
Handles three jobs: admin login, all Firestore writes, and the LLM fallback for Private.
 
```bash
cd private-llm-worker
npm install
wrangler dev      # local development
wrangler deploy   # deploy to Cloudflare
```
 
| Endpoint | Method | Purpose |
|---|---|---|
| `/admin-login` | POST | Verify password, issue a signed session token |
| `/admin-verify` | POST | Check whether a session token is still valid |
| `/posts` | POST | Create a post (requires valid token) |
| `/posts/:id` | DELETE | Delete a post (requires valid token) |
| `/thoughts` | POST | Create a thought (requires valid token) |
| `/thoughts/:id` | DELETE | Delete a thought (requires valid token) |
| `/` | POST | Ask Private a question (LLM fallback) |
 
---
 
## Setup & Running Locally
 
No installation or build step required for the frontend. Open `index.html` directly, or serve with any static file server:
 
```bash
# Python
python -m http.server 3000
 
# Node.js
npx serve .
 
# VS Code — right-click index.html → Open with Live Server
```
 
For the admin panel and chatbot LLM fallback to work locally, run the Worker in a separate terminal (`wrangler dev` inside `private-llm-worker/`) and make sure `AUTH_ENDPOINT` / `LLM_ENDPOINT` in `script.js` / `assistant.js` point to it.
 
---
 
## Deployment
 
The frontend is a fully static project and can be deployed anywhere:
 
| Platform | How |
|---|---|
| Vercel | Connect GitHub repo → auto-deploys on push |
| Netlify | Drag & drop the folder, or connect GitHub |
| GitHub Pages | Push to `gh-pages` branch or enable in repo settings |
 
No build command or output directory is needed — deploy the root folder as-is. The Worker deploys separately via `wrangler deploy` and is not part of the static site build.
 
---
 
## Customization Reference
 
| What to change | Where |
|---|---|
| Admin password | `wrangler secret put ADMIN_PASS` — not in any file |
| Firebase project | `script.js` / `assistant.js` — `firebaseConfig` object |
| Skills & certifications | `assistant-data.json` — `skills` and `certifications` |
| Skill icons | `script.js` — `SKILL_ICONS` map |
| Color palette | `styles.css` — top CSS variables |
| Profile photo | Replace `assets/hero-headshot.png` |
| About page photo | Replace `assets/1000031928.jpeg` |
| Resume | Replace `assets/ss_resume.pdf` |
| Social links | Footer section in each HTML file |
| Telegram handle | `contact.html` — Telegram `<a>` href |
| Nav logo | Search `ƧS❅` in any HTML file |
| Project details | `projects.html` — edit project cards directly (mirror in `assistant-data.json` too) |
 
---
 
## Browser Support
 
Works on all modern browsers — Chrome, Firefox, Safari, Edge. No polyfills needed. Firebase SDK is loaded via Google's CDN and supports all evergreen browsers.
 
---
 
## License
 
This project is personal and not intended for reuse or redistribution. All content, design, and writing belong to the author.
 
---
 
**Author:** Sameer Singh
**Email:** sameer0555singh@gmail.com
 

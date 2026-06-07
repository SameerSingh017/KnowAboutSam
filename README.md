# Sameer Singh — Personal Portfolio

A hand-crafted personal portfolio website built with pure HTML, CSS, and JavaScript. No frameworks, no build tools — just clean, fast, and responsive web pages. Thoughts and Posts are powered by Firebase Firestore, making them live and visible to all visitors in real time.

---

## Pages

| Page | File | Description |
|---|---|---|
| Home | `index.html` | Hero section with intro, tagline, and about snapshot |
| About | `about.html` | Bio, education, experience, and skills |
| Projects | `projects.html` | Showcase of selected work |
| Thoughts | `thoughts.html` | Long-form essays and reflections (Firebase-powered) |
| Posts | `posts.html` | Short microblog-style entries (Firebase-powered) |
| Contact | `contact.html` | Email, LinkedIn, and Telegram links |

---

## File Structure

```
portfolio/
│
├── index.html          # Home page
├── about.html          # About page
├── projects.html       # Projects page
├── thoughts.html       # Thoughts page
├── posts.html          # Posts page
├── contact.html        # Contact page
│
├── styles.css          # Core styles (original)
├── extra.css           # Extended styles for new pages
├── script.js           # JavaScript — nav, Firebase CMS, interactions
│
├── assets/
│   ├── hero-headshot.png       # Hero section profile photo
│   ├── 1000031928.jpeg         # About page photo
│   └── ss_resume.pdf           # Downloadable resume
│
└── README.md           # This file
```

---

## Features

### Design
- Warm earthy color palette (`#f2ede4`, `#c5a891`, `#2d2621`)
- Fully responsive — mobile hamburger menu, fluid layouts
- Subtle hover animations and micro-interactions throughout
- Consistent typography and spacing across all pages

### Projects Showcase
Each project card includes a tech stack breakdown, deployment badges, and a custom visual:
- **Convora** — animated chat bubble preview (React, Node.js, Socket.IO, WebRTC, Redis, MongoDB)
- **Interactive Periodic Table** — live mini element tiles (HTML, CSS, JS)
- **Library Management System** — terminal window mockup (Java, JDBC, MySQL)

### Firebase-Powered CMS (Thoughts & Posts)
Thoughts and Posts are stored in **Firebase Firestore** and rendered in real time for every visitor. Publishing or deleting an entry reflects instantly across all browsers worldwide — no page refresh needed.

#### How to publish
1. Open `thoughts.html` or `posts.html` in your browser
2. Click the subtle **✦** button in the bottom-right corner
3. Enter your admin password (default: `sameer2006`)
4. Fill in the compose panel and click **Publish / Post**

> To change the admin password, edit line 13 of `script.js`:
> ```js
> const ADMIN_PASS = 'your_new_password';
> ```

#### How it works
- `script.js` uses the Firebase JS SDK (v12) loaded via CDN — no npm required
- All HTML files load `script.js` as `type="module"` to support ES module imports
- Firestore `onSnapshot` listeners keep the page live — new content appears without a reload
- Deleting an entry removes it from Firestore and from the DOM immediately

### Contact Page
Direct links to Email, LinkedIn, and Telegram with animated hover cards and a live availability indicator (green pulse dot).

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
In the Firebase console under **Firestore → Rules**, the following rules are set:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
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

Public reads are allowed so all visitors can see posts. Writes are handled securely via the API key embedded in `script.js` (client-side SDK), which is scoped to this project only.

---

## Setup & Running Locally

No installation or build step required. Open `index.html` directly, or serve with any static file server:

```bash
# Python
python -m http.server 3000

# Node.js
npx serve .

# VS Code — right-click index.html → Open with Live Server
```

> **Important:** Firebase will work on `localhost` during development as long as your Firestore rules allow reads. Writes require the correct API key, which is already in `script.js`.

---

## Deployment

The site is a fully static project and can be deployed anywhere:

| Platform | How |
|---|---|
| **Vercel** | Connect GitHub repo → auto-deploys on push |
| **Netlify** | Drag & drop the folder, or connect GitHub |
| **GitHub Pages** | Push to `gh-pages` branch or enable in repo settings |

No build command or output directory is needed — just deploy the root folder as-is.

---

## Customization Reference

| What to change | Where |
|---|---|
| Admin password | `script.js` — line 13 |
| Firebase project | `script.js` — `firebaseConfig` object |
| Color palette | `styles.css` — top CSS variables |
| Profile photo | Replace `assets/hero-headshot.png` |
| About page photo | Replace `assets/1000031928.jpeg` |
| Resume | Replace `assets/ss_resume.pdf` |
| Social links | Footer section in each HTML file |
| Telegram handle | `contact.html` — Telegram `<a>` href |
| Nav logo | Search `ƧS❅` in any HTML file |
| Project details | `projects.html` — edit project cards directly |

---

## Browser Support

Works on all modern browsers — Chrome, Firefox, Safari, Edge. No polyfills needed. Firebase SDK is loaded via Google's CDN and supports all evergreen browsers.

---

## License

This project is personal and not intended for reuse or redistribution. All content, design, and writing belong to the author.

---

**Author:** Sameer Singh
**Email:** sameer0555singh@gmail.com

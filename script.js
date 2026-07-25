
 
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    query,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
 
 
const firebaseConfig = {
    apiKey: "AIzaSyBWDwISSrpAEXbWPG_-QmzgnVvTchun7iI",
    authDomain: "knowaboutsam-40396.firebaseapp.com",
    projectId: "knowaboutsam-40396",
    storageBucket: "knowaboutsam-40396.firebasestorage.app",
    messagingSenderId: "324249076457",
    appId: "1:324249076457:web:8d1f9ac232f086a1cc6678"
};
 
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
 
 
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');
 
if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('open');
            navLinks.classList.remove('open');
        });
    });
}
 
 
const scrollIndicator = document.querySelector('.scroll-indicator');
if (scrollIndicator) {
    scrollIndicator.addEventListener('click', () => {
        document.querySelector('.navbar')?.scrollIntoView({ behavior: 'smooth' });
    });
}
 
 
 
const ADMIN_TOKEN_KEY = 'ss_admin_token_v1';
const AUTH_ENDPOINT = 'https://private-llm-worker.askprivate.workers.dev';
 
function isAdmin() {
    return !!sessionStorage.getItem(ADMIN_TOKEN_KEY);
}
 
async function promptAdmin() {
    if (isAdmin()) { showAdminPanel(); return; }
    const pass = prompt('Enter admin password:');
    if (pass === null) return;
 
    try {
        const res = await fetch(`${AUTH_ENDPOINT}/admin-login`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ password: pass })
        });
        if (!res.ok) {
            alert('Incorrect password.');
            return;
        }
        const { token } = await res.json();
        sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
        showAdminPanel();
    } catch (e) {
        console.error(e);
        alert('Could not reach auth server. Try again.');
    }
}
 
function showAdminPanel() {
    const bar = document.getElementById('adminBar');
    if (bar) {
        bar.style.display = 'block';
        bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    document.body.classList.add('admin-mode');
    document.querySelectorAll('.post-delete, .thought-delete').forEach(el => {
        el.style.display = 'block';
    });
}
 
function closeAdmin() {
    const bar = document.getElementById('adminBar');
    if (bar) bar.style.display = 'none';
}
 
 
window.promptAdmin = promptAdmin;
window.closeAdmin = closeAdmin;
 
 
function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
 
function showToast(msg) {
    let toast = document.getElementById('ss-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ss-toast';
        toast.style.cssText = `
            position:fixed; bottom:70px; right:28px; background:#2d2621; color:#f2ede4;
            padding:12px 20px; border-radius:6px; font-size:0.82rem; font-weight:600;
            letter-spacing:0.5px; z-index:200; opacity:0; transition:opacity 0.3s ease;
            pointer-events:none;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}
 
 
 
function authHeaders() {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    return { 'content-type': 'application/json', 'authorization': `Bearer ${token}` };
}
 
window.publishThought = async function () {
    const title = document.getElementById('thoughtTitle')?.value.trim();
    const subtitle = document.getElementById('thoughtSubtitle')?.value.trim();
    const body = document.getElementById('thoughtBody')?.value.trim();
 
    if (!title || !body) { alert('Title and body are required.'); return; }
 
    const btn = document.querySelector('#adminBar .admin-publish');
    if (btn) { btn.textContent = 'Publishing...'; btn.disabled = true; }
 
    try {
        const res = await fetch(`${AUTH_ENDPOINT}/thoughts`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ title, subtitle, body })
        });
        if (!res.ok) throw new Error('Request failed');
        showToast('Thought published ✓');
        document.getElementById('thoughtTitle').value = '';
        document.getElementById('thoughtSubtitle').value = '';
        document.getElementById('thoughtBody').value = '';
        closeAdmin();
    } catch (e) {
        console.error(e);
        alert('Failed to save.');
    } finally {
        if (btn) { btn.textContent = 'PUBLISH'; btn.disabled = false; }
    }
};
 
 
window.deleteThought = async function (id) {
    if (!confirm('Delete this thought?')) return;
    try {
        const res = await fetch(`${AUTH_ENDPOINT}/thoughts/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('Request failed');
        document.querySelector(`[data-id="${id}"]`)?.remove();
        showToast('Deleted ✓');
    } catch (e) {
        console.error(e);
        alert('Failed to delete.');
    }
};
 
window.toggleThought = function (id) {
    const body = document.getElementById('body-' + id);
    const btn = body?.parentElement?.querySelector('.read-toggle');
    if (!body) return;
    const expanded = body.classList.contains('expanded');
    body.classList.toggle('expanded', !expanded);
    body.classList.toggle('collapsed', expanded);
    if (btn) btn.textContent = expanded ? 'Read more ↓' : 'Read less ↑';
};
 
function initThoughts() {
    const feed = document.getElementById('thoughtsFeed');
    if (!feed) return;
 
    const q = query(collection(db, 'thoughts'), orderBy('createdAt', 'desc'));
 
    
    onSnapshot(q, (snapshot) => {
        feed.querySelectorAll('[data-dynamic]').forEach(el => el.remove());
 
        snapshot.forEach(docSnap => {
            const t = docSnap.data();
            const id = docSnap.id;
 
            const article = document.createElement('article');
            article.className = 'thought-card';
            article.dataset.id = id;
            article.dataset.dynamic = '1';
 
            const paragraphs = t.body.split('\n')
                .filter(p => p.trim())
                .map(p => `<p>${escapeHtml(p)}</p>`)
                .join('');
 
            article.innerHTML = `
                <div class="thought-header">
                    <span class="thought-date">${escapeHtml(t.date)}</span>
                    <span class="thought-tag">${escapeHtml(t.tag || 'Personal')}</span>
                </div>
                <h2 class="thought-title">${escapeHtml(t.title)}</h2>
                ${t.subtitle ? `<p class="thought-subtitle">${escapeHtml(t.subtitle)}</p>` : ''}
                <div class="thought-body collapsed" id="body-${id}">
                    ${paragraphs}
                </div>
                <button class="read-toggle" onclick="toggleThought('${id}')">Read more ↓</button>
                ${isAdmin() ? `<div class="thought-delete admin-only" style="margin-top:12px;font-size:0.72rem;color:#e17055;cursor:pointer;font-weight:600;" onclick="deleteThought('${id}')">✕ delete</div>` : ''}
            `;
 
            feed.appendChild(article);
        });
    }, (err) => {
        console.error('Firestore thoughts error:', err);
    });
}
 
 
 
window.publishPost = async function () {
    const tag = document.getElementById('postTag')?.value.trim() || 'Note';
    const body = document.getElementById('postBody')?.value.trim();
 
    if (!body) { alert('Post body cannot be empty.'); return; }
 
    const btn = document.querySelector('#adminBar .admin-publish');
    if (btn) { btn.textContent = 'Posting...'; btn.disabled = true; }
 
    try {
        const res = await fetch(`${AUTH_ENDPOINT}/posts`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ tag, body })
        });
        if (!res.ok) throw new Error('Request failed');
        showToast('Post published ✓');
        document.getElementById('postTag').value = '';
        document.getElementById('postBody').value = '';
        closeAdmin();
    } catch (e) {
        console.error(e);
        alert('Failed to save.');
    } finally {
        if (btn) { btn.textContent = 'POST'; btn.disabled = false; }
    }
};
 
 
window.deletePost = async function (id) {
    if (!confirm('Delete this post?')) return;
    try {
        const res = await fetch(`${AUTH_ENDPOINT}/posts/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('Request failed');
        document.querySelector(`[data-id="${id}"]`)?.remove();
        showToast('Deleted ✓');
    } catch (e) {
        console.error(e);
        alert('Failed to delete.');
    }
};
 
function initPosts() {
    const feed = document.getElementById('postsFeed');
    if (!feed) return;
 
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
 
    onSnapshot(q, (snapshot) => {
        feed.querySelectorAll('[data-dynamic]').forEach(el => el.remove());
 
        snapshot.forEach(docSnap => {
            const p = docSnap.data();
            const id = docSnap.id;
 
            const article = document.createElement('article');
            article.className = 'post-card';
            article.dataset.id = id;
            article.dataset.dynamic = '1';
 
            article.innerHTML = `
                <div class="post-top">
                    <span class="post-tag-label">${escapeHtml(p.tag)}</span>
                    <span class="post-date">${escapeHtml(p.date)}</span>
                </div>
                <p class="post-body">${escapeHtml(p.body)}</p>
                ${isAdmin() ? `<div class="post-delete admin-only" onclick="deletePost('${id}')">✕ delete</div>` : ''}
            `;
 
            feed.appendChild(article);
        });
    }, (err) => {
        console.error('Firestore posts error:', err);
    });
}
 
const SKILL_ICONS = {
    "Java": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg",
    "Python": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
    "SQL": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg",
    "TensorFlow": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tensorflow/tensorflow-original.svg",
    "Keras": "https://upload.wikimedia.org/wikipedia/commons/a/ae/Keras_logo.svg",
    "OpenCV": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/opencv/opencv-original.svg",
    "NumPy": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/numpy/numpy-original.svg",
    "React": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
    "CSS": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg",
    "HTML": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg",
    "JavaScript": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg",
    "FastAPI": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg",
    "JDBC": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg",
    "MongoDB": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg",
    "MySQL": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg",
    "AWS (S3, EC2, IAM)": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Amazon_Web_Services_Logo.svg/1280px-Amazon_Web_Services_Logo.svg.png?_=20170912170050",
    "Netlify": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Cib-netlify_%28CoreUI_Icons_v1.0.0%29.svg/960px-Cib-netlify_%28CoreUI_Icons_v1.0.0%29.svg.png",
    "Vercel": "https://images.seeklogo.com/logo-png/48/2/vercel-logo-png_seeklogo-480587.png",
    "Render": "https://th.bing.com/th/id/OIP.I8G7BtE1Tng3frDV2riF1QHaHa?w=173&h=180&c=7&r=0&o=7&dpr=1.3&pid=1.7&rm=3",
    "Git": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg",
    "GitHub": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg",
    "VS Code": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg",
    "MySQL Workbench": "https://www.vectorlogo.zone/logos/mysql/mysql-official.svg",
    "Tableau": "https://tse2.mm.bing.net/th/id/OIP.sq5ACM1N-oObnzydLfnxlgHaHT?r=0&rs=1&pid=ImgDetMain&o=7&rm=3"
    // "Servlets" and "JSP" intentionally have no devicon match — they'll
    // render as text-only, which is fine. Add a line here any time you
    // pick up a new tool and want it to show a logo.
};
 
const SKILL_CATEGORY_LABELS = {
    languages: "💻 Programming Languages",
    machine_learning: "🤖 Machine Learning",
    frontend: "🎨 Frontend",
    backend: "⚙️ Backend",
    databases: "🗄️ Databases",
    clodep: "☁️ Cloud & Deployment",
    tools: "🧰 Tools & Technologies"
    // soft_skills is rendered separately as tags, not a skill-grid
};
 
function initSkills() {
    const container = document.getElementById('skillsContainer');
    if (!container) return;
 
    fetch('assistant-data.json', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
            const skills = data.skills || {};
            let html = '';
 
            for (const [key, label] of Object.entries(SKILL_CATEGORY_LABELS)) {
                const items = skills[key];
                if (!items || !items.length) continue;
                html += `
                    <div class="skill-category">
                        <h4>${label}</h4>
                        <div class="skill-grid">
                            ${items.map(name => {
                                const icon = SKILL_ICONS[name];
                                return `<div class="skill-item">${icon ? `<img src="${icon}" alt="${escapeHtml(name)}">` : ''}<span>${escapeHtml(name)}</span></div>`;
                            }).join('')}
                        </div>
                    </div>`;
            }
 
            if (skills.soft_skills && skills.soft_skills.length) {
                html += `
                    <div class="skill-category">
                        <h4>🤝 Soft Skills</h4>
                        <div class="soft-skills-tags">
                            ${skills.soft_skills.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}
                        </div>
                    </div>`;
            }
 
            container.innerHTML = html;
        })
        .catch(err => console.error('Failed to load skills:', err));
}
 
function initCertifications() {
    const container = document.getElementById('certificationsContainer');
    if (!container) return;
 
    fetch('assistant-data.json', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
            const certs = data.certifications || [];
            container.innerHTML = certs.map(cert => `
                <div class="certification-item">
                    <div class="cert-header">
                        <strong>${escapeHtml(cert.name)}</strong>
                        <span>${escapeHtml(cert.date)}</span>
                    </div>
                    <p class="cert-issuer">${escapeHtml(cert.issuer)}</p>
                    ${cert.url ? `<a href="${cert.url}" target="_blank" class="cert-link">View Certificate ↗</a>` : ''}
                </div>
            `).join('');
        })
        .catch(err => console.error('Failed to load certifications:', err));
}
 
document.addEventListener('DOMContentLoaded', () => {
    if (isAdmin()) {
        document.body.classList.add('admin-mode');
        document.querySelectorAll('.post-delete, .thought-delete').forEach(el => {
            el.style.display = 'block';
        });
    }
    initThoughts();
    initPosts();
    initCertifications();
    initSkills();
});
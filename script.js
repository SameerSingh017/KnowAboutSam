

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    deleteDoc,
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


const ADMIN_KEY = 'ss_admin_v1';
const ADMIN_PASS = 'sameer2006'; 

function isAdmin() {
    return sessionStorage.getItem(ADMIN_KEY) === 'yes';
}

function promptAdmin() {
    if (isAdmin()) { showAdminPanel(); return; }
    const pass = prompt('Enter admin password:');
    if (pass === ADMIN_PASS) {
        sessionStorage.setItem(ADMIN_KEY, 'yes');
        showAdminPanel();
    } else if (pass !== null) {
        alert('Incorrect password.');
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



window.publishThought = async function () {
    const title = document.getElementById('thoughtTitle')?.value.trim();
    const subtitle = document.getElementById('thoughtSubtitle')?.value.trim();
    const body = document.getElementById('thoughtBody')?.value.trim();

    if (!title || !body) { alert('Title and body are required.'); return; }

    const btn = document.querySelector('#adminBar .admin-publish');
    if (btn) { btn.textContent = 'Publishing...'; btn.disabled = true; }

    try {
        await addDoc(collection(db, 'thoughts'), {
            title,
            subtitle: subtitle || '',
            body,
            date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            tag: 'Personal',
            createdAt: Date.now()
        });
        document.getElementById('thoughtTitle').value = '';
        document.getElementById('thoughtSubtitle').value = '';
        document.getElementById('thoughtBody').value = '';
        closeAdmin();
        showToast('Thought published ✓');
    } catch (e) {
        console.error(e);
        alert('Failed to publish. Check Firebase console → Firestore rules.');
    } finally {
        if (btn) { btn.textContent = 'PUBLISH'; btn.disabled = false; }
    }
};

window.deleteThought = async function (id) {
    if (!confirm('Delete this thought?')) return;
    try {
        await deleteDoc(doc(db, 'thoughts', id));
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
        await addDoc(collection(db, 'posts'), {
            tag,
            body,
            date: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            createdAt: Date.now()
        });
        document.getElementById('postTag').value = '';
        document.getElementById('postBody').value = '';
        closeAdmin();
        showToast('Post published ✓');
    } catch (e) {
        console.error(e);
        alert('Failed to publish. Check Firebase console → Firestore rules.');
    } finally {
        if (btn) { btn.textContent = 'POST'; btn.disabled = false; }
    }
};

window.deletePost = async function (id) {
    if (!confirm('Delete this post?')) return;
    try {
        await deleteDoc(doc(db, 'posts', id));
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

document.addEventListener('DOMContentLoaded', () => {
    if (isAdmin()) {
        document.body.classList.add('admin-mode');
        document.querySelectorAll('.post-delete, .thought-delete').forEach(el => {
            el.style.display = 'block';
        });
    }
    initThoughts();
    initPosts();
});

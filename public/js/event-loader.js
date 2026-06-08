import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

function getPublicBasePath() {
    const path = window.location.pathname || '';
    const segments = path.split('/').filter(Boolean);
    return segments[0] === 'public' ? '/public' : '';
}

function readSlugFromLocation() {
    const urlParams = new URLSearchParams(window.location.search);
    let slug = urlParams.get('slug');

    if (!slug) {
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        const index = pathSegments.findIndex((segment) => segment === 'e' || segment === 'wall');
        if (index !== -1 && index + 1 < pathSegments.length) {
            slug = pathSegments[index + 1];
        }
    }

    return slug ? slug.trim() : '';
}

async function getEventBySlug(slug) {
    const q = query(collection(db, "events"), where("slug", "==", slug));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return null;
    }

    const docSnap = querySnapshot.docs[0];
    return {
        slug,
        eventId: docSnap.id,
        eventData: docSnap.data()
    };
}

export async function resolveEventFromLocation() {
    const slug = readSlugFromLocation();
    if (!slug) return null;
    return getEventBySlug(slug);
}

export function buildAppUrl(slug) {
    const base = getPublicBasePath();
    return `${window.location.origin}${base}/app.html?slug=${encodeURIComponent(slug)}`;
}

export function buildWallUrl(slug) {
    const base = getPublicBasePath();
    return `${window.location.origin}${base}/wall.html?slug=${encodeURIComponent(slug)}`;
}

export function injectThemeStyles(theme = 'wedding') {
    const normalizedTheme = theme === 'gym' ? 'gym' : 'wedding';

    const existing = document.getElementById('eventsnap-theme-link');
    if (existing) existing.remove();

    const link = document.createElement('link');
    link.id = 'eventsnap-theme-link';
    link.rel = 'stylesheet';
    link.href = normalizedTheme === 'gym' ? 'css/theme-gym.css' : 'css/theme-wedding.css';
    document.head.appendChild(link);

    document.body.classList.remove('theme-gym', 'theme-wedding', 'bubbles');
    document.body.classList.add(normalizedTheme === 'gym' ? 'theme-gym' : 'theme-wedding');

    return normalizedTheme;
}

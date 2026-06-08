import { auth, db } from './firebase-config.js';
import { buildAppUrl, buildWallUrl } from './event-loader.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, collection, query, where, getDocs, orderBy, onSnapshot, deleteDoc, increment } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, deleteObject } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// UI Elements
const loadingSection = document.getElementById('loadingSection');
const mainContent = document.getElementById('mainContent');
const createEventSection = document.getElementById('createEventSection');
const dashboardSection = document.getElementById('dashboardSection');
const userEmailSpan = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const createEventForm = document.getElementById('createEventForm');
const cancelCreateEventBtn = document.getElementById('cancelCreateEventBtn');
const emptyDashboardState = document.getElementById('emptyDashboardState');
const emptyCreateEventBtn = document.getElementById('emptyCreateEventBtn');
const eventDashboardContent = document.getElementById('eventDashboardContent');
const createThemeRadios = document.querySelectorAll('input[name="eventTheme"]');

const eventSelector = document.getElementById('eventSelector');
const createNewEventBtn = document.getElementById('createNewEventBtn');


// Dashboard Elements
const displayEventName = document.getElementById('displayEventName');
const editEventNameBtn = document.getElementById('editEventNameBtn');
const eventNameEditor = document.getElementById('eventNameEditor');
const eventNameEditInput = document.getElementById('eventNameEditInput');
const saveEventNameBtn = document.getElementById('saveEventNameBtn');
const cancelEventNameBtn = document.getElementById('cancelEventNameBtn');
const displayEventLink = document.getElementById('displayEventLink');
const displayWallLink = document.getElementById('displayWallLink');
const copyEventLinkBtn = document.getElementById('copyEventLinkBtn');
const copyWallLinkBtn = document.getElementById('copyWallLinkBtn');
const qrCodeImg = document.getElementById('qrCodeImg');
const storageBar = document.getElementById('storageBar');
const storageUsed = document.getElementById('storageUsed');
const storageLimit = document.getElementById('storageLimit');
const photoCount = document.getElementById('photoCount');
const toast = document.getElementById('toast');
const wallDurationInput = document.getElementById('wallDurationInput');
const saveWallDurationBtn = document.getElementById('saveWallDurationBtn');
const wallDurationStatus = document.getElementById('wallDurationStatus');
const mediaLightbox = document.getElementById('mediaLightbox');
const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
const lightboxPrevBtn = document.getElementById('lightboxPrevBtn');
const lightboxNextBtn = document.getElementById('lightboxNextBtn');
const lightboxMediaContainer = document.getElementById('lightboxMediaContainer');
const lightboxMediaLabel = document.getElementById('lightboxMediaLabel');
const lightboxPosition = document.getElementById('lightboxPosition');

let currentUser = null;
let userData = null;
let userEvents = []; // Array of {id, ...data}
let currentEvent = null;
let toastTimeout = null;
let lightboxIndex = -1;
let lightboxOpen = false;
let lightboxMediaNode = null;
let lightboxCurrentMediaId = null;

const WALL_DURATION_DEFAULT_SEC = 6;
const WALL_DURATION_MIN_SEC = 3;
const WALL_DURATION_MAX_SEC = 15;
const MEDIA_PROVIDER_DEFAULT = 'r2';
const MEDIA_PROVIDER_OPTIONS = ['firebase', 'r2'];

// Auth Guard & Init
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        userEmailSpan.textContent = user.email.split('@')[0];
        await loadUserData(user.uid);
    } else {
        window.location.href = 'index.html';
    }
});

// Load User Data & Events
async function loadUserData(uid) {
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            userData = userSnap.data();
            await loadUserEvents(uid); // Fetch ALL events
        } else {
            console.error("User document not found!");
            // Handle error
        }
    } catch (error) {
        console.error("Error loading user data:", error);
    } finally {
        loadingSection.classList.add('hidden');
        mainContent.classList.remove('hidden');
    }
}

async function loadUserEvents(uid) {
    // Query all events owned by user
    const q = query(collection(db, "events"), where("owner_uid", "==", uid));
    const querySnapshot = await getDocs(q);

    userEvents = [];
    querySnapshot.forEach((doc) => {
        userEvents.push({ id: doc.id, ...doc.data() });
    });

    renderDashboardState();
}

// Render Logic
function renderDashboardState() {
    // 1. Setup Event Selector logic
    setupEventSelector();

    // 2. Decide View
    if (userEvents.length === 0) {
        // No events -> Show Create
        showCreateView();
    } else {
        // Has events -> Show Dashboard with first event (or previously active)
        // Prefer userData.event_active_id if exists and valid, else first one
        const activeId = userData.event_active_id;
        const eventToLoad = userEvents.find(e => e.id === activeId) || userEvents[0];

        showDashboardView(eventToLoad);
    }
}

function setupEventSelector() {
    eventSelector.innerHTML = '';

    if (userEvents.length > 1) {
        eventSelector.classList.remove('hidden');

        userEvents.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = event.name;
            eventSelector.appendChild(option);
        });

        // Add listener
        eventSelector.onchange = (e) => {
            const selectedId = e.target.value;
            const event = userEvents.find(ev => ev.id === selectedId);
            if (event) showDashboardView(event);
        };

    } else {
        eventSelector.classList.add('hidden');
    }

    // "New Event" Button Logic (Limit 2)
    if (userEvents.length < 2) {
        createNewEventBtn.classList.remove('hidden');
        createNewEventBtn.onclick = () => showCreateView();
    } else {
        createNewEventBtn.classList.add('hidden');
    }
}

function showCreateView() {
    dashboardSection.classList.add('hidden');
    createEventSection.classList.remove('hidden');

    // Clear form
    createEventForm.reset();

    const selectedTheme = document.querySelector('input[name="eventTheme"]:checked')?.value || 'wedding';
    applyCreateThemePreview(selectedTheme);
}

async function showDashboardView(event) {
    if (!event) {
        showEmptyDashboardView();
        return;
    }

    currentEvent = event;
    closeInlineNameEditor();
    createEventSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    if (emptyDashboardState) emptyDashboardState.classList.add('hidden');
    if (eventDashboardContent) eventDashboardContent.classList.remove('hidden');

    // Sync Selector if visible
    eventSelector.value = event.id;

    // Save active event preference
    if (userData.event_active_id !== event.id) {
        updateDoc(doc(db, "users", currentUser.uid), { event_active_id: event.id });
        userData.event_active_id = event.id;
    }

    // Populate Info
    displayEventName.textContent = event.name;

    const eventUrl = buildAppUrl(event.slug);
    displayEventLink.href = eventUrl;
    displayEventLink.textContent = eventUrl;

    const wallUrl = buildWallUrl(event.slug);
    if (displayWallLink) {
        displayWallLink.href = wallUrl;
        displayWallLink.textContent = wallUrl;
    }

    // QR Code
    qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(eventUrl)}`;

    // Update Storage UI
    updateStorageUI(userData.storage_used, userData.plan_storage_limit);

    // Wall timing config
    syncWallDurationUI(event.wall_photo_duration_sec);

    // Media provider is fixed to R2 in production UX
    syncMediaProviderUI('r2');

    // Load Photos
    loadEventPhotos(event.id);
}

function showEmptyDashboardView() {
    currentEvent = null;
    createEventSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    closeInlineNameEditor();
    clearCreateThemePreview();

    if (eventDashboardContent) eventDashboardContent.classList.add('hidden');
    if (emptyDashboardState) emptyDashboardState.classList.remove('hidden');
    if (photoCount) photoCount.textContent = '0';
}


// Gallery Logic
// Imports moved to top

// Dynamic Import for JSZip
import JSZip from 'https://cdn.skypack.dev/jszip';

const storage = getStorage();
const galleryGrid = document.getElementById('galleryGrid');
const emptyGalleryMsg = document.getElementById('emptyGalleryMsg');
const downloadAllBtn = document.getElementById('downloadAllBtn');
let allPhotosCache = []; // Store media for download (photos + videos)
let galleryUnsubscribe = null; // Store listener to unsubscribe when switching events

function loadEventPhotos(eventId) {
    // Unsubscribe previous listener if exists
    if (galleryUnsubscribe) {
        galleryUnsubscribe();
    }

    const q = query(
        collection(db, "events", eventId, "photos"),
        orderBy("createdAt", "desc")
    );

    galleryUnsubscribe = onSnapshot(q, (snapshot) => {
        allPhotosCache = []; // Reset cache

        if (snapshot.empty) {
            syncLightboxWithGallery();
            emptyGalleryMsg.style.display = 'block';
            downloadAllBtn.disabled = true; // Disable download if empty
            if (photoCount) photoCount.textContent = '0';
            // Remove all photo cards but keep the msg
            Array.from(galleryGrid.children).forEach(child => {
                if (child.id !== 'emptyGalleryMsg') child.remove();
            });
            return;
        }

        emptyGalleryMsg.style.display = 'none';
        downloadAllBtn.disabled = false;
        if (photoCount) photoCount.textContent = `${snapshot.size}`;

        // Clear and rebuild
        Array.from(galleryGrid.children).forEach(child => {
            if (child.id !== 'emptyGalleryMsg') child.remove();
        });

        snapshot.forEach((docSnap) => {
            const photo = docSnap.data();
            photo.id = docSnap.id;
            allPhotosCache.push(photo);

            const card = createPhotoCard(docSnap.id, photo, eventId);
            galleryGrid.appendChild(card);
        });

        syncLightboxWithGallery();
    });
}

// EDIT NAME LOGIC
editEventNameBtn.addEventListener('click', () => {
    if (!currentEvent) return;
    eventNameEditInput.value = currentEvent.name || '';
    eventNameEditor.classList.remove('hidden');
    eventNameEditInput.focus();
    eventNameEditInput.select();
});

saveEventNameBtn?.addEventListener('click', async () => {
    if (!currentEvent) return;
    const newName = eventNameEditInput.value.trim();
    if (!newName || newName === currentEvent.name) {
        closeInlineNameEditor();
        return;
    }

    try {
        await updateDoc(doc(db, "events", currentEvent.id), { name: newName });

        currentEvent.name = newName;
        displayEventName.textContent = currentEvent.name;

        const option = eventSelector.querySelector(`option[value="${currentEvent.id}"]`);
        if (option) option.textContent = currentEvent.name;

        const evIndex = userEvents.findIndex(e => e.id === currentEvent.id);
        if (evIndex !== -1) userEvents[evIndex].name = currentEvent.name;

        closeInlineNameEditor();
        showToast('Nombre del evento actualizado');
    } catch (error) {
        console.error("Error updating name:", error);
        showToast('No se pudo actualizar el nombre', true);
    }
});

cancelEventNameBtn?.addEventListener('click', closeInlineNameEditor);

eventNameEditInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        saveEventNameBtn?.click();
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        closeInlineNameEditor();
    }
});

copyEventLinkBtn?.addEventListener('click', () => copyToClipboard(displayEventLink?.href, 'Enlace del evento copiado'));
copyWallLinkBtn?.addEventListener('click', () => copyToClipboard(displayWallLink?.href, 'Enlace del muro copiado'));


// DOWNLOAD ZIP LOGIC
downloadAllBtn.addEventListener('click', async () => {
    if (allPhotosCache.length === 0) return;

    const originalText = downloadAllBtn.textContent;
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = "Preparando...";

    try {
        const zip = new JSZip();
        const folder = zip.folder("EventSnap_Medios");
        let count = 0;

        for (const photo of allPhotosCache) {
            count++;
            downloadAllBtn.textContent = `Descargando ${count} de ${allPhotosCache.length}...`;

            // Fetch media blob
            const mediaUrl = resolveMediaUrl(photo);
            const response = await fetch(mediaUrl);
            if (!response.ok) throw new Error(`Falló descarga de ${mediaUrl}`);

            const blob = await response.blob();

            // Generate filename
            const dateStr = new Date(photo.createdAt ? photo.createdAt.toDate() : Date.now()).toISOString().substring(0, 10);
            const cleanUploader = (photo.uploader || "Anonimo").replace(/[^a-z0-9]/gi, '_');
            const mediaType = photo.type || 'image';
            const extension = inferMediaExtension(photo, blob, mediaType);
            const suffix = mediaType === 'video' ? 'video' : 'foto';
            const filename = `${cleanUploader}_${dateStr}_${suffix}_${photo.id.substring(0, 5)}.${extension}`;

            folder.file(filename, blob);
        }

        downloadAllBtn.textContent = "Comprimiendo ZIP...";
        const content = await zip.generateAsync({ type: "blob" });

        // Trigger Download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `EventSnap_Medios_${new Date().toISOString().slice(0, 10)}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);

    } catch (error) {
        console.error("Error downloading zip:", error);
        alert("Error al generar el ZIP: " + error.message);
    } finally {
        downloadAllBtn.disabled = false;
        downloadAllBtn.textContent = originalText;
    }
});

function createPhotoCard(photoId, photo, eventId) {
    const div = document.createElement('div');
    div.className = 'photo-card';
    const uploader = photo.uploader || 'Anónimo';
    const mediaType = photo.type || 'image';
    const hasAudio = mediaType === 'video' ? Boolean(photo.hasAudio) : null;
    const mediaLabel = mediaType === 'video'
        ? (hasAudio ? 'Vídeo · con audio' : 'Vídeo · sin audio')
        : 'Foto';
    const mediaUrl = resolveMediaUrl(photo);
    const mediaMarkup = mediaType === 'video'
        ? `<video src="${mediaUrl}" controls preload="metadata" playsinline></video>`
        : `<img src="${mediaUrl}" loading="lazy" alt="Foto de ${uploader}">`;

    div.innerHTML = `
        ${mediaMarkup}
        <span class="media-badge">${mediaLabel}</span>
        <div class="photo-info">
            <span>${uploader}</span>
            <button class="delete-btn" title="Eliminar archivo">🗑️</button>
        </div>
    `;

    const deleteBtn = div.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        deletePhoto(photoId, photo, eventId);
    });

    div.addEventListener('click', () => {
        openLightboxByMediaId(photoId);
    });

    return div;
}

async function deletePhoto(photoId, photo, eventId) {
    if (!confirm("¿Seguro que quieres borrar este archivo?")) return;

    try {
        const mediaProvider = String(photo.mediaProvider || 'firebase').toLowerCase();
        if (mediaProvider === 'firebase') {
            let storageRef;
            if (photo.path) {
                storageRef = ref(storage, photo.path);
            } else {
                storageRef = ref(storage, resolveMediaUrl(photo));
            }

            try {
                await deleteObject(storageRef);
            } catch (storageError) {
                if (storageError.code === 'storage/object-not-found') {
                    console.warn("La foto no existía en Storage.");
                } else {
                    throw storageError;
                }
            }
        }

        await deleteDoc(doc(db, "events", eventId, "photos", photoId));

        const sizeMB = photo.sizeMB || 0;
        if (sizeMB > 0) {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, {
                storage_used: increment(-sizeMB)
            });

            if (userData) {
                userData.storage_used = Math.max(0, userData.storage_used - sizeMB);
                updateStorageUI(userData.storage_used, userData.plan_storage_limit);
            }
        }

    } catch (error) {
        console.error("Error removing photo:", error);
        showToast('Error al borrar la foto', true);
    }
}

function normalizeWallDurationSec(rawValue) {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) return WALL_DURATION_DEFAULT_SEC;
    return Math.min(WALL_DURATION_MAX_SEC, Math.max(WALL_DURATION_MIN_SEC, parsed));
}

function normalizeMediaProvider(rawValue) {
    const normalized = String(rawValue || '').trim().toLowerCase();
    return MEDIA_PROVIDER_OPTIONS.includes(normalized)
        ? normalized
        : MEDIA_PROVIDER_DEFAULT;
}

function syncMediaProviderUI(rawValue) {
    const provider = normalizeMediaProvider(rawValue);

    if (currentEvent) {
        currentEvent.media_provider = provider;
        const currentIndex = userEvents.findIndex((event) => event.id === currentEvent.id);
        if (currentIndex !== -1) {
            userEvents[currentIndex].media_provider = provider;
        }
    }
}

function syncWallDurationUI(rawValue) {
    const seconds = normalizeWallDurationSec(rawValue);
    if (wallDurationInput) wallDurationInput.value = String(seconds);
    if (wallDurationStatus) wallDurationStatus.textContent = `Actual: ${seconds}s`;

    if (currentEvent) {
        currentEvent.wall_photo_duration_sec = seconds;
        const currentIndex = userEvents.findIndex((event) => event.id === currentEvent.id);
        if (currentIndex !== -1) {
            userEvents[currentIndex].wall_photo_duration_sec = seconds;
        }
    }
}

saveWallDurationBtn?.addEventListener('click', async () => {
    if (!currentEvent) return;

    const sanitized = normalizeWallDurationSec(wallDurationInput?.value);
    if (wallDurationInput) wallDurationInput.value = String(sanitized);

    saveWallDurationBtn.disabled = true;
    const originalText = saveWallDurationBtn.textContent;
    saveWallDurationBtn.textContent = 'Guardando...';

    try {
        await updateDoc(doc(db, 'events', currentEvent.id), {
            wall_photo_duration_sec: sanitized
        });

        syncWallDurationUI(sanitized);
        showToast(`Duración del wall guardada: ${sanitized}s`);
    } catch (error) {
        console.error('Error updating wall duration:', error);
        showToast('No se pudo guardar la duración del wall', true);
    } finally {
        saveWallDurationBtn.disabled = false;
        saveWallDurationBtn.textContent = originalText;
    }
});

wallDurationInput?.addEventListener('blur', () => {
    wallDurationInput.value = String(normalizeWallDurationSec(wallDurationInput.value));
});

function inferMediaExtension(photo, blob, mediaType) {
    const pathExt = (photo.path || '').split('.').pop()?.toLowerCase();
    if (pathExt && /^[a-z0-9]+$/.test(pathExt)) return pathExt;

    const mimeType = (photo.mimeType || blob.type || '').toLowerCase();
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('quicktime')) return 'mov';
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';

    return mediaType === 'video' ? 'webm' : 'jpg';
}

function openLightboxByMediaId(mediaId) {
    const index = allPhotosCache.findIndex((item) => item.id === mediaId);
    if (index === -1) return;
    openLightbox(index);
}

function openLightbox(index) {
    if (!mediaLightbox || !lightboxMediaContainer || allPhotosCache.length === 0) return;

    lightboxIndex = normalizeLightboxIndex(index);
    lightboxOpen = true;
    mediaLightbox.classList.remove('hidden');
    mediaLightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderLightboxItem();
}

function closeLightbox() {
    if (!mediaLightbox || !lightboxOpen) return;

    lightboxOpen = false;
    lightboxIndex = -1;
    lightboxCurrentMediaId = null;
    clearLightboxMedia();
    mediaLightbox.classList.add('hidden');
    mediaLightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function renderLightboxItem() {
    if (!lightboxOpen || !lightboxMediaContainer || allPhotosCache.length === 0) {
        closeLightbox();
        return;
    }

    lightboxIndex = normalizeLightboxIndex(lightboxIndex);
    const media = allPhotosCache[lightboxIndex];
    if (!media) {
        closeLightbox();
        return;
    }

    clearLightboxMedia();
    lightboxCurrentMediaId = media.id;

    const mediaType = media.type || 'image';
    const uploader = media.uploader || 'Anónimo';

    if (mediaType === 'video') {
        const video = document.createElement('video');
        video.src = resolveMediaUrl(media);
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.autoplay = true;
        lightboxMediaNode = video;
    } else {
        const img = document.createElement('img');
        img.src = resolveMediaUrl(media);
        img.alt = `Media de ${uploader}`;
        lightboxMediaNode = img;
    }

    lightboxMediaContainer.replaceChildren(lightboxMediaNode);

    const hasAudio = mediaType === 'video' ? Boolean(media.hasAudio) : null;
    const mediaLabel = mediaType === 'video'
        ? (hasAudio ? 'Vídeo con audio' : 'Vídeo sin audio')
        : 'Foto';

    if (lightboxMediaLabel) {
        lightboxMediaLabel.textContent = `${mediaLabel} · ${uploader}`;
    }

    if (lightboxPosition) {
        lightboxPosition.textContent = `${lightboxIndex + 1} / ${allPhotosCache.length}`;
    }
}

function resolveMediaUrl(media) {
    return media?.mediaUrl || media?.url || '';
}

function goLightboxPrev() {
    if (!lightboxOpen || allPhotosCache.length === 0) return;
    lightboxIndex = normalizeLightboxIndex(lightboxIndex - 1);
    renderLightboxItem();
}

function goLightboxNext() {
    if (!lightboxOpen || allPhotosCache.length === 0) return;
    lightboxIndex = normalizeLightboxIndex(lightboxIndex + 1);
    renderLightboxItem();
}

function normalizeLightboxIndex(index) {
    if (allPhotosCache.length === 0) return -1;
    return (index + allPhotosCache.length) % allPhotosCache.length;
}

function clearLightboxMedia() {
    if (lightboxMediaNode?.tagName === 'VIDEO') {
        lightboxMediaNode.pause();
        lightboxMediaNode.removeAttribute('src');
        lightboxMediaNode.load();
    }

    if (lightboxMediaContainer) {
        lightboxMediaContainer.innerHTML = '';
    }

    lightboxMediaNode = null;
}

function syncLightboxWithGallery() {
    if (!lightboxOpen) return;

    if (allPhotosCache.length === 0) {
        closeLightbox();
        return;
    }

    const idx = allPhotosCache.findIndex((item) => item.id === lightboxCurrentMediaId);
    if (idx !== -1) {
        lightboxIndex = idx;
    } else if (lightboxIndex >= allPhotosCache.length) {
        lightboxIndex = allPhotosCache.length - 1;
    }

    renderLightboxItem();
}

lightboxCloseBtn?.addEventListener('click', closeLightbox);
lightboxPrevBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    goLightboxPrev();
});
lightboxNextBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    goLightboxNext();
});

mediaLightbox?.addEventListener('click', (event) => {
    if (event.target === mediaLightbox) {
        closeLightbox();
    }
});

document.addEventListener('keydown', (event) => {
    if (!lightboxOpen) return;

    if (event.key === 'Escape') {
        event.preventDefault();
        closeLightbox();
        return;
    }

    if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goLightboxPrev();
        return;
    }

    if (event.key === 'ArrowRight') {
        event.preventDefault();
        goLightboxNext();
    }
});

function updateStorageUI(usedMB, limitMB) {
    storageUsed.textContent = usedMB.toFixed(2);
    storageLimit.textContent = limitMB;
    const percentage = Math.min((usedMB / limitMB) * 100, 100);
    storageBar.style.width = `${percentage}%`;
    if (percentage > 90) {
        storageBar.style.background = '#ef4444';
    } else {
        storageBar.style.background = '#3b82f6';
    }
}


// Create Event Logic
createEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('eventName').value.trim();
    // Improved slug: NFD normalize to split accents/ñ, remove diacritics, then keep only az09
    const rawSlug = document.getElementById('eventSlug').value.trim().toLowerCase();
    const slug = rawSlug
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/ñ/g, "n") // Explicit ñ check just in case NFD doesn't catch it on some browsers? NFD usually separates n and ~, but explicit replace is safer for 'ñ' sometimes if not separated. actually NFD splits ñ into n + ~, so the regex removes ~. Perfect.
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    const theme = document.querySelector('input[name="eventTheme"]:checked').value;

    if (!name || !slug) {
        alert("Por favor rellena el nombre y un identificador válido (letras, números y guiones).");
        return;
    }

    // Disable button to prevent double submit
    const submitBtn = createEventForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Verificando...";

    try {
        // 0. Check Uniqueness
        const qCheck = query(collection(db, "events"), where("slug", "==", slug));
        const checkSnap = await getDocs(qCheck);

        if (!checkSnap.empty) {
            alert(`El identificador "${slug}" ya está en uso. Por favor elige otro.`);
            submitBtn.disabled = false;
            submitBtn.textContent = "Crear Evento ✨";
            return;
        }

        submitBtn.textContent = "Creando...";
        const newEventRef = doc(collection(db, "events"));
        const newEventId = newEventRef.id;

        await setDoc(newEventRef, {
            name: name,
            slug: slug,
            theme: theme,
            owner_uid: currentUser.uid,
            media_provider: 'r2',
            wall_photo_duration_sec: WALL_DURATION_DEFAULT_SEC,
            created_at: serverTimestamp()
        });

        // Add to local array
        userEvents.push({
            id: newEventId,
            name: name,
            slug: slug,
            theme: theme,
            owner_uid: currentUser.uid,
            media_provider: 'r2',
            wall_photo_duration_sec: WALL_DURATION_DEFAULT_SEC
        });

        // Update User Preference
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
            event_active_id: newEventId
        });
        userData.event_active_id = newEventId;

        // Force render dashboard without reload
        const newEvent = userEvents.find(e => e.id === newEventId);
        clearCreateThemePreview();
        showDashboardView(newEvent);

        // Re-setup selector to include new event
        setupEventSelector();

    } catch (error) {
        console.error("Error creating event:", error);
        alert("Error al crear el evento: " + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Crear Evento ✨";
    }
});

// Logout Helper

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Error signing out:', error);
    });
});

cancelCreateEventBtn?.addEventListener('click', () => {
    clearCreateThemePreview();

    if (userEvents.length > 0) {
        const activeId = userData?.event_active_id;
        const eventToLoad = userEvents.find(e => e.id === activeId) || userEvents[0];
        showDashboardView(eventToLoad);
        return;
    }

    showEmptyDashboardView();
});

emptyCreateEventBtn?.addEventListener('click', () => {
    showCreateView();
});

createThemeRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
        if (!createEventSection.classList.contains('hidden')) {
            applyCreateThemePreview(radio.value);
        }
    });
});

function applyCreateThemePreview(theme) {
    document.body.classList.remove('create-preview-wedding', 'create-preview-gym');

    const normalized = theme === 'gym' ? 'gym' : 'wedding';
    document.body.classList.add(normalized === 'gym' ? 'create-preview-gym' : 'create-preview-wedding');
}

function clearCreateThemePreview() {
    document.body.classList.remove('create-preview-wedding', 'create-preview-gym');
}

function closeInlineNameEditor() {
    if (!eventNameEditor) return;
    eventNameEditor.classList.add('hidden');
}

async function copyToClipboard(value, successMsg) {
    if (!value) {
        showToast('No hay enlace disponible', true);
        return;
    }
    try {
        await navigator.clipboard.writeText(value);
        showToast(successMsg);
    } catch (error) {
        console.error('Clipboard error:', error);
        showToast('No se pudo copiar el enlace', true);
    }
}

function showToast(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden', 'error');
    if (isError) toast.classList.add('error');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 2600);
}

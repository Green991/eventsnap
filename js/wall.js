import { db } from './firebase-config.js';
import { resolveEventFromLocation, injectThemeStyles, buildAppUrl } from './event-loader.js';
import { collection, query, onSnapshot, orderBy, doc, limitToLast } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// UI Elements
const wallContainer = document.getElementById('wallContainer');
const photoFrame = document.getElementById('photoFrame');
const img1 = document.getElementById('wallImage1');
const img2 = document.getElementById('wallImage2');
const wallVideo = document.getElementById('wallVideo');
const uploaderName = document.getElementById('uploaderName');
const loadingMsg = document.getElementById('loadingMsg');
const qrCode = document.getElementById('qrCode');
const togglePlaybackBtn = document.getElementById('togglePlaybackBtn');
const nextPhotoBtn = document.getElementById('nextPhotoBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const wallStatus = document.getElementById('wallStatus');

// State
let photos = [];
let currentPhotoIndex = 0;
let rotationInterval = null;
let isBreakingNews = false;
let activeImage = 2; // 1 or 2
let isPaused = false;
let breakingQueue = [];
let breakingResumeTimeout = null;
let wallDurationSec = 6;
let wallEventUnsubscribe = null;
let activeMediaKind = 'image'; // 'image' | 'video'

const WALL_DURATION_DEFAULT_SEC = 6;
const WALL_DURATION_MIN_SEC = 3;
const WALL_DURATION_MAX_SEC = 15;
const WALL_HISTORY_LIMIT = 250;

// Init
async function init() {
    const resolved = await resolveEventFromLocation();

    if (!resolved?.slug) {
        loadingMsg.textContent = "Error: Falta el slug del evento.";
        return;
    }

    try {
        if (!resolved.eventId || !resolved.eventData) {
            loadingMsg.textContent = `Evento no encontrado: ${resolved.slug}`;
            return;
        }

        const eventId = resolved.eventId;
        const eventData = resolved.eventData;

        wallDurationSec = normalizeWallDurationSec(eventData?.wall_photo_duration_sec);

        // Apply Theme
        applyTheme(eventData);

        // Generate QR
        const eventUrl = buildAppUrl(resolved.slug);
        qrCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(eventUrl)}`;

        // Start Listening
        startListening(eventId);
        subscribeWallSettings(eventId);

    } catch (error) {
        console.error(error);
        loadingMsg.textContent = "Error de conexión.";
    }
}

function applyTheme(eventData) {
    injectThemeStyles(eventData.theme || 'wedding');
}

function startListening(eventId) {
    loadingMsg.classList.add('hidden');
    setWallStatus('Conectado. Esperando fotos...');

    // Listen to PHOTOS subcollection, ordered by time
    const q = query(
        collection(db, "events", eventId, "photos"),
        orderBy("createdAt", "asc"),
        limitToLast(WALL_HISTORY_LIMIT)
    );

    onSnapshot(q, (snapshot) => {
        let hasNewPhotos = false;

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const photo = { id: change.doc.id, ...change.doc.data() };
                const mediaType = photo.type || 'image';
                if (!['image', 'video'].includes(mediaType)) {
                    return;
                }
                const now = Date.now();
                const photoTime = photo.createdAt ? photo.createdAt.toMillis() : now;
                const isRecent = (now - photoTime) < 30 * 1000;

                // Add to array if not exists (dup check just in case)
                if (!photos.find(p => p.id === photo.id)) {
                    photos.push(photo);
                    hasNewPhotos = true;
                }

                if (isRecent) {
                    enqueueBreakingNews(photo);
                }
            }

            if (change.type === "removed") {
                const removedId = change.doc.id;
                photos = photos.filter((photo) => photo.id !== removedId);

                if (photos.length === 0) {
                    currentPhotoIndex = 0;
                    stopRotation();
                    deactivateWallVideo();
                    photoFrame.classList.add('hidden');
                    setWallStatus('Esperando la primera foto...');
                } else {
                    currentPhotoIndex = currentPhotoIndex % photos.length;
                }
            }
        });

        if (photos.length > 0 && !rotationInterval && !isBreakingNews && !isPaused) {
            // Start rotation if not running
            startRotation();
            setWallStatus(`Mostrando ${photos.length} medios · ${wallDurationSec}s`);
        }

        if (photos.length === 0) {
            loadingMsg.textContent = "Esperando la primera foto... 📸";
            loadingMsg.classList.remove('hidden');
            setWallStatus('Esperando la primera foto...');
        } else {
            loadingMsg.classList.add('hidden');
            if (!hasNewPhotos) {
                setWallStatus(isPaused
                    ? `Pausado · ${photos.length} medios · ${wallDurationSec}s`
                    : `Mostrando ${photos.length} medios · ${wallDurationSec}s`);
            }
        }
    });
}

function normalizeWallDurationSec(rawValue) {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) return WALL_DURATION_DEFAULT_SEC;
    return Math.min(WALL_DURATION_MAX_SEC, Math.max(WALL_DURATION_MIN_SEC, parsed));
}

function subscribeWallSettings(eventId) {
    if (wallEventUnsubscribe) {
        wallEventUnsubscribe();
    }

    const eventRef = doc(db, 'events', eventId);
    wallEventUnsubscribe = onSnapshot(eventRef, (eventSnap) => {
        if (!eventSnap.exists()) return;

        const eventData = eventSnap.data();
        const nextDuration = normalizeWallDurationSec(eventData?.wall_photo_duration_sec);
        const changed = nextDuration !== wallDurationSec;
        wallDurationSec = nextDuration;

        if (changed && rotationInterval && !isPaused && !isBreakingNews) {
            startRotation();
            setWallStatus(`Mostrando ${photos.length} medios · ${wallDurationSec}s`);
        }
    });
}

function enqueueBreakingNews(photo) {
    if (!breakingQueue.find((item) => item.id === photo.id)) {
        breakingQueue.push(photo);
    }
    processBreakingQueue();
}

function processBreakingQueue() {
    if (isPaused || isBreakingNews || breakingQueue.length === 0) return;
    const nextPhoto = breakingQueue.shift();
    showBreakingNews(nextPhoto);
}

function showBreakingNews(photo) {
    // Stop rotation
    stopRotation();
    isBreakingNews = true;
    setWallStatus('Nueva foto destacada ✨');

    // Show photo with 'breaking' style
    renderPhoto(photo, true);

    // Resume rotation after 10 seconds
    if (breakingResumeTimeout) clearTimeout(breakingResumeTimeout);
    breakingResumeTimeout = setTimeout(() => {
        isBreakingNews = false;
        if (!isPaused) startRotation();
        processBreakingQueue();
    }, 10000);
}

function startRotation() {
    stopRotation();
    if (photos.length === 0) return;

    // Render current immediately if not visible
    if (photoFrame.classList.contains('hidden')) {
        renderPhoto(photos[currentPhotoIndex], false);
    }

    rotationInterval = setInterval(() => {
        if (isBreakingNews || isPaused) return;

        // Pre-calculate next index
        const nextIndex = (currentPhotoIndex + 1) % photos.length;

        // Preload next image logic handled inside renderPhoto's preloader check? 
        // Or better: Just call render which will handle loading.

        renderPhoto(photos[nextIndex], false);
        currentPhotoIndex = nextIndex;
        setWallStatus(`Mostrando ${photos.length} medios · ${wallDurationSec}s`);

    }, wallDurationSec * 1000);
}

function stopRotation() {
    if (rotationInterval) clearInterval(rotationInterval);
    rotationInterval = null;
}

function renderPhoto(photo, animate) {
    const mediaUrl = resolveMediaUrl(photo);
    if (!mediaUrl) {
        console.warn('Photo without URL. Skipping.', photo?.id);
        return;
    }

    const mediaType = photo?.type || 'image';
    if (mediaType === 'video') {
        renderVideo(photo, mediaUrl, animate);
        return;
    }

    renderImage(photo, mediaUrl, animate);
}

function renderImage(photo, mediaUrl, animate) {
    deactivateWallVideo();

    // Preload image object
    const imgObj = new Image();
    imgObj.src = mediaUrl;

    imgObj.onload = () => {
        // Decide which element to swap
        const nextImg = activeImage === 1 ? img2 : img1;
        const currentImg = activeImage === 1 ? img1 : img2;

        // Prepare next image (hidden)
        nextImg.src = mediaUrl;

        // Update text logic (could be cross-faded too but instant swap is usually fine for text)
        uploaderName.textContent = photo.uploader || "Anónimo";

        // Show Frame if hidden
        photoFrame.classList.remove('hidden');

        if (animate) {
            photoFrame.classList.remove('active'); // Reset scale
            void photoFrame.offsetWidth; // Trigger reflow
            photoFrame.classList.add('active');
            photoFrame.classList.add('breaking');
        } else {
            photoFrame.classList.remove('breaking');
            photoFrame.classList.add('active');
        }

        // Cross-fade
        nextImg.classList.add('active');
        currentImg.classList.remove('active');

        // Swap active tracker
        activeImage = activeImage === 1 ? 2 : 1;
    };

    imgObj.onerror = () => {
        console.error("Error loading image", mediaUrl);
        // Skip to next if broken?
    };
}

function renderVideo(photo, mediaUrl, animate) {
    if (!wallVideo) return;

    const nextImg = activeImage === 1 ? img2 : img1;
    const currentImg = activeImage === 1 ? img1 : img2;

    nextImg.classList.remove('active');
    currentImg.classList.remove('active');
    nextImg.removeAttribute('src');
    currentImg.removeAttribute('src');

    wallVideo.classList.remove('hidden');
    wallVideo.classList.add('active');
    wallVideo.muted = true;
    wallVideo.loop = true;
    wallVideo.playsInline = true;

    if (wallVideo.src !== mediaUrl) {
        wallVideo.pause();
        wallVideo.src = mediaUrl;
        wallVideo.load();
    }

    wallVideo.currentTime = 0;
    wallVideo.play().catch((error) => {
        console.warn('Video autoplay blocked on wall.', error);
    });

    activeMediaKind = 'video';
    uploaderName.textContent = photo.uploader || 'Anónimo';
    photoFrame.classList.remove('hidden');

    if (animate) {
        photoFrame.classList.remove('active');
        void photoFrame.offsetWidth;
        photoFrame.classList.add('active');
        photoFrame.classList.add('breaking');
    } else {
        photoFrame.classList.remove('breaking');
        photoFrame.classList.add('active');
    }
}

function deactivateWallVideo() {
    if (!wallVideo || activeMediaKind !== 'video') return;

    wallVideo.pause();
    wallVideo.classList.remove('active');
    wallVideo.classList.add('hidden');
    wallVideo.removeAttribute('src');
    wallVideo.load();
    activeMediaKind = 'image';
}

function resolveMediaUrl(photo) {
    return photo?.mediaUrl || photo?.url || '';
}

function setWallStatus(message) {
    if (!wallStatus) return;
    wallStatus.textContent = message;
}

function showNextPhotoManually() {
    if (photos.length === 0) return;
    const nextIndex = (currentPhotoIndex + 1) % photos.length;
    renderPhoto(photos[nextIndex], false);
    currentPhotoIndex = nextIndex;
    setWallStatus(`Media ${currentPhotoIndex + 1} de ${photos.length}`);
}

function setPaused(paused) {
    isPaused = paused;

    if (isPaused) {
        stopRotation();
        if (togglePlaybackBtn) togglePlaybackBtn.textContent = '▶️ Reanudar';
        setWallStatus(`Pausado · ${photos.length} medios · ${wallDurationSec}s`);
        return;
    }

    if (togglePlaybackBtn) togglePlaybackBtn.textContent = '⏸️ Pausar';
    processBreakingQueue();
    startRotation();
    setWallStatus(`Mostrando ${photos.length} medios · ${wallDurationSec}s`);
}

togglePlaybackBtn?.addEventListener('click', () => setPaused(!isPaused));
nextPhotoBtn?.addEventListener('click', showNextPhotoManually);

fullscreenBtn?.addEventListener('click', async () => {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
            fullscreenBtn.textContent = '🪟 Salir';
            return;
        }

        await document.exitFullscreen();
        fullscreenBtn.textContent = '🖥️ Fullscreen';
    } catch (error) {
        console.error('Fullscreen error', error);
        setWallStatus('No se pudo cambiar fullscreen');
    }
});

document.addEventListener('fullscreenchange', () => {
    if (!fullscreenBtn) return;
    fullscreenBtn.textContent = document.fullscreenElement ? '🪟 Salir' : '🖥️ Fullscreen';
});

// Cursor Hiding logic
let cursorTimeout;
document.addEventListener('mousemove', () => {
    document.body.classList.add('show-cursor');
    clearTimeout(cursorTimeout);
    cursorTimeout = setTimeout(() => {
        document.body.classList.remove('show-cursor');
    }, 3000);
});

init();

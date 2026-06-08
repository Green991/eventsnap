import { db } from './firebase-config.js';
import { resolveEventFromLocation, injectThemeStyles } from './event-loader.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { doc, getDoc, updateDoc, increment, serverTimestamp, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Init Storage
const storage = getStorage();

// UI Elements
const loadingBlock = document.getElementById('loadingBlock');
const invalidBlock = document.getElementById('invalidBlock');
const validBlock = document.getElementById('validBlock');
const invalidMsg = document.getElementById('invalidMsg');

// Dynamic Text Elements
const couplePill = document.getElementById('couplePill');
const coupleName = document.getElementById('coupleName');
const footerCouple = document.getElementById('footerCouple');
const mainTitle = document.getElementById('mainTitle');
const subtitle = document.getElementById('subtitle');

// Camera Elements
const takeBtn = document.getElementById('takeBtn');
const videoBtn = document.getElementById('videoBtn');
const startRecordBtn = document.getElementById('startRecordBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const cameraInput = document.getElementById('cameraInput');
const previewWrap = document.getElementById('previewWrap');
const preview = document.getElementById('preview');
const previewVideo = document.getElementById('previewVideo');
const sendBtn = document.getElementById('sendBtn');
const retakeBtn = document.getElementById('retakeBtn');
const postCaptureActions = document.getElementById('postCaptureActions');
const uploaderNameInput = document.getElementById('uploaderName');
const statusDiv = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// State
let currentEventId = null;
let currentEventData = null;
let selectedMedia = null;
let previewUrl = null;
let mediaRecorder = null;
let recorderStream = null;
let recorderChunks = [];
let recordingStopTimeout = null;
let isRecording = false;
let currentRecordingHasAudio = false;
let isVideoPreviewReady = false;
let currentFacingMode = 'environment'; // 'environment' | 'user'
let currentMediaProvider = 'firebase';

// Video Constraints (mobile-first)
const MAX_VIDEO_DURATION_SEC = 6;
const MAX_VIDEO_SIZE_MB = 10;
const VIDEO_MAX_WIDTH = 1280;
const VIDEO_MAX_HEIGHT = 720;
const VIDEO_BITRATE = 850_000;
const AUDIO_BITRATE = 96_000;
let takeBtnDefaultHTML = '<span class="icon">📸</span> Hacer foto';
let videoBtnDefaultHTML = '<span class="icon">🎥</span> Abrir cámara vídeo';
let startRecordBtnDefaultHTML = '<span class="icon">🔴</span> Empezar grabación';
let switchCameraBtnDefaultHTML = '<span class="icon">🔄</span> Cambiar a frontal';
const MEDIA_PROVIDER_FIREBASE = 'firebase';
const MEDIA_PROVIDER_R2 = 'r2';
const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const R2_SIGN_UPLOAD_ENDPOINT = window.__EVENTSNAP_R2_SIGN_UPLOAD_ENDPOINT__ || '';

// 1. Event Detection & Theming
async function init() {
    const resolved = await resolveEventFromLocation();

    if (!resolved?.slug) {
        showError("Falta el identificador del evento.");
        return;
    }

    try {
        if (!resolved.eventId || !resolved.eventData) {
            showError(`Evento no encontrado: ${resolved.slug}`);
            return;
        }

        currentEventId = resolved.eventId;
        currentEventData = resolved.eventData;
        currentMediaProvider = normalizeMediaProvider(currentEventData?.media_provider);

        // Apply Theme
        applyTheme(currentEventData);

        // Show UI
        loadingBlock.classList.add('hidden');
        validBlock.classList.remove('hidden');

    } catch (error) {
        console.error("Error loading event:", error);
        showError("Error al cargar el evento.");
    }
}

function applyTheme(eventData) {
    const theme = injectThemeStyles(eventData.theme || 'wedding');
    const name = eventData.name || 'EventSnap';

    // Update Texts
    couplePill.textContent = name;
    coupleName.textContent = name;
    footerCouple.textContent = name;
    document.title = `${name} - EventSnap`;

    if (theme === 'gym') {
        // Custom Gym Texts
        mainTitle.textContent = "MOMENTOS ÉPICOS";
        subtitle.innerHTML = `Captura el <b>ESFUERZO</b>, la <b>GLORIA</b> y la <b>FIESTA</b>.<br>Se guardará en el álbum privado de <b>${name}</b> 💪`;
        takeBtnDefaultHTML = '<span class="icon">📸</span> FOTO RÁPIDA';
        videoBtnDefaultHTML = '<span class="icon">🎥</span> ABRIR CÁMARA VÍDEO';
        startRecordBtnDefaultHTML = '<span class="icon">🔴</span> EMPEZAR GRABACIÓN';
        switchCameraBtnDefaultHTML = '<span class="icon">🔄</span> CAMBIAR A FRONTAL';
    } else {
        document.body.classList.add('bubbles');
        takeBtnDefaultHTML = '<span class="icon">📸</span> Hacer foto';
        videoBtnDefaultHTML = '<span class="icon">🎥</span> Abrir cámara vídeo';
        startRecordBtnDefaultHTML = '<span class="icon">🔴</span> Empezar grabación';
        switchCameraBtnDefaultHTML = '<span class="icon">🔄</span> Cambiar a frontal';
    }

    takeBtn.innerHTML = takeBtnDefaultHTML;
    setVideoActionButtons('idle');
}

function showError(msg) {
    loadingBlock.classList.add('hidden');
    invalidBlock.classList.remove('hidden');
    if (invalidMsg) invalidMsg.textContent = msg;
}

// 2. Camera Logic
takeBtn.addEventListener('click', () => {
    cameraInput.click();
});

videoBtn?.addEventListener('click', async () => {
    if (isRecording) return;
    await openVideoCameraPreview();
});

startRecordBtn?.addEventListener('click', async () => {
    if (isRecording) {
        stopVideoRecording();
        return;
    }
    await startVideoRecording();
});

switchCameraBtn?.addEventListener('click', async () => {
    if (isRecording) {
        statusDiv.innerHTML = '<span style="color:#92400e; font-weight:600;">No puedes cambiar de cámara mientras grabas. Detén la grabación primero.</span>';
        return;
    }

    const nextFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    await openVideoCameraPreview({ facingMode: nextFacingMode, switching: true });
});

cameraInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show loading or processing state if needed
    takeBtn.textContent = "Procesando...";
    takeBtn.disabled = true;
    if (videoBtn) videoBtn.disabled = true;

    try {
        const compressedBlob = await compressImage(file);

        // Create a new File object from the blob to keep properties consistent
        const normalizedName = normalizeFileName(file.name, 'jpg');
        const imageFile = new File([compressedBlob], normalizedName, {
            type: 'image/jpeg',
            lastModified: Date.now()
        });

        selectedMedia = {
            file: imageFile,
            type: 'image',
            durationSec: null,
            mimeType: imageFile.type,
            hasAudio: null
        };

        // Preview
        setImagePreview(compressedBlob);
        previewWrap.classList.remove('hidden');
        sendBtn.classList.remove('hidden');
        postCaptureActions?.classList.remove('hidden');
        statusDiv.textContent = "";

    } catch (error) {
        console.error("Compression failed:", error);
        alert("Error al procesar la imagen. Intenta de nuevo.");
    } finally {
        takeBtn.innerHTML = takeBtnDefaultHTML;
        takeBtn.disabled = false;
        if (!isRecording && videoBtn) videoBtn.disabled = false;
    }
});

async function openVideoCameraPreview(options = {}) {
    if (!isVideoRecordingSupported()) {
        statusDiv.innerHTML = '<span style="color:#ef4444; font-weight:600;">Tu navegador no soporta grabación de vídeo. Usa un móvil con Chrome o Safari actualizado.</span>';
        return;
    }

    const preferredFacingMode = options?.facingMode || currentFacingMode || 'environment';
    const switching = Boolean(options?.switching);

    try {
        if (recorderStream || mediaRecorder) {
            cleanupRecorderState();
        }

        selectedMedia = null;
        sendBtn.classList.add('hidden');
        postCaptureActions?.classList.add('hidden');
        takeBtn.disabled = true;
        setVideoActionButtons('opening');
        statusDiv.textContent = 'Solicitando cámara...';

        const videoConstraints = {
            video: {
                facingMode: { ideal: preferredFacingMode },
                width: { ideal: VIDEO_MAX_WIDTH },
                height: { ideal: VIDEO_MAX_HEIGHT },
                frameRate: { ideal: 24, max: 30 }
            }
        };

        const streamResult = await getRecorderStreamWithAudioFallback(videoConstraints, preferredFacingMode);
        recorderStream = streamResult.stream;
        currentRecordingHasAudio = streamResult.hasAudio;
        currentFacingMode = streamResult.facingMode || preferredFacingMode;
        updateSwitchCameraButtonText();

        if (streamResult.usedFallbackWithoutAudio) {
            statusDiv.innerHTML = '<span style="color:#92400e; font-weight:600;">No se pudo activar el micrófono. Se grabará vídeo sin audio.</span>';
        }

        const mimeType = getSupportedVideoMimeType();
        const recorderOptions = {
            videoBitsPerSecond: VIDEO_BITRATE
        };
        if (currentRecordingHasAudio) {
            recorderOptions.audioBitsPerSecond = AUDIO_BITRATE;
        }
        if (mimeType) recorderOptions.mimeType = mimeType;

        mediaRecorder = new MediaRecorder(recorderStream, recorderOptions);
        recorderChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recorderChunks.push(event.data);
            }
        };

        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            statusDiv.innerHTML = '<span style="color:#ef4444; font-weight:600;">No se pudo grabar el vídeo. Intenta de nuevo.</span>';
            cleanupRecorderState();
            setRecordingUI(false);
        };

        mediaRecorder.onstop = async () => {
            try {
                const recorderMime = mediaRecorder?.mimeType || mimeType || 'video/webm';
                const recordedBlob = new Blob(recorderChunks, { type: recorderMime });

                if (!recordedBlob.size) {
                    throw new Error('Recorded blob is empty.');
                }

                const durationSec = await getVideoDurationSeconds(recordedBlob);
                const safeDuration = Math.min(MAX_VIDEO_DURATION_SEC, Number(durationSec.toFixed(2)));
                const sizeMB = recordedBlob.size / (1024 * 1024);

                if (safeDuration > MAX_VIDEO_DURATION_SEC + 0.2) {
                    throw new Error('Video duration exceeded max limit.');
                }

                if (sizeMB > MAX_VIDEO_SIZE_MB) {
                    statusDiv.innerHTML = `<span style="color:#ef4444; font-weight:600;">El vídeo pesa ${sizeMB.toFixed(1)} MB. Máximo permitido: ${MAX_VIDEO_SIZE_MB} MB. Reintenta con menos movimiento o mejor luz.</span>`;
                    resetUI();
                    return;
                }

                const ext = extensionFromMimeType(recordedBlob.type || 'video/webm', 'webm');
                const fileName = `video_${Date.now()}.${ext}`;
                const videoFile = new File([recordedBlob], fileName, {
                    type: recordedBlob.type || 'video/webm',
                    lastModified: Date.now()
                });

                selectedMedia = {
                    file: videoFile,
                    type: 'video',
                    durationSec: safeDuration,
                    mimeType: videoFile.type,
                    hasAudio: currentRecordingHasAudio
                };

                setVideoPreview(videoFile);
                sendBtn.classList.remove('hidden');
                postCaptureActions?.classList.remove('hidden');
                statusDiv.innerHTML = currentRecordingHasAudio
                    ? `<span style="color:#0f766e; font-weight:600;">Vídeo con audio listo (${safeDuration.toFixed(1)}s). Puedes enviarlo.</span>`
                    : `<span style="color:#0f766e; font-weight:600;">Vídeo sin audio listo (${safeDuration.toFixed(1)}s). Puedes enviarlo.</span>`;
            } catch (error) {
                console.error('Video processing error:', error);
                statusDiv.innerHTML = '<span style="color:#ef4444; font-weight:600;">No se pudo procesar el vídeo. Intenta de nuevo.</span>';
                resetUI();
            } finally {
                cleanupRecorderState();
                setRecordingUI(false);
            }
        };

        // Live preview while recording
        clearPreviewURL();
        preview.classList.add('hidden');
        previewVideo.classList.remove('hidden');
        previewVideo.controls = false;
        previewVideo.muted = true;
        previewVideo.autoplay = true;
        previewVideo.playsInline = true;
        previewVideo.setAttribute('playsinline', 'true');
        previewVideo.setAttribute('webkit-playsinline', 'true');
        previewVideo.srcObject = recorderStream;
        previewWrap.classList.remove('hidden');

        const tryStartLivePreview = () => {
            return previewVideo.play().catch((previewError) => {
                console.warn('Live preview play() failed while recording:', previewError);
                statusDiv.innerHTML = '<span style="color:#92400e; font-weight:600;">Se está grabando, pero tu móvil bloqueó la vista previa en directo.</span>';
            });
        };

        if (previewVideo.readyState >= 1) {
            await tryStartLivePreview();
        } else {
            previewVideo.onloadedmetadata = () => {
                previewVideo.onloadedmetadata = null;
                void tryStartLivePreview();
            };
        }

        isVideoPreviewReady = true;
        setVideoActionButtons('ready');
        takeBtn.disabled = false;
        if (!streamResult.usedFallbackWithoutAudio) {
            statusDiv.innerHTML = currentRecordingHasAudio
                ? `<span style="font-weight:600;">${switching ? 'Cámara cambiada' : 'Cámara lista'} (${currentFacingMode === 'environment' ? 'trasera' : 'frontal'}). Pulsa "Empezar grabación" (con audio).</span>`
                : `<span style="font-weight:600;">${switching ? 'Cámara cambiada' : 'Cámara lista'} (${currentFacingMode === 'environment' ? 'trasera' : 'frontal'}). Pulsa "Empezar grabación".</span>`;
        }
    } catch (error) {
        console.error('openVideoCameraPreview error:', error);
        const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
        statusDiv.innerHTML = denied
            ? '<span style="color:#ef4444; font-weight:600;">Permisos de cámara/micrófono denegados. Actívalos en tu navegador para grabar con audio.</span>'
            : '<span style="color:#ef4444; font-weight:600;">No se pudo iniciar la cámara para vídeo. Intenta de nuevo.</span>';
        cleanupRecorderState();
        takeBtn.disabled = false;
        setVideoActionButtons('idle');
    }
}

async function startVideoRecording() {
    if (!isVideoPreviewReady || !mediaRecorder || !recorderStream) {
        statusDiv.innerHTML = '<span style="color:#92400e; font-weight:600;">Primero pulsa "Abrir cámara vídeo".</span>';
        return;
    }

    if (mediaRecorder.state !== 'inactive') {
        return;
    }

    mediaRecorder.start();
    isRecording = true;
    setRecordingUI(true);
    statusDiv.innerHTML = currentRecordingHasAudio
        ? '<span style="font-weight:600;">Grabando vídeo con audio... máximo 6 segundos.</span>'
        : '<span style="font-weight:600;">Grabando vídeo sin audio... máximo 6 segundos.</span>';

    recordingStopTimeout = setTimeout(() => {
        stopVideoRecording();
    }, MAX_VIDEO_DURATION_SEC * 1000);
}

function stopVideoRecording() {
    if (!mediaRecorder) return;

    if (recordingStopTimeout) {
        clearTimeout(recordingStopTimeout);
        recordingStopTimeout = null;
    }

    if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }

    isRecording = false;
    setRecordingUI(false);
    statusDiv.textContent = 'Procesando vídeo...';
}

function setRecordingUI(recording) {
    if (recording) {
        takeBtn.disabled = true;
        sendBtn.classList.add('hidden');
        postCaptureActions?.classList.add('hidden');
        if (videoBtn) videoBtn.disabled = true;
        if (startRecordBtn) {
            startRecordBtn.disabled = false;
            startRecordBtn.innerHTML = '<span class="icon">⏹️</span> Detener grabación';
        }
        if (switchCameraBtn) {
            switchCameraBtn.disabled = true;
        }
        return;
    }

    takeBtn.disabled = false;
    setVideoActionButtons(isVideoPreviewReady ? 'ready' : 'idle');
}

function setVideoActionButtons(mode) {
    if (videoBtn) {
        if (mode === 'opening') {
            videoBtn.disabled = true;
            videoBtn.innerHTML = '<span class="icon">⏳</span> Abriendo cámara...';
        } else if (mode === 'ready') {
            videoBtn.disabled = false;
            videoBtn.innerHTML = '<span class="icon">🎥</span> Reabrir cámara';
        } else {
            videoBtn.disabled = false;
            videoBtn.innerHTML = videoBtnDefaultHTML;
        }
    }

    if (startRecordBtn) {
        if (mode === 'ready') {
            startRecordBtn.disabled = false;
            startRecordBtn.innerHTML = startRecordBtnDefaultHTML;
        } else if (mode === 'recording') {
            startRecordBtn.disabled = false;
            startRecordBtn.innerHTML = '<span class="icon">⏹️</span> Detener grabación';
        } else {
            startRecordBtn.disabled = true;
            startRecordBtn.innerHTML = startRecordBtnDefaultHTML;
        }
    }

    if (switchCameraBtn) {
        if (mode === 'ready') {
            switchCameraBtn.disabled = false;
        } else {
            switchCameraBtn.disabled = true;
        }
        updateSwitchCameraButtonText();
    }
}

function updateSwitchCameraButtonText() {
    if (!switchCameraBtn) return;

    const target = currentFacingMode === 'environment' ? 'frontal' : 'trasera';
    const base = (switchCameraBtnDefaultHTML || '').toUpperCase().includes('CAMBIAR')
        ? `<span class="icon">🔄</span> CAMBIAR A ${target.toUpperCase()}`
        : `<span class="icon">🔄</span> Cambiar a ${target}`;
    switchCameraBtn.innerHTML = base;
}

// Compression Utility
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const maxWidth = 1920;
        const maxHeight = 1920;
        const quality = 0.8;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height *= maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width *= maxHeight / height));
                        height = maxHeight;
                    }
                }

                // Canvas Draw
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Export
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', quality);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

function normalizeMediaProvider(rawProvider) {
    const normalized = String(rawProvider || '').trim().toLowerCase();
    return normalized === MEDIA_PROVIDER_R2 ? MEDIA_PROVIDER_R2 : MEDIA_PROVIDER_FIREBASE;
}

function buildRetentionExpiryTimestamp() {
    return Timestamp.fromMillis(Date.now() + RETENTION_MS);
}

async function uploadMediaFile({ selectedFile, mediaType, eventId, onProgress }) {
    const provider = normalizeMediaProvider(currentMediaProvider);

    // Business rule: videos always go to R2 (never Firebase)
    if (mediaType === 'video') {
        return await uploadToR2Storage({ selectedFile, mediaType, eventId, onProgress });
    }

    if (provider === MEDIA_PROVIDER_R2) {
        try {
            return await uploadToR2Storage({ selectedFile, mediaType, eventId, onProgress });
        } catch (r2Error) {
            console.error('R2 upload failed. Falling back to Firebase Storage.', r2Error);
            return uploadToFirebaseStorage({ selectedFile, mediaType, eventId, onProgress });
        }
    }

    return uploadToFirebaseStorage({ selectedFile, mediaType, eventId, onProgress });
}

async function uploadToFirebaseStorage({ selectedFile, mediaType, eventId, onProgress }) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const ext = inferFileExtension(selectedFile, mediaType);
    const fileName = `${timestamp}_${random}.${ext}`;
    const storagePath = `event_photos/${eventId}/${fileName}`;

    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, selectedFile);

    await new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (typeof onProgress === 'function') {
                    onProgress(progress);
                }
            },
            (error) => reject(error),
            () => resolve()
        );
    });

    const downloadURL = await getDownloadURL(storageRef);
    return {
        provider: MEDIA_PROVIDER_FIREBASE,
        storagePath,
        downloadURL
    };
}

async function uploadToR2Storage({ selectedFile, mediaType, eventId, onProgress }) {
    const endpoint = String(R2_SIGN_UPLOAD_ENDPOINT || '').trim();
    if (!endpoint) {
        throw new Error('Falta configurar __EVENTSNAP_R2_SIGN_UPLOAD_ENDPOINT__ para subidas a R2.');
    }

    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const ext = inferFileExtension(selectedFile, mediaType);
    const fileName = `${timestamp}_${random}.${ext}`;

    if (typeof onProgress === 'function') onProgress(15);

    const signResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            eventId,
            fileName,
            contentType: selectedFile.type || 'application/octet-stream',
            mediaType
        })
    });

    if (!signResponse.ok) {
        const errorText = await safeReadResponseText(signResponse);
        throw new Error(`No se pudo obtener URL firmada de R2 (${signResponse.status}). ${errorText}`);
    }

    const signed = await signResponse.json();
    if (!signed?.uploadUrl || !signed?.publicUrl) {
        throw new Error('Respuesta de firmado R2 inválida.');
    }

    const uploadHeaders = { ...(signed.headers || {}) };
    if (!uploadHeaders['Content-Type'] && !uploadHeaders['content-type']) {
        uploadHeaders['Content-Type'] = selectedFile.type || 'application/octet-stream';
    }

    if (typeof onProgress === 'function') onProgress(45);

    const uploadResponse = await fetch(signed.uploadUrl, {
        method: signed.method || 'PUT',
        headers: uploadHeaders,
        body: selectedFile
    });

    if (!uploadResponse.ok) {
        const errorText = await safeReadResponseText(uploadResponse);
        throw new Error(`Falló la subida a R2 (${uploadResponse.status}). ${errorText}`);
    }

    if (typeof onProgress === 'function') onProgress(100);

    return {
        provider: MEDIA_PROVIDER_R2,
        storagePath: signed.path || `event_photos/${eventId}/${fileName}`,
        downloadURL: signed.publicUrl
    };
}

// 3. Upload & Quota Logic
sendBtn.addEventListener('click', async () => {
    if (!selectedMedia?.file || !currentEventId) return;

    sendBtn.disabled = true;
    retakeBtn && (retakeBtn.disabled = true);
    sendBtn.classList.add('hidden'); // Hide button to prevent spam
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    if (progressText) progressText.textContent = 'Subiendo... 0%';
    const isVideo = selectedMedia.type === 'video';
    statusDiv.textContent = isVideo ? 'Subiendo tu vídeo...' : 'Subiendo tu foto...';

    try {
        const selectedFile = selectedMedia.file;
        const fileSizeMB = selectedFile.size / (1024 * 1024);
        if (selectedMedia.type === 'video' && (selectedMedia.durationSec ?? 0) > MAX_VIDEO_DURATION_SEC) {
            throw new Error('La duración del vídeo supera el máximo permitido.');
        }
        const ownerUid = currentEventData.owner_uid;

        // Check Owner Quota
        const ownerRef = doc(db, "users", ownerUid);
        const ownerSnap = await getDoc(ownerRef);

        if (!ownerSnap.exists()) {
            throw new Error("Propietario del evento no encontrado.");
        }

        const ownerData = ownerSnap.data();
        const currentUsage = ownerData.storage_used || 0;
        const limit = ownerData.plan_storage_limit || 200;

        if (currentUsage + fileSizeMB > limit) {
            alert("El álbum está lleno. Contacta con el anfitrión.");
            resetUI();
            return;
        }

        const uploadResult = await uploadMediaFile({
            selectedFile,
            mediaType: selectedMedia.type,
            eventId: currentEventId,
            onProgress: (progress) => {
                progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
                if (progressText) progressText.textContent = `Subiendo... ${Math.round(progress)}%`;
            }
        });

        // Increment Storage Usage
        await updateDoc(ownerRef, {
            storage_used: increment(fileSizeMB)
        });

        const mediaDoc = {
            url: uploadResult.downloadURL,
            mediaUrl: uploadResult.downloadURL,
            uploader: uploaderNameInput.value || "Anónimo",
            createdAt: serverTimestamp(),
            expiresAt: buildRetentionExpiryTimestamp(),
            retentionDays: RETENTION_DAYS,
            type: selectedMedia.type,
            durationSec: selectedMedia.durationSec ?? null,
            mimeType: selectedFile.type || selectedMedia.mimeType || null,
            sizeMB: fileSizeMB, // Guardamos el peso para poder restaurar cuota al borrar
            path: uploadResult.storagePath, // Good for referencing later if needed
            mediaProvider: uploadResult.provider
        };

        if (selectedMedia.type === 'video') {
            mediaDoc.hasAudio = Boolean(selectedMedia.hasAudio);
        }

        await addDoc(collection(db, "events", currentEventId, "photos"), mediaDoc);

        statusDiv.innerHTML = isVideo
            ? '<span style="color:green; font-weight:bold;">¡Vídeo subido con éxito! 🎉</span>'
            : '<span style="color:green; font-weight:bold;">¡Foto subida con éxito! 🎉</span>';
        if (progressText) progressText.textContent = 'Subida completada ✅';

        // Reset after success
        setTimeout(() => {
            resetUI();
            statusDiv.textContent = "";
            // Confetti or nice effect here?
        }, 2000);

    } catch (error) {
        console.error("Upload error:", error);
        const userMessage = extractUploadErrorMessage(error);
        statusDiv.innerHTML = `<span style="color:#ef4444; font-weight:600;">${userMessage}</span>`;
        if (progressText) progressText.textContent = 'Error de subida. Reintenta.';
        sendBtn.disabled = false;
        retakeBtn && (retakeBtn.disabled = false);
        sendBtn.classList.remove('hidden');
    }
});

function resetUI() {
    if (isRecording) {
        stopVideoRecording();
    } else {
        cleanupRecorderState();
    }

    selectedMedia = null;
    currentRecordingHasAudio = false;
    isVideoPreviewReady = false;
    currentFacingMode = 'environment';
    cameraInput.value = "";

    clearPreviewURL();
    preview.src = "";
    preview.classList.remove('hidden');
    previewVideo.pause();
    previewVideo.removeAttribute('src');
    previewVideo.srcObject = null;
    previewVideo.classList.add('hidden');
    previewVideo.controls = true;
    previewVideo.muted = true;

    previewWrap.classList.add('hidden');
    postCaptureActions?.classList.add('hidden');
    sendBtn.classList.add('hidden');
    sendBtn.disabled = false;
    if (retakeBtn) retakeBtn.disabled = false;
    takeBtn.disabled = false;
    setVideoActionButtons('idle');
    progressContainer.classList.add('hidden');
    progressBar.style.width = '0%';
    if (progressText) progressText.textContent = 'Subiendo... 0%';
}

retakeBtn?.addEventListener('click', () => {
    resetUI();
    statusDiv.textContent = "Haz otra captura cuando quieras.";
});

function setImagePreview(blob) {
    clearPreviewURL();
    previewUrl = URL.createObjectURL(blob);
    preview.src = previewUrl;
    preview.classList.remove('hidden');

    previewVideo.pause();
    previewVideo.removeAttribute('src');
    previewVideo.srcObject = null;
    previewVideo.classList.add('hidden');
    previewVideo.controls = true;
    previewVideo.muted = true;
}

function setVideoPreview(file) {
    clearPreviewURL();
    previewUrl = URL.createObjectURL(file);

    preview.classList.add('hidden');
    previewVideo.classList.remove('hidden');
    previewVideo.controls = true;
    previewVideo.muted = false;
    previewVideo.srcObject = null;
    previewVideo.src = previewUrl;
    previewVideo.load();
}

function clearPreviewURL() {
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }
}

function isVideoRecordingSupported() {
    return Boolean(
        navigator?.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== 'undefined'
    );
}

function getSupportedVideoMimeType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return null;
    }

    const preferredTypes = [
        'video/mp4;codecs=h264',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
    ];

    return preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || null;
}

async function getRecorderStreamWithAudioFallback(videoConstraints) {
    const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    };

    try {
        const streamWithAudio = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints.video,
            audio: audioConstraints
        });

        if (streamHasLiveAudioTrack(streamWithAudio)) {
            return {
                stream: streamWithAudio,
                hasAudio: true,
                usedFallbackWithoutAudio: false,
                facingMode: detectFacingMode(streamWithAudio, videoConstraints?.video?.facingMode?.ideal)
            };
        }

        stopMediaStream(streamWithAudio);
    } catch (error) {
        console.warn('No se pudo iniciar audio, intentando fallback sin audio...', error);
    }

    try {
        const streamVideoOnly = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints.video,
            audio: false
        });

        return {
            stream: streamVideoOnly,
            hasAudio: false,
            usedFallbackWithoutAudio: true,
            facingMode: detectFacingMode(streamVideoOnly, videoConstraints?.video?.facingMode?.ideal)
        };
    } catch (primaryError) {
        const desiredFacing = videoConstraints?.video?.facingMode?.ideal;
        const fallbackFacing = desiredFacing === 'environment' ? 'user' : 'environment';
        const fallbackVideoConstraints = {
            ...videoConstraints.video,
            facingMode: { ideal: fallbackFacing }
        };

        const streamFallback = await navigator.mediaDevices.getUserMedia({
            video: fallbackVideoConstraints,
            audio: false
        });

        statusDiv.innerHTML = `<span style="color:#92400e; font-weight:600;">La cámara ${desiredFacing === 'environment' ? 'trasera' : 'frontal'} no está disponible. Se usó la ${fallbackFacing === 'environment' ? 'trasera' : 'frontal'}.</span>`;

        return {
            stream: streamFallback,
            hasAudio: false,
            usedFallbackWithoutAudio: true,
            facingMode: detectFacingMode(streamFallback, fallbackFacing),
            switchedDueToAvailability: true,
            primaryError
        };
    }
}

function detectFacingMode(stream, fallbackFacing = 'environment') {
    const track = stream?.getVideoTracks?.()[0];
    const settings = track?.getSettings?.();
    return settings?.facingMode || fallbackFacing;
}

function streamHasLiveAudioTrack(stream) {
    if (!stream) return false;
    return stream.getAudioTracks().some((track) => track.readyState === 'live');
}

function stopMediaStream(stream) {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
}

function cleanupRecorderState() {
    if (recordingStopTimeout) {
        clearTimeout(recordingStopTimeout);
        recordingStopTimeout = null;
    }

    if (recorderStream) {
        recorderStream.getTracks().forEach((track) => track.stop());
    }

    recorderStream = null;
    mediaRecorder = null;
    recorderChunks = [];
    isRecording = false;
    currentRecordingHasAudio = false;
    isVideoPreviewReady = false;
}

function getVideoDurationSeconds(blob) {
    return new Promise((resolve, reject) => {
        const tempVideo = document.createElement('video');
        const tempUrl = URL.createObjectURL(blob);
        tempVideo.preload = 'metadata';

        tempVideo.onloadedmetadata = () => {
            const duration = Number.isFinite(tempVideo.duration) ? tempVideo.duration : MAX_VIDEO_DURATION_SEC;
            URL.revokeObjectURL(tempUrl);
            resolve(duration);
        };

        tempVideo.onerror = () => {
            URL.revokeObjectURL(tempUrl);
            reject(new Error('Cannot read video metadata.'));
        };

        tempVideo.src = tempUrl;
    });
}

function normalizeFileName(originalName, forcedExt) {
    const safeName = (originalName || 'captura')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-z0-9-_]/gi, '_');
    return `${safeName || 'captura'}.${forcedExt}`;
}

function extensionFromMimeType(mimeType, fallback = 'bin') {
    const map = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov'
    };
    return map[mimeType?.toLowerCase()] || fallback;
}

async function safeReadResponseText(response) {
    try {
        const text = await response.text();
        if (!text) return '';
        const compact = text.replace(/\s+/g, ' ').trim();
        return compact.length > 240 ? `${compact.slice(0, 240)}...` : compact;
    } catch {
        return '';
    }
}

function extractUploadErrorMessage(error) {
    const msg = String(error?.message || '').trim();
    if (!msg) {
        return 'No se pudo subir el archivo. Revisa conexión y vuelve a intentar.';
    }

    if (msg.includes('__EVENTSNAP_R2_SIGN_UPLOAD_ENDPOINT__')) {
        return 'R2 no está configurado en la app. Falta endpoint de firmado.';
    }

    if (msg.includes('No se pudo obtener URL firmada de R2')) {
        return `Error al pedir URL firmada a R2. ${msg}`;
    }

    if (msg.includes('Falló la subida a R2')) {
        return `Error al subir a R2. ${msg}`;
    }

    return `No se pudo subir el archivo. ${msg}`;
}

function inferFileExtension(file, mediaType) {
    const nameExt = file?.name?.split('.')?.pop()?.toLowerCase();
    if (nameExt && /^[a-z0-9]+$/.test(nameExt)) return nameExt;

    if (file?.type) {
        const mimeExt = extensionFromMimeType(file.type);
        if (mimeExt !== 'bin') return mimeExt;
    }

    return mediaType === 'video' ? 'webm' : 'jpg';
}

// Start
init();

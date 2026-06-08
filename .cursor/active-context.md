> **BrainSync Context Pumper** 🧠
> Dynamically loaded for active file: `public\js\dashboard.js` (Domain: **Backend (API/Server)**)

### 📐 Backend (API/Server) Conventions & Fixes
- **[problem-fix] Patched security issue String — prevents XSS injection attacks**: - function mediaProviderLabel(provider) {
+ function syncMediaProviderUI(rawValue) {
-     return provider === 'r2' ? 'Cloudflare R2' : 'Firebase Storage';
+     const provider = normalizeMediaProvider(rawValue);
- }
+ 
- 
+     if (currentEvent) {
- function syncMediaProviderUI(rawValue) {
+         currentEvent.media_provider = provider;
-     const provider = normalizeMediaProvider(rawValue);
+         const currentIndex = userEvents.findIndex((event) => event.id === currentEvent.id);
- 
+         if (currentIndex !== -1) {
-     if (currentEvent) {
+             userEvents[currentIndex].media_provider = provider;
-         currentEvent.media_provider = provider;
+         }
-         const currentIndex = userEvents.findIndex((event) => event.id === currentEvent.id);
+     }
-         if (currentIndex !== -1) {
+ }
-             userEvents[currentIndex].media_provider = provider;
+ 
-         }
+ function syncWallDurationUI(rawValue) {
-     }
+     const seconds = normalizeWallDurationSec(rawValue);
- }
+     if (wallDurationInput) wallDurationInput.value = String(seconds);
- 
+     if (wallDurationStatus) wallDurationStatus.textContent = `Actual: ${seconds}s`;
- function syncWallDurationUI(rawValue) {
+ 
-     const seconds = normalizeWallDurationSec(rawValue);
+     if (currentEvent) {
-     if (wallDurationInput) wallDurationInput.value = String(seconds);
+         currentEvent.wall_photo_duration_sec = seconds;
-     if (wallDurationStatus) wallDurationStatus.textContent = `Actual: ${seconds}s`;
+         const currentIndex = userEvents.findIndex((event) => event.id === currentEvent.id);
- 
+         if (currentIndex !== -1) {
-     if (currentEvent) {
+             userEvents[currentIndex].wall_photo_duration_sec = seconds;
-         currentEvent.wall_photo_duration_sec = seconds;
+         }
-         const currentIndex = userEvents.findIndex((event) => event.id === currentEvent.id);
+     }
-         if (cur
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [loadingSection, mainContent, createEventSection, dashboardSection, userEmailSpan]
- **[problem-fix] Patched security issue Array — prevents XSS injection attacks**: - const mediaProviderInput = document.getElementById('mediaProviderInput');
+ const mediaLightbox = document.getElementById('mediaLightbox');
- const saveMediaProviderBtn = document.getElementById('saveMediaProviderBtn');
+ const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
- const mediaProviderStatus = document.getElementById('mediaProviderStatus');
+ const lightboxPrevBtn = document.getElementById('lightboxPrevBtn');
- const mediaLightbox = document.getElementById('mediaLightbox');
+ const lightboxNextBtn = document.getElementById('lightboxNextBtn');
- const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
+ const lightboxMediaContainer = document.getElementById('lightboxMediaContainer');
- const lightboxPrevBtn = document.getElementById('lightboxPrevBtn');
+ const lightboxMediaLabel = document.getElementById('lightboxMediaLabel');
- const lightboxNextBtn = document.getElementById('lightboxNextBtn');
+ const lightboxPosition = document.getElementById('lightboxPosition');
- const lightboxMediaContainer = document.getElementById('lightboxMediaContainer');
+ 
- const lightboxMediaLabel = document.getElementById('lightboxMediaLabel');
+ let currentUser = null;
- const lightboxPosition = document.getElementById('lightboxPosition');
+ let userData = null;
- 
+ let userEvents = []; // Array of {id, ...data}
- let currentUser = null;
+ let currentEvent = null;
- let userData = null;
+ let toastTimeout = null;
- let userEvents = []; // Array of {id, ...data}
+ let lightboxIndex = -1;
- let currentEvent = null;
+ let lightboxOpen = false;
- let toastTimeout = null;
+ let lightboxMediaNode = null;
- let lightboxIndex = -1;
+ let lightboxCurrentMediaId = null;
- let lightboxOpen = false;
+ 
- let lightboxMediaNode = null;
+ const WALL_DURATION_DEFAULT_SEC = 6;
- let lightboxCurrentMediaId = null;
+ const WALL_DURATION_MIN_SEC = 3;
- 
+ const WALL_DURATION_MAX_SEC = 15;
- const WALL_DURATION_DEFAULT_SE
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [loadingSection, mainContent, createEventSection, dashboardSection, userEmailSpan]
- **[problem-fix] Fixed null crash in Business — prevents null/undefined runtime crashes**: -     if (provider === MEDIA_PROVIDER_R2) {
+     // Business rule: videos always go to R2 (never Firebase)
-         try {
+     if (mediaType === 'video') {
-             return await uploadToR2Storage({ selectedFile, mediaType, eventId, onProgress });
+         return await uploadToR2Storage({ selectedFile, mediaType, eventId, onProgress });
-         } catch (r2Error) {
+     }
-             console.error('R2 upload failed. Falling back to Firebase Storage.', r2Error);
+ 
-             return uploadToFirebaseStorage({ selectedFile, mediaType, eventId, onProgress });
+     if (provider === MEDIA_PROVIDER_R2) {
-         }
+         try {
-     }
+             return await uploadToR2Storage({ selectedFile, mediaType, eventId, onProgress });
- 
+         } catch (r2Error) {
-     return uploadToFirebaseStorage({ selectedFile, mediaType, eventId, onProgress });
+             console.error('R2 upload failed. Falling back to Firebase Storage.', r2Error);
- }
+             return uploadToFirebaseStorage({ selectedFile, mediaType, eventId, onProgress });
- 
+         }
- async function uploadToFirebaseStorage({ selectedFile, mediaType, eventId, onProgress }) {
+     }
-     const timestamp = Date.now();
+ 
-     const random = Math.floor(Math.random() * 1000);
+     return uploadToFirebaseStorage({ selectedFile, mediaType, eventId, onProgress });
-     const ext = inferFileExtension(selectedFile, mediaType);
+ }
-     const fileName = `${timestamp}_${random}.${ext}`;
+ 
-     const storagePath = `event_photos/${eventId}/${fileName}`;
+ async function uploadToFirebaseStorage({ selectedFile, mediaType, eventId, onProgress }) {
- 
+     const timestamp = Date.now();
-     const storageRef = ref(storage, storagePath);
+     const random = Math.floor(Math.random() * 1000);
-     const uploadTask = uploadBytesResumable(storageRef, selectedFile);
+     const ext = inferFileExtension(selectedFile, mediaType);
- 
+     const fileName = 
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [storage, loadingBlock, invalidBlock, validBlock, invalidMsg]
- **[what-changed] Updated schema Falling**: -             console.error('R2 upload failed (fallback disabled).', r2Error);
+             console.error('R2 upload failed. Falling back to Firebase Storage.', r2Error);
-             throw r2Error;
+             return uploadToFirebaseStorage({ selectedFile, mediaType, eventId, onProgress });

📌 IDE AST Context: Modified symbols likely include [storage, loadingBlock, invalidBlock, validBlock, invalidMsg]
- **[convention] Fixed null crash in Esperando — prevents null/undefined runtime crashes — confirmed 3x**: -                     photoFrame.classList.add('hidden');
+                     deactivateWallVideo();
-                     setWallStatus('Esperando la primera foto...');
+                     photoFrame.classList.add('hidden');
-                 } else {
+                     setWallStatus('Esperando la primera foto...');
-                     currentPhotoIndex = currentPhotoIndex % photos.length;
+                 } else {
-                 }
+                     currentPhotoIndex = currentPhotoIndex % photos.length;
-             }
+                 }
-         });
+             }
- 
+         });
-         if (photos.length > 0 && !rotationInterval && !isBreakingNews && !isPaused) {
+ 
-             // Start rotation if not running
+         if (photos.length > 0 && !rotationInterval && !isBreakingNews && !isPaused) {
-             startRotation();
+             // Start rotation if not running
-             setWallStatus(`Mostrando ${photos.length} fotos · ${wallDurationSec}s`);
+             startRotation();
-         }
+             setWallStatus(`Mostrando ${photos.length} medios · ${wallDurationSec}s`);
- 
+         }
-         if (photos.length === 0) {
+ 
-             loadingMsg.textContent = "Esperando la primera foto... 📸";
+         if (photos.length === 0) {
-             loadingMsg.classList.remove('hidden');
+             loadingMsg.textContent = "Esperando la primera foto... 📸";
-             setWallStatus('Esperando la primera foto...');
+             loadingMsg.classList.remove('hidden');
-         } else {
+             setWallStatus('Esperando la primera foto...');
-             loadingMsg.classList.add('hidden');
+         } else {
-             if (!hasNewPhotos) {
+             loadingMsg.classList.add('hidden');
-                 setWallStatus(isPaused
+             if (!hasNewPhotos) {
-                     ? `Pausado · ${photos.length} fotos · ${wallDurationSec}s`
+                 setWall
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [wallContainer, photoFrame, img1, img2, wallVideo]
- **[what-changed] what-changed in r2-sign-upload-worker.js**: -     : (allowed.includes(requestOrigin) ? requestOrigin : allowed[0] || '*');
+     : (allowed.includes(requestOrigin) ? requestOrigin : '*');

📌 IDE AST Context: Modified symbols likely include [TOKEN_TTL_SECONDS, MAX_ALLOWED_SIZE_BYTES, MAX_VIDEO_SIZE_BYTES, default, handleSignUpload]

# 📸 EventSnap - Plataforma de Fotos en Tiempo Real

**EventSnap** es una aplicación web para compartir fotos en eventos (bodas, fiestas, gimnasios) en tiempo real. Los invitados escanean un QR, toman fotos sin registrarse y estas aparecen instantáneamente en una proyección (Muro) y en la galería privada del anfitrión.

---

## 🚀 Características Principales

*   **Sin Fricción:** Los invitados no necesitan descargar apps ni registrarse. Escanear y subir.
*   **Muro en Vivo:** Proyección automática de fotos nuevas con animaciones ("Breaking News").
*   **Gestión de Eventos:** Panel de control para anfitriones (Crear evento, elegir tema, ver QR).
*   **Temas Dinámicos:** Soporte para múltiples estilos visuales (Boda Elegante, Gym/Deporte) con inyección de CSS.
*   **Optimización:** Compresión de imágenes en el cliente (Canvas) para ahorrar datos y almacenamiento.
*   **Descarga Masiva:** Generación de archivo `.zip` con todas las fotos del evento.
*   **Seguridad:** Reglas de Firebase robustas para proteger datos y almacenamiento.

---

## 🛠️ Stack Tecnológico

*   **Frontend:** HTML5, CSS3 (Variables), JavaScript (ES Modules).
*   **Backend (Serverless):** Google Firebase v9.
    *   **Authentication:** Google Sign-In.
    *   **Firestore:** Base de datos NoSQL en tiempo real.
    *   **Storage:** Almacenamiento de fotos.
*   **Librerías Extra:** `JSZip` (para descargas masivas).
*   **Despliegue:** Netlify (SPA con `_redirects`).

---

## 📂 Estructura del Proyecto

```text
public/
├── css/
│   ├── main.css           # Estilos base y utilidades
│   ├── theme-wedding.css  # Tema Boda (Burbujas, fuentes elegantes)
│   └── theme-gym.css      # Tema Gym (Neón, oscuro, textos agresivos)
├── js/
│   ├── firebase-config.js # Configuración de Firebase (API Keys)
│   ├── auth.js            # Lógica de Login/Registro y validación de códigos
│   ├── dashboard.js       # Panel de control: Galería, ZIP, Borrado
│   ├── app.js             # App de cámara: Subida, Compresión, Detección de tema
│   └── wall.js            # Muro: Listener en tiempo real, rotación de fotos
├── index.html             # Landing Page y Login
├── dashboard.html         # Panel del Anfitrión
├── app.html               # Interfaz de cámara para invitados
├── wall.html              # Interfaz de proyector (TV)
└── _redirects             # Reglas de enrutamiento para Netlify
```

---

## 🧠 Arquitectura y Lógica Clave

### 1. Autenticación Robusta (`auth.js`)
El sistema usa valida códigos de invitación (`BODA2026`) y gestiona el login con Google.
*   **Estrategia Anti-Fallo:** Usa `sessionStorage` para guardar temporalmente las credenciales de Google si Firebase tarda en inicializar, evitando condiciones de carrera (Race Conditions) al validar códigos tras el login.

### 2. Subida Optimizada (`app.js`)
Para evitar llenar el almacenamiento y mejorar la velocidad en móviles 4G:
1.  El usuario selecciona/toma foto.
2.  Se procesa en un `<canvas>` oculto.
3.  Se redimensiona a **máximo 1920px**.
4.  Se comprime a **JPEG calidad 0.8**.
5.  Se sube el `Blob` resultante a Firebase Storage.

### 3. Muro en Tiempo Real (`wall.js`)
Escucha cambios en la subcolección `photos` de Firestore.
*   **Nuevas fotos:** Interrumpe la rotación y muestra la foto con animación "Pop In".
*   **Rotación:** Si no hay fotos nuevas, rota las existentes cada 8 segundos.

### 4. Sistema de Archivos y Cuotas
*   **Storage Paths:** `event_photos/{eventId}/{randomName}.jpg`
*   **Limpieza:** Al borrar una foto, el sistema intenta borrarla de Storage. Si no existe (error `object-not-found`), procede a borrar el documento de Firestore para mantener la consistencia "Orphaned File Handling".

---

## 💾 Modelos de Datos (Firestore)

### Colección `users`
Datos del anfitrión y su consumo.
```json
{
  "email": "user@gmail.com",
  "role": "host",
  "plan_storage_limit": 200, // MB
  "storage_used": 15.5, // MB
  "event_active_id": "auto-id-evento",
  "invitedByCode": "BODA2026"
}
```

### Colección `events`
Configuración del evento.
```json
{
  "name": "Boda Ana y Carlos",
  "slug": "ana-y-carlos", // URL amigable
  "theme": "wedding", // o 'gym'
  "owner_uid": "uid-del-user",
  "created_at": "timestamp"
}
```

### Subcolección `events/{eventId}/photos`
Metadatos de cada foto.
```json
{
  "url": "https://firebasestorage...",
  "path": "event_photos/id/foto.jpg", // Para borrado eficiente
  "uploader": "Tío Manolo",
  "sizeMB": 1.2, // Para recalcular cuotas
  "createdAt": "timestamp"
}
```

---

## 🔒 Reglas de Seguridad

### Firestore (`firestore.rules`)
*   **Eventos/Fotos:** Lectura pública (para que el Muro funcione).
*   **Escritura:** Solo dueños pueden crear eventos. Cualquiera puede crear fotos (invitados).
*   **Borrado:** Solo usuarios autenticados (Anfitriones) pueden borrar fotos.

### Storage (`storage.rules`)
*   **Lectura:** Pública.
*   **Subida:** Pública (si `size < 25MB`).
*   **Borrado:** Solo usuarios autenticados (`request.auth != null`).

---

## 💸 Optimización de Coste y Modo Híbrido (Firebase + R2)

Se han añadido bases para reducir coste en lanzamiento y preparar migración por fases:

1. **Retención de 30 días en metadatos de medios**
   - En la subida desde [`app.js`](public/js/app.js) ahora se guarda:
     - `expiresAt` (timestamp)
     - `retentionDays` (30)
   - Objetivo: habilitar limpieza automática y limitar crecimiento.

2. **Compatibilidad de URL de medios (legacy + nuevo)**
   - El frontend ahora prioriza `mediaUrl` y mantiene fallback a `url` en:
     - [`wall.js`](public/js/wall.js)
     - [`dashboard.js`](public/js/dashboard.js)

3. **Feature flag de proveedor de medios por evento**
   - Campo nuevo recomendado en `events`:
     - `media_provider: "firebase" | "r2"`
   - Nuevos eventos se crean con `media_provider: "firebase"` por defecto.

4. **Hook opcional para subida firmada a R2**
   - En [`app.html`](public/app.html) existe configuración runtime:
     - `window.__EVENTSNAP_R2_SIGN_UPLOAD_ENDPOINT__`
   - Si no se configura, la app sigue en Firebase Storage.
   - Si está configurado y el evento usa `media_provider: "r2"`, intenta subir a R2 y hace fallback automático a Firebase en caso de error.

### Ejemplo de endpoint de firmado (contrato esperado)

La app hace `POST` al endpoint de firmado con:

```json
{
  "eventId": "abc123",
  "fileName": "1713700000000_123.jpg",
  "contentType": "image/jpeg",
  "mediaType": "image"
}
```

Respuesta esperada:

```json
{
  "uploadUrl": "https://...signed-url...",
  "publicUrl": "https://cdn.example.com/event_photos/abc123/1713700000000_123.jpg",
  "method": "PUT",
  "headers": {
    "Content-Type": "image/jpeg"
  },
  "path": "event_photos/abc123/1713700000000_123.jpg"
}
```

### Recomendación de despliegue por fases

- **Fase 0 (ya preparada):** retención 30 días + límite de historial del wall + compatibilidad `mediaUrl`.
- **Fase 1:** desplegar endpoint de firmado R2 y activar `media_provider: "r2"` solo en eventos piloto.
- **Fase 2:** habilitar lifecycle en R2 (auto-delete 30 días) + cleanup de metadatos expirados en Firestore.

---

## 🤖 Guía para Futuras IAs / Desarrolladores

Si necesitas extender este proyecto:

1.  **Añadir un nuevo tema:**
    *   Crea `public/css/theme-NUEVO.css`.
    *   Añade la opción en el radio button de `dashboard.html`.
    *   Actualiza `app.js` (`applyTheme`) y `wall.js` para inyectar el nuevo CSS.

2.  **Soporte de Vídeo:**
    *   El botón ya existe en `app.html` (oculto/desactivado).
    *   Necesitas actualizar `app.js` para aceptar vídeo, comprimirlo (más complejo, quizás ffmpeg.wasm o solo limitar duración) y subirlo.
    *   Actualizar `wall.js` para usar etiquetas `<video>` en lugar de `<img>`.

3.  **Despliegue:**
    *   Asegúrate de que `public/_redirects` está presente para que el routing de Netlify funcione con las URLs limpias (`/e/slug`).

---
*Documentación generada automáticamente por **Antigravity Agent** - 2026*

EVENTSNAP — Frontend en Netlify + Backend en Apps Script (sin /u/4/ en móviles)

✅ Objetivo:
- Los invitados abren SIEMPRE tu web en Netlify: https://TU-SITIO.netlify.app/e/<eventkey>
- El navegador NO entra a script.google.com (adiós /u/4/ / /u/5/)
- Las subidas se envían al backend (Apps Script) via Cloudflare Worker (CORS proxy)

────────────────────────────────────────────────────────────
PARTE A — Preparar Apps Script (backend)
────────────────────────────────────────────────────────────
1) En tu proyecto Apps Script, pega el bloque "doPost" (archivo APPS_SCRIPT_PATCH.txt).
   - NO borres tu código actual. Solo AÑADE ese doPost.

2) Deploy > Manage deployments > Web app
   - Execute as: Me
   - Who has access: Anyone
   - Guarda el URL /exec (ya lo tienes):
     https://script.google.com/macros/s/AKfycbwXblOUg6F29DA7shqPZ31qU8yY6zD1hu6wExtffUzAyrqSBpfxXCDD_q7VIqdJRd5TyQ/exec

3) Prueba rápida (opcional):
   - No la probamos desde navegador directamente, la llamará el Worker.

────────────────────────────────────────────────────────────
PARTE B — Crear Cloudflare Worker (GRATIS)
────────────────────────────────────────────────────────────
1) Crea cuenta en Cloudflare (gratis).
2) En el panel: Workers & Pages > Create application > Create Worker
3) Pon un nombre: eventsnap-proxy (por ejemplo)
4) Pega el contenido de WORKER.js (incluido en este zip) y "Deploy".
5) Copia la URL pública que te da Cloudflare, será algo así:
   https://eventsnap-proxy.<tu-usuario>.workers.dev

────────────────────────────────────────────────────────────
PARTE C — Publicar en Netlify (frontend)
────────────────────────────────────────────────────────────
1) Abre index.html y reemplaza:
   https://YOUR-WORKER-SUBDOMAIN.workers.dev
   por tu URL real del worker:
   https://eventsnap-proxy.<tu-usuario>.workers.dev

2) Sube este ZIP a Netlify:
   - Netlify > Add new site > Deploy manually
   - Arrastra el zip o la carpeta

3) Prueba:
   - https://TU-SITIO.netlify.app/e/ana-y-luis
   (usa un eventKey que exista y esté activo en tu Google Sheet)

────────────────────────────────────────────────────────────
CÓMO FUNCIONA LA RUTA /e/<eventkey>
────────────────────────────────────────────────────────────
- Netlify reescribe /e/* a /index.html (archivo _redirects)
- index.html lee el eventKey del path y hace:
    POST API_URL  { action: "info", eventKey }
  para pintar el nombre del evento
- Al enviar:
    POST API_URL  { action: "upload", eventKey, imageBase64, mimeType, uploaderName }

────────────────────────────────────────────────────────────
PARTE D — Panel de Control (Admin)
────────────────────────────────────────────────────────────
Ahora puedes gestionar tus eventos sin tocar el Google Sheet:

1) El backend ya incluye Admin.html y las funciones necesarias.
2) Accede a: URL_DE_TU_WEB_APP?admin=true
3) Desde allí puedes:
   - Crear nuevos eventos (con creación automática de carpeta en Drive).
   - Editar nombres y activar/desactivar eventos.
   - Eliminar eventos antiguos.
   - Copiar links rápidamente.

Guarda esa URL con ?admin=true en tus favoritos para gestionar todo desde el móvil o PC fácilmente. 😄

────────────────────────────────────────────────────────────
NOTAS IMPORTANTES
────────────────────────────────────────────────────────────
- El Worker solo reenvía POST a tu Apps Script y añade CORS.
- Apps Script sigue guardando en Drive y usando el Sheet como base de datos.
- IMPORTANTE: Al hacer cambios en Apps Script, recuerda hacer un "New Deployment" para que se apliquen.


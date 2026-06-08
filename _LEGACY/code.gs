/**
 * EventSnap WebApp (multi-evento) — con Google Sheet como “base de datos”
 *
 * ✅ Un único proyecto sirve para muchos eventos simultáneos.
 * ✅ Cada evento se identifica por ?k=EVENT_KEY en la URL del QR.
 * ✅ Los eventos se gestionan en un Google Sheet (sin tocar el código cada vez).
 *
 * Sheet: https://docs.google.com/spreadsheets/d/1iIxKTzkFmHMCZnB7qsoAMSB8rcDpQWeGIHORNm6MKG8/edit?gid=0
 *
 * Estructura esperada en la pestaña "Eventos" (fila 1 cabeceras):
 * A: eventKey   (ej: ana-y-luis)
 * B: folderId   (ID de carpeta Drive destino)
 * C: nombre     (ej: Ana & Luis)
 * D: activo     (TRUE/FALSE)
 */

const EVENTS_SHEET_ID = "1iIxKTzkFmHMCZnB7qsoAMSB8rcDpQWeGIHORNm6MKG8";
const EVENTS_TAB_NAME = "Eventos";
const TZ = "Europe/Madrid";

// Cache para acelerar lecturas del Sheet
const CACHE_TTL_SECONDS = 300; // 5 minutos

function normalizeKey(k) {
  return decodeURIComponent(String(k || ""))
    .trim()
    .toLowerCase();
}

/**
 * Lee el sheet y devuelve un objeto: { folderId, couple }
 * - Sólo devuelve eventos con activo = TRUE y folderId válido.
 * - Si no existe, devuelve null.
 */
function getEventByKey(k) {
  const key = normalizeKey(k);
  if (!key) return null;

  // 1) Cache
  const cache = CacheService.getScriptCache();
  const cached = cache.get("event:" + key);
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  // 2) Leer sheet
  const ss = SpreadsheetApp.openById(EVENTS_SHEET_ID);
  const sh = ss.getSheetByName(EVENTS_TAB_NAME);
  if (!sh) throw new Error(`No existe la pestaña "${EVENTS_TAB_NAME}" en el Sheet.`);

  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return null; // sólo cabecera o vacío

  // Validación mínima de cabecera
  const header = values[0].map(v => String(v || "").trim().toLowerCase());
  // Esperamos eventKey en A y folderId en B, pero no bloqueamos si el usuario cambió el nombre;
  // sólo nos importa el orden de columnas.
  if (values[0].length < 4) {
    throw new Error("La hoja 'Eventos' debe tener al menos 4 columnas: eventKey, folderId, nombre, activo.");
  }

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowKey = normalizeKey(row[0]);               // A
    const folderId = String(row[1] || "").trim();      // B
    const name = String(row[2] || "").trim();          // C
    const active = row[3];                             // D (boolean)

    if (!rowKey || !folderId) continue;
    if (rowKey !== key) continue;
    if (active !== true) return null; // existe pero desactivado

    const ev = { folderId, couple: name || rowKey };

    // Guardar en cache
    cache.put("event:" + key, JSON.stringify(ev), CACHE_TTL_SECONDS);

    return ev;
  }

  return null;
}

function doGet(e) {
  // Check for admin parameter
  if (e && e.parameter && e.parameter.admin === "true") {
    const t = HtmlService.createTemplateFromFile("Admin");
    return t.evaluate()
      .addMetaTag("viewport", "width=device-width, initial-scale=1")
      .setTitle("Admin Panel - EventSnap")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const k = (e && e.parameter && e.parameter.k) ? normalizeKey(e.parameter.k) : "";
  const ev = getEventByKey(k);
  const ok = !!ev;

  const t = HtmlService.createTemplateFromFile("Index");
  t.ok = ok;
  t.couple = ok ? ev.couple : "";
  t.eventKey = ok ? k : ""; // clave real para validar subidas

  return t.evaluate()
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setTitle(ok ? ("Fotos para " + ev.couple) : "Enlace no válido")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ADMIN FUNCTIONS
 */

function getAllEvents() {
  const ss = SpreadsheetApp.openById(EVENTS_SHEET_ID);
  const sh = ss.getSheetByName(EVENTS_TAB_NAME);
  if (!sh) return [];
  
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  
  const events = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    events.push({
      eventKey: row[0],
      folderId: row[1],
      nombre: row[2],
      activo: row[3] === true || String(row[3]).toLowerCase() === "true"
    });
  }
  return events;
}

function saveEvent(eventData) {
  const ss = SpreadsheetApp.openById(EVENTS_SHEET_ID);
  const sh = ss.getSheetByName(EVENTS_TAB_NAME);
  if (!sh) throw new Error("Sheet not found");
  
  const values = sh.getDataRange().getValues();
  const oldKey = eventData.oldKey;
  const newRow = [
    eventData.eventKey,
    eventData.folderId,
    eventData.nombre,
    eventData.activo
  ];
  
  let rowIndex = -1;
  if (oldKey) {
    for (let i = 1; i < values.length; i++) {
      if (normalizeKey(values[i][0]) === normalizeKey(oldKey)) {
        rowIndex = i + 1;
        break;
      }
    }
  }
  
  if (rowIndex > -1) {
    sh.getRange(rowIndex, 1, 1, 4).setValues([newRow]);
  } else {
    sh.appendRow(newRow);
  }
  
  // Clear cache for this key
  CacheService.getScriptCache().remove("event:" + normalizeKey(eventData.eventKey));
  if (oldKey) CacheService.getScriptCache().remove("event:" + normalizeKey(oldKey));
  
  return { ok: true };
}

function deleteEvent(eventKey) {
  const ss = SpreadsheetApp.openById(EVENTS_SHEET_ID);
  const sh = ss.getSheetByName(EVENTS_TAB_NAME);
  const values = sh.getDataRange().getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (normalizeKey(values[i][0]) === normalizeKey(eventKey)) {
      sh.deleteRow(i + 1);
      CacheService.getScriptCache().remove("event:" + normalizeKey(eventKey));
      return { ok: true };
    }
  }
  return { ok: false, error: "Event not found" };
}

function createDriveFolder(name) {
  try {
    const folder = DriveApp.createFolder("EventSnap - " + name);
    // Make it public or shared if needed, but for now just returning the ID
    // folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.ADD_EDIT);
    return { ok: true, folderId: folder.getId() };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function uploadPhoto(payload) {
  try {
    const k = payload && payload.eventKey ? normalizeKey(payload.eventKey) : "";
    const ev = getEventByKey(k);

    if (!ev) {
      return { ok: false, error: "Acceso no autorizado o evento desactivado." };
    }

    const imageBase64 = payload.imageBase64;
    const mimeType = payload.mimeType || "image/jpeg";

    if (!imageBase64 || !String(imageBase64).includes("base64,")) {
      return { ok: false, error: "No se recibió archivo." };
    }

    const stamp = Utilities.formatDate(new Date(), TZ, "yyyyMMdd_HHmmss");

    // Sanitizar nombre del usuario (si existe)
    let uploader = "Anonimo";
    if (payload.uploaderName && String(payload.uploaderName).trim() !== "") {
      uploader = String(payload.uploaderName)
        .trim()
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 40);
      if (!uploader) uploader = "Anonimo";
    }

    // Extensión por tipo
    let ext = "jpg";
    if (mimeType.includes("png")) ext = "png";
    else if (mimeType.includes("mp4")) ext = "mp4";
    else if (mimeType.includes("webm")) ext = "webm";
    else if (mimeType.includes("quicktime")) ext = "mov";

    // Nombre: uploader_FECHA.ext  (si quieres incluir eventKey: `${k}__${uploader}_${stamp}.${ext}`)
    const filename = `${uploader}_${stamp}.${ext}`;

    const bytes = Utilities.base64Decode(String(imageBase64).split("base64,")[1]);
    const blob = Utilities.newBlob(bytes, mimeType, filename);

    const folder = DriveApp.getFolderById(ev.folderId);
    const file = folder.createFile(blob);

    // Limpia cache por si editaste el sheet recientemente (opcional)
    // CacheService.getScriptCache().remove("event:" + k);

    return { ok: true, fileId: file.getId(), name: file.getName() };

  } catch (err) {
    // Mensaje a prueba de fallos
    const msg = (err && err.message) ? err.message : String(err);
    return { ok: false, error: "Error interno: " + msg };
  }
  
}
// ✅ AÑADE ESTO A TU PROYECTO DE APPS SCRIPT (Code.gs)
// Añade un doPost para que Netlify/Worker pueda llamar a tu backend.
// Mantén tu uploadPhoto(payload) tal como lo tienes.

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const payload = JSON.parse(raw || "{}");

    const action = String(payload.action || "").toLowerCase();
    const k = payload.eventKey || payload.k || "";

    if (action === "info") {
      const ev = getEventByKey(k);
      if (!ev) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Evento no válido o desactivado." }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true, couple: ev.couple, eventKey: normalizeKey(k) }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "upload") {
      const res = uploadPhoto(payload);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Acción no soportada." }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Error interno: " + msg }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}



// Configuración básica
// Cuando despliegues como Web App, asegúrate de:
// 1. Execute as: Me (tu cuenta)
// 2. Who has access: Anyone (Cualquiera)

const EVENTS_SHEET_ID = "1iIxKTzkFmHMCZnB7qsoAMSB8rcDpQWeGIHORNm6MKG8";
const EVENTS_TAB_NAME = "Eventos";

function normalizeKey(k) {
  return decodeURIComponent(String(k || ""))
    .trim()
    .toLowerCase();
}

function doGet(e) {
  e = e || { parameter: {} };
  const action = e.parameter.action || 'list';
  const folderId = e.parameter.folderId;
  const fileId = e.parameter.fileId;
  
  let result = {};

  try {
    if (action === 'list') {
      if (!folderId) throw new Error('Falta parameter folderId');
      result.data = listImageIds(folderId);
      result.success = true;
    } 
    else if (action === 'image') {
      if (!fileId) throw new Error('Falta parameter fileId');
      result.data = getImageData(fileId);
      result.success = true;
    }
    else if (action === 'getAllEvents') {
      result.data = getAllEvents();
      result.success = true;
    }
    // Short code actions
    else if (action === 'getAllShortCodes') {
      result.data = getAllShortCodes();
      result.success = true;
    }
    else if (action === 'resolveShortCode') {
      const codigo = e.parameter.codigo || "";
      const resolved = resolveShortCode(codigo);
      if (resolved.ok) {
        result = { success: true, ok: true, folderId: resolved.folderId, scriptUrl: resolved.scriptUrl, nombre: resolved.nombre };
      } else {
        result = { success: true, ok: false, error: resolved.error };
      }
    }
    else {
      throw new Error('Accion desconocida: ' + action);
    }
  } catch (err) {
    result.success = false;
    result.error = err.toString();
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

const TZ = "Europe/Madrid";

function doPost(e) {
  let result = {};
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const payload = JSON.parse(raw || "{}");
    const action = payload.action;

    // Public actions (guest uploads)
    if (action === 'upload') {
       result = uploadPhoto(payload);
    }
    else if (action === 'info') {
       const ev = getEventByKey(payload.k || payload.eventKey);
       if (ev) result = { ok: true, couple: ev.couple, eventKey: normalizeKey(payload.k || payload.eventKey) };
       else result = { ok: false, error: "Evento no encontrado" };
    }
    // Admin actions (protected by Netlify)
    else if (action === 'saveEvent') {
       result = saveEvent(payload.data);
       result.success = true;
    } 
    else if (action === 'deleteEvent') {
       result = deleteEvent(payload.eventKey);
       result.success = true;
    }
    else if (action === 'createDriveFolder') {
       result = createDriveFolder(payload.name);
       result.success = true;
    }
    // Short Code Actions
    else if (action === 'createShortCode') {
       result = createShortCode(payload);
       result.success = true;
    }
    else if (action === 'toggleShortCode') {
       result = toggleShortCode(payload);
       result.success = true;
    }
    else if (action === 'resolveShortCode') {
       const codigo = payload.codigo || "";
       const resolved = resolveShortCode(codigo);
       if (resolved.ok) {
         result = { success: true, ok: true, folderId: resolved.folderId, scriptUrl: resolved.scriptUrl, nombre: resolved.nombre };
       } else {
         result = { success: true, ok: false, error: resolved.error };
       }
    }
    else if (action === 'deleteShortCode') {
       result = deleteShortCode(payload);
       result.success = true;
    }
    else {
       throw new Error('Accion POST desconocida: ' + action);
    }

  } catch (err) {
    result.success = false;
    result.error = err.toString();
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Lógica Interna ---

function getEventByKey(k) {
  const key = normalizeKey(k);
  if (!key) return null;
  const ss = SpreadsheetApp.openById(EVENTS_SHEET_ID);
  const sh = ss.getSheetByName(EVENTS_TAB_NAME);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (normalizeKey(row[0]) === key && row[3] === true) {
      return { folderId: row[1], couple: row[2] || row[0] };
    }
  }
  return null;
}

function uploadPhoto(payload) {
  try {
    const ev = getEventByKey(payload.eventKey);
    if (!ev) return { ok: false, error: "Evento no válido" };

    const imageBase64 = payload.imageBase64;
    const mimeType = payload.mimeType || "image/jpeg";
    const bytes = Utilities.base64Decode(imageBase64.split("base64,")[1]);
    const stamp = Utilities.formatDate(new Date(), TZ, "yyyyMMdd_HHmmss");
    
    let uploader = (payload.uploaderName || "Anonimo").trim().replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${uploader}_${stamp}.${mimeType.split("/")[1] || "jpg"}`;
    const blob = Utilities.newBlob(bytes, mimeType, filename);
    
    const folder = DriveApp.getFolderById(ev.folderId);
    const file = folder.createFile(blob);
    return { ok: true, fileId: file.getId() };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

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
  const values = sh.getDataRange().getValues();
  const oldKey = eventData.oldKey;
  const newRow = [eventData.eventKey, eventData.folderId, eventData.nombre, eventData.activo];
  
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
  return { ok: true };
}

function deleteEvent(eventKey) {
  const ss = SpreadsheetApp.openById(EVENTS_SHEET_ID);
  const sh = ss.getSheetByName(EVENTS_TAB_NAME);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (normalizeKey(values[i][0]) === normalizeKey(eventKey)) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: "Event not found" };
}

function createDriveFolder(name) {
  const folder = DriveApp.createFolder("EventSnap - " + name);
  return { ok: true, folderId: folder.getId() };
}

function listImageIds(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const out = [];
  while (files.hasNext()) {
    const f = files.next();
    const mt = f.getMimeType();
    if (mt && mt.startsWith('image/')) {
      out.push({
        id: f.getId(),
        name: f.getName(),
        mimeType: mt,
        modified: f.getLastUpdated ? f.getLastUpdated().getTime() : null
      });
    }
  }
  return out;
}

function getImageData(fileId) {
  const file = DriveApp.getFileById(fileId);
  let blob = file.getBlob();
  let mime = blob.getContentType() || 'image/jpeg';
  try {
    const img = ImagesService.openImage(blob);
    const resized = img.resize(1920);
    blob = resized.getBlob();
    blob.setContentType(mime);
  } catch (err) {}
  const b64 = Utilities.base64Encode(blob.getBytes());
  return `data:${mime};base64,${b64}`;
}

/**
 * SHORT CODE SYSTEM FOR PROJECTOR
 */

const SHORT_CODES_TAB = "CodigosProyector";

// Ensure the CodigosProyector sheet exists with proper headers
function ensureShortCodesSheet() {
  const ss = SpreadsheetApp.openById(EVENTS_SHEET_ID);
  let sh = ss.getSheetByName(SHORT_CODES_TAB);
  
  if (!sh) {
    sh = ss.insertSheet(SHORT_CODES_TAB);
    // Add headers
    sh.getRange(1, 1, 1, 6).setValues([
      ["codigo", "folderId", "scriptUrl", "activo", "fechaCreacion", "nombre"]
    ]);
    sh.getRange(1, 1, 1, 6).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  
  return sh;
}

// Generate a random 6-character alphanumeric code
function generateShortCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude similar chars like 0/O, 1/I
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Check if code already exists
function codeExists(codigo) {
  const sh = ensureShortCodesSheet();
  const values = sh.getDataRange().getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toUpperCase() === codigo.toUpperCase()) {
      return true;
    }
  }
  return false;
}

// Create a new short code
function createShortCode(data) {
  const sh = ensureShortCodesSheet();
  
  // Generate unique code
  let codigo = generateShortCode();
  let attempts = 0;
  while (codeExists(codigo) && attempts < 10) {
    codigo = generateShortCode();
    attempts++;
  }
  
  if (attempts >= 10) {
    return { ok: false, error: "No se pudo generar un código único" };
  }
  
  const now = new Date();
  const folderId = data.folderId || "";
  const scriptUrl = data.scriptUrl || "";
  const nombre = data.nombre || "";
  
  sh.appendRow([
    codigo,
    folderId,
    scriptUrl,
    true, // activo
    now,
    nombre
  ]);
  
  return { ok: true, codigo: codigo };
}

// Get all short codes
function getAllShortCodes() {
  const sh = ensureShortCodesSheet();
  const values = sh.getDataRange().getValues();
  
  if (values.length < 2) return [];
  
  const codes = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    codes.push({
      codigo: row[0],
      folderId: row[1],
      scriptUrl: row[2],
      activo: row[3] === true || String(row[3]).toLowerCase() === "true",
      fechaCreacion: row[4],
      nombre: row[5] || ""
    });
  }
  
  return codes;
}

// Toggle active status
function toggleShortCode(data) {
  const sh = ensureShortCodesSheet();
  const values = sh.getDataRange().getValues();
  const codigo = String(data.codigo || "").toUpperCase();
  
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toUpperCase() === codigo) {
      const newStatus = data.activo;
      sh.getRange(i + 1, 4).setValue(newStatus);
      return { ok: true };
    }
  }
  
  return { ok: false, error: "Código no encontrado" };
}

// Delete a short code
function deleteShortCode(data) {
  const sh = ensureShortCodesSheet();
  const values = sh.getDataRange().getValues();
  const codigo = String(data.codigo || "").toUpperCase();
  
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toUpperCase() === codigo) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  
  return { ok: false, error: "Código no encontrado" };
}

// Resolve short code to projector URL data
function resolveShortCode(codigo) {
  const sh = ensureShortCodesSheet();
  const values = sh.getDataRange().getValues();
  const code = String(codigo || "").toUpperCase();
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[0]).toUpperCase() === code) {
      const activo = row[3] === true || String(row[3]).toLowerCase() === "true";
      
      if (!activo) {
        return { ok: false, error: "Este código ha sido desactivado" };
      }
      
      return {
        ok: true,
        folderId: row[1],
        scriptUrl: row[2],
        nombre: row[5] || ""
      };
    }
  }
  
  return { ok: false, error: "Código no válido" };
}

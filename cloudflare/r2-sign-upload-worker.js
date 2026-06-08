/**
 * EventSnap - Cloudflare Worker (R2 upload signer/proxy)
 *
 * Endpoints:
 * - POST /sign-upload  -> returns temporary upload URL for the current Worker
 * - PUT  /upload       -> validates token and stores file in R2
 *
 * This implementation avoids exposing R2 credentials in the browser.
 * The browser uploads directly to this Worker URL with a short-lived token.
 */

const TOKEN_TTL_SECONDS = 5 * 60;
const MAX_ALLOWED_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 12 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/sign-upload' && request.method === 'POST') {
        return await handleSignUpload(request, env, corsHeaders, url);
      }

      if (url.pathname === '/upload' && request.method === 'PUT') {
        return await handleUploadPut(request, env, corsHeaders, url);
      }

      return json({ error: 'Not found' }, 404, corsHeaders);
    } catch (error) {
      return json(
        { error: 'Internal error', details: String(error?.message || error) },
        500,
        corsHeaders
      );
    }
  }
};

async function handleSignUpload(request, env, corsHeaders, url) {
  assertEnv(env);

  const payload = await request.json();
  const eventId = sanitizeSegment(payload?.eventId);
  const fileName = sanitizeFileName(payload?.fileName);
  const contentType = String(payload?.contentType || 'application/octet-stream').toLowerCase();
  const mediaType = String(payload?.mediaType || '').toLowerCase();

  if (!eventId || !fileName) {
    return json({ error: 'Invalid eventId or fileName' }, 400, corsHeaders);
  }

  if (!['image', 'video'].includes(mediaType)) {
    return json({ error: 'Invalid mediaType' }, 400, corsHeaders);
  }

  if (mediaType === 'image' && !contentType.startsWith('image/')) {
    return json({ error: 'Invalid contentType for image' }, 400, corsHeaders);
  }

  if (mediaType === 'video' && !contentType.startsWith('video/')) {
    return json({ error: 'Invalid contentType for video' }, 400, corsHeaders);
  }

  const path = `event_photos/${eventId}/${fileName}`;
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

  const tokenPayload = {
    path,
    contentType,
    mediaType,
    expiresAt
  };

  const token = await signToken(tokenPayload, env.UPLOAD_SIGNING_SECRET);
  const uploadUrl = `${url.origin}/upload?token=${encodeURIComponent(token)}`;
  const publicBase = String(env.PUBLIC_MEDIA_BASE_URL || '').replace(/\/$/, '');
  const publicUrl = `${publicBase}/${path}`;

  return json(
    {
      uploadUrl,
      publicUrl,
      method: 'PUT',
      headers: {
        'Content-Type': contentType
      },
      path
    },
    200,
    corsHeaders
  );
}

async function handleUploadPut(request, env, corsHeaders, url) {
  assertEnv(env);

  const token = url.searchParams.get('token') || '';
  const verified = await verifyToken(token, env.UPLOAD_SIGNING_SECRET);
  if (!verified.valid) {
    return json({ error: 'Invalid or expired token' }, 401, corsHeaders);
  }

  const { path, contentType, mediaType } = verified.payload;
  const contentLength = Number(request.headers.get('content-length') || '0');

  if (!contentLength || contentLength <= 0) {
    return json({ error: 'Missing content-length' }, 400, corsHeaders);
  }

  if (mediaType === 'video' && contentLength > MAX_VIDEO_SIZE_BYTES) {
    return json({ error: 'Video exceeds max size (12MB)' }, 413, corsHeaders);
  }

  if (contentLength > MAX_ALLOWED_SIZE_BYTES) {
    return json({ error: 'Payload exceeds max size (25MB)' }, 413, corsHeaders);
  }

  const reqContentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (!reqContentType.startsWith(contentType.split(';')[0])) {
    return json({ error: 'Content-Type mismatch' }, 400, corsHeaders);
  }

  await env.EVENTSNAP_MEDIA_BUCKET.put(path, request.body, {
    httpMetadata: {
      contentType
    },
    customMetadata: {
      mediaType,
      uploadedBy: 'eventsnap-worker'
    }
  });

  return json({ ok: true, path }, 200, corsHeaders);
}

function assertEnv(env) {
  if (!env.EVENTSNAP_MEDIA_BUCKET) {
    throw new Error('Missing R2 binding: EVENTSNAP_MEDIA_BUCKET');
  }

  if (!env.UPLOAD_SIGNING_SECRET) {
    throw new Error('Missing secret: UPLOAD_SIGNING_SECRET');
  }

  if (!env.PUBLIC_MEDIA_BASE_URL) {
    throw new Error('Missing var: PUBLIC_MEDIA_BASE_URL');
  }
}

function sanitizeSegment(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,120}$/.test(v)) return '';
  return v;
}

function sanitizeFileName(value) {
  const v = String(value || '').trim();
  if (!/^[a-zA-Z0-9._-]{5,180}$/.test(v)) return '';
  return v;
}

function buildCorsHeaders(request, env) {
  const allowed = String(env.ALLOWED_ORIGINS || '*').split(',').map((o) => o.trim()).filter(Boolean);
  const requestOrigin = request.headers.get('Origin') || '';
  const allowOrigin = allowed.includes('*')
    ? '*'
    : (allowed.includes(requestOrigin) ? requestOrigin : '*');

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

async function signToken(payload, secret) {
  const body = JSON.stringify(payload);
  const bodyBase64 = base64UrlEncode(new TextEncoder().encode(body));
  const signature = await hmacSha256(bodyBase64, secret);
  return `${bodyBase64}.${signature}`;
}

async function verifyToken(token, secret) {
  const [bodyBase64, signature] = String(token || '').split('.');
  if (!bodyBase64 || !signature) return { valid: false };

  const expectedSignature = await hmacSha256(bodyBase64, secret);
  if (expectedSignature !== signature) return { valid: false };

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(bodyBase64)));
  } catch {
    return { valid: false };
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload?.expiresAt || payload.expiresAt < now) return { valid: false };

  return { valid: true, payload };
}

async function hmacSha256(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

function base64UrlEncode(bytes) {
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '==='.slice((base64.length + 3) % 4);
  const bin = atob(padded);
  return new Uint8Array([...bin].map((ch) => ch.charCodeAt(0)));
}


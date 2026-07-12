const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

const SURVEY_STATUSES = new Set(['invited', 'started', 'received', 'submitted', 'analyzing', 'completed']);
const MAX_RECORD_BYTES = 5 * 1024 * 1024;

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (request.method === 'OPTIONS' && url.pathname.startsWith('/wolf/api/')) {
        return new Response(null, { status: 204, headers: JSON_HEADERS });
      }
      if (url.pathname.startsWith('/wolf/api/')) return handleApi(request, env, url);
      if (url.pathname === '/wolf/dashboard' || /^\/wolf\/SUR\d+\/?$/.test(url.pathname)) {
        const shellUrl = new URL('/wolf/index.html', url);
        return env.ASSETS.fetch(new Request(shellUrl, request));
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, error instanceof HttpError ? error.status : 500);
    }
  },
};

async function handleApi(request, env, url) {
  if (!env.WOLF_DB) return json({ error: 'WOLF_DB is not bound to this Pages project.' }, 503);
  const parts = url.pathname.split('/').filter(Boolean);
  // /wolf/api/admin/...
  if (parts[2] === 'admin') return handleAdmin(request, env, url, parts.slice(3));
  // /wolf/api/surveys/SUR01/...
  if (parts[2] === 'surveys' && parts[3]) {
    return handleRecipient(request, env, parts[3].toUpperCase(), parts.slice(4));
  }
  return json({ error: 'Unknown WOLF API route.' }, 404);
}

async function handleAdmin(request, env, url, parts) {
  const supplied = request.headers.get('x-wolf-admin-key') ?? '';
  if (!env.WOLF_ADMIN_KEY || supplied !== env.WOLF_ADMIN_KEY) {
    return json({ error: 'Dashboard authorization required.' }, 401);
  }
  if (parts[0] === 'session' && request.method === 'GET') return json({ ok: true });
  if (parts[0] !== 'surveys') return json({ error: 'Unknown dashboard route.' }, 404);

  if (parts.length === 1 && request.method === 'GET') {
    const result = await env.WOLF_DB.prepare(
      `SELECT code, pack_id, recipient_label, survey_label, status, revision,
              record_json IS NOT NULL AS has_record, created_at, started_at,
              submitted_at, updated_at
         FROM wolf_surveys ORDER BY updated_at DESC`,
    ).all();
    return json({ surveys: result.results ?? [] });
  }

  if (parts.length === 1 && request.method === 'POST') {
    const body = await readJson(request);
    const packId = requiredText(body.packId, 'packId', 200);
    const recipientLabel = requiredText(body.recipientLabel, 'recipientLabel', 200);
    const surveyLabel = requiredText(body.surveyLabel, 'surveyLabel', 200);
    const maximum = await env.WOLF_DB.prepare(
      `SELECT COALESCE(MAX(CAST(SUBSTR(code, 4) AS INTEGER)), 0) AS maximum
         FROM wolf_surveys WHERE code GLOB 'SUR[0-9]*'`,
    ).first();
    const number = Number(maximum?.maximum ?? 0) + 1;
    const code = `SUR${String(number).padStart(2, '0')}`;
    const token = randomToken();
    const tokenHash = await sha256(token);
    const now = new Date().toISOString();
    await env.WOLF_DB.prepare(
      `INSERT INTO wolf_surveys
        (code, pack_id, recipient_label, survey_label, token_hash, status,
         revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'invited', 0, ?, ?)`,
    ).bind(code, packId, recipientLabel, surveyLabel, tokenHash, now, now).run();
    return json({
      code,
      token,
      invitationUrl: `${url.origin}/wolf/${code}#k=${token}`,
      packId,
      recipientLabel,
      surveyLabel,
      status: 'invited',
      createdAt: now,
    }, 201);
  }

  const code = parts[1]?.toUpperCase();
  if (!code || !/^SUR\d+$/.test(code)) return json({ error: 'Invalid survey code.' }, 400);

  if (parts.length === 2 && request.method === 'PATCH') {
    const body = await readJson(request);
    const status = requiredText(body.status, 'status', 32);
    if (!SURVEY_STATUSES.has(status)) return json({ error: 'Invalid workflow status.' }, 400);
    const now = new Date().toISOString();
    const result = await env.WOLF_DB.prepare(
      `UPDATE wolf_surveys SET status = ?, updated_at = ? WHERE code = ?`,
    ).bind(status, now, code).run();
    if (!result.meta?.changes) return json({ error: 'Survey not found.' }, 404);
    return json({ code, status, updatedAt: now });
  }

  if (parts[2] === 'record' && request.method === 'GET') {
    const row = await surveyByCode(env.WOLF_DB, code);
    if (!row) return json({ error: 'Survey not found.' }, 404);
    return json({ code, revision: row.revision, record: parseStoredJson(row.record_json) });
  }

  if (parts[2] === 'analysis' && request.method === 'POST') {
    const row = await surveyByCode(env.WOLF_DB, code);
    if (!row) return json({ error: 'Survey not found.' }, 404);
    const body = await readJson(request);
    const payload = body.payload;
    if (payload === undefined) return json({ error: 'payload is required.' }, 400);
    const encoded = JSON.stringify(payload);
    if (encoded.length > MAX_RECORD_BYTES) return json({ error: 'Analysis return is too large.' }, 413);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.WOLF_DB.batch([
      env.WOLF_DB.prepare(
        `INSERT INTO wolf_analysis_returns (id, survey_code, payload_json, created_at)
         VALUES (?, ?, ?, ?)`,
      ).bind(id, code, encoded, now),
      env.WOLF_DB.prepare(
        `UPDATE wolf_surveys SET status = 'completed', updated_at = ? WHERE code = ?`,
      ).bind(now, code),
    ]);
    return json({ id, code, createdAt: now }, 201);
  }

  return json({ error: 'Unknown dashboard survey route.' }, 404);
}

async function handleRecipient(request, env, code, parts) {
  if (!/^SUR\d+$/.test(code)) return json({ error: 'Invalid survey code.' }, 400);
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return json({ error: 'Invitation token required.' }, 401);
  const row = await surveyByCode(env.WOLF_DB, code);
  if (!row || (await sha256(token)) !== row.token_hash) return json({ error: 'Invitation is invalid or revoked.' }, 403);

  if (parts[0] === 'bootstrap' && request.method === 'GET') {
    const analysis = await latestAnalysis(env.WOLF_DB, code);
    return json({
      code,
      packId: row.pack_id,
      recipientLabel: row.recipient_label,
      surveyLabel: row.survey_label,
      status: row.status,
      revision: row.revision,
      record: parseStoredJson(row.record_json),
      analysis,
    });
  }

  if ((parts[0] === 'sync' && request.method === 'PUT') || (parts[0] === 'submit' && request.method === 'POST')) {
    const body = await readJson(request);
    const record = body.record;
    if (!record || typeof record !== 'object') return json({ error: 'record is required.' }, 400);
    if (record.recordId !== code) return json({ error: 'Record identity does not match this invitation.' }, 409);
    if (record.packId !== row.pack_id) return json({ error: 'Record pack does not match this invitation.' }, 409);
    const baseRevision = Number(body.baseRevision ?? 0);
    if (baseRevision !== Number(row.revision)) {
      return json({
        error: 'A newer server copy exists.',
        conflict: true,
        revision: row.revision,
        record: parseStoredJson(row.record_json),
      }, 409);
    }
    const encoded = JSON.stringify(record);
    if (encoded.length > MAX_RECORD_BYTES) return json({ error: 'Record is too large.' }, 413);
    const now = new Date().toISOString();
    const submitted = parts[0] === 'submit';
    const nextStatus = submitted ? 'submitted' : row.status === 'invited' ? 'started' : row.status;
    const nextRevision = Number(row.revision) + 1;
    await env.WOLF_DB.prepare(
      `UPDATE wolf_surveys
          SET record_json = ?, revision = ?, status = ?,
              started_at = COALESCE(started_at, ?),
              submitted_at = CASE WHEN ? THEN ? ELSE submitted_at END,
              updated_at = ?
        WHERE code = ?`,
    ).bind(encoded, nextRevision, nextStatus, now, submitted ? 1 : 0, now, now, code).run();
    return json({ code, status: nextStatus, revision: nextRevision, updatedAt: now });
  }

  if (parts[0] === 'updates' && request.method === 'GET') {
    return json({ code, status: row.status, revision: row.revision, analysis: await latestAnalysis(env.WOLF_DB, code) });
  }

  return json({ error: 'Unknown recipient route.' }, 404);
}

async function surveyByCode(db, code) {
  return db.prepare(`SELECT * FROM wolf_surveys WHERE code = ?`).bind(code).first();
}

async function latestAnalysis(db, code) {
  const row = await db.prepare(
    `SELECT id, payload_json, created_at FROM wolf_analysis_returns
      WHERE survey_code = ? ORDER BY created_at DESC LIMIT 1`,
  ).bind(code).first();
  return row ? { id: row.id, payload: parseStoredJson(row.payload_json), createdAt: row.created_at } : null;
}

async function readJson(request) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_RECORD_BYTES) throw new HttpError('Request is too large.', 413);
  try {
    return await request.json();
  } catch {
    throw new HttpError('Request body must be valid JSON.', 400);
  }
}

function requiredText(value, field, maximum) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(`${field} is required.`, 400);
  return value.trim().slice(0, maximum);
}

function parseStoredJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const __test = { sha256, randomToken, requiredText };

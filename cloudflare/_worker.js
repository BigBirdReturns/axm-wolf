const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

const SURVEY_STATUSES = new Set(['invited', 'started', 'received', 'submitted', 'analyzing', 'completed', 'revoked']);
const MEMBER_ROLES = new Set(['steward', 'interviewer', 'viewer']);
const MAX_RECORD_BYTES = 5 * 1024 * 1024;
let accessKeyCache = { issuer: '', expiresAt: 0, keys: [] };

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (request.method === 'OPTIONS' && url.pathname.startsWith('/wolf/api/')) {
        return new Response(null, { status: 204, headers: JSON_HEADERS });
      }
      if (url.pathname.startsWith('/wolf/api/')) return await handleApi(request, env, url);
      if (url.pathname === '/wolf/dashboard' || /^\/wolf\/SUR\d+\/?$/.test(url.pathname)) {
        return env.ASSETS.fetch(new Request(new URL('/wolf/', url), request));
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, error instanceof HttpError ? error.status : 500);
    }
  },
};

async function handleApi(request, env, url) {
  if (!env.WOLF_DB) return json({ error: 'WOLF_DB is not bound to this deployment.' }, 503);
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[2] === 'operator') return handleOperator(request, env, url, parts.slice(3));
  if (parts[2] === 'surveys' && parts[3]) return handleRecipient(request, env, parts[3].toUpperCase(), parts.slice(4));
  return json({ error: 'Unknown WOLF API route.' }, 404);
}

async function handleOperator(request, env, url, parts) {
  const identity = await requireOperatorIdentity(request, env);
  if (parts[0] === 'session' && request.method === 'GET') {
    if (identity.isRoot) await ensureRootWorkspace(env.WOLF_DB, identity.email);
    return json({ identity, workspaces: await listWorkspaces(env.WOLF_DB, identity) });
  }

  if (parts[0] === 'workspaces') {
    if (parts.length === 1 && request.method === 'POST') {
      if (!identity.isRoot) throw new HttpError('Only the WOLF owner can create workspaces.', 403);
      const body = await readJson(request);
      const name = requiredText(body.name, 'name', 120);
      const id = crypto.randomUUID();
      const slug = `${slugify(name)}-${id.slice(0, 6)}`;
      const now = new Date().toISOString();
      await env.WOLF_DB.batch([
        env.WOLF_DB.prepare(`INSERT INTO wolf_workspaces (id, name, slug, created_by, created_at) VALUES (?, ?, ?, ?, ?)`).bind(id, name, slug, identity.email, now),
        env.WOLF_DB.prepare(`INSERT INTO wolf_memberships (workspace_id, email, role, status, created_by, created_at) VALUES (?, ?, 'steward', 'active', ?, ?)`).bind(id, identity.email, identity.email, now),
      ]);
      return json({ id, name, slug, role: 'owner' }, 201);
    }

    const workspaceId = parts[1];
    if (!workspaceId) throw new HttpError('Workspace is required.', 400);
    const role = await requireWorkspace(env.WOLF_DB, identity, workspaceId, ['owner', 'steward', 'interviewer', 'viewer']);

    if (parts[2] === 'members' && request.method === 'GET') {
      if (!identity.isRoot && role !== 'steward') throw new HttpError('Workspace steward permission required.', 403);
      return json({ members: await listMembers(env.WOLF_DB, workspaceId) });
    }
    if (parts[2] === 'members' && request.method === 'POST') {
      if (!identity.isRoot && role !== 'steward') throw new HttpError('Workspace steward permission required.', 403);
      const body = await readJson(request);
      const email = normalizeEmail(requiredText(body.email, 'email', 254));
      const memberRole = requiredText(body.role ?? 'interviewer', 'role', 32);
      if (!MEMBER_ROLES.has(memberRole)) throw new HttpError('Invalid member role.', 400);
      if (!identity.isRoot && memberRole === 'steward') throw new HttpError('Only the WOLF owner can appoint another steward.', 403);
      const now = new Date().toISOString();
      await env.WOLF_DB.prepare(
        `INSERT INTO wolf_memberships (workspace_id, email, role, status, created_by, created_at)
         VALUES (?, ?, ?, 'active', ?, ?)
         ON CONFLICT(workspace_id, email) DO UPDATE SET role = excluded.role, status = 'active'`,
      ).bind(workspaceId, email, memberRole, identity.email, now).run();
      return json({ workspaceId, email, role: memberRole, status: 'active' }, 201);
    }

    if (parts[2] === 'surveys' && request.method === 'GET') {
      const result = await env.WOLF_DB.prepare(
        `SELECT s.code, s.workspace_id, s.pack_id, s.recipient_label, s.survey_label, s.status, s.revision,
                s.record_json IS NOT NULL AS has_record,
                EXISTS (SELECT 1 FROM wolf_analysis_returns a WHERE a.survey_code = s.code) AS has_analysis,
                (SELECT a.created_at FROM wolf_analysis_returns a WHERE a.survey_code = s.code ORDER BY a.created_at DESC LIMIT 1) AS analysis_created_at,
                s.analysis_consent, s.analysis_consent_at,
                s.created_at, s.started_at, s.submitted_at, s.updated_at
           FROM wolf_surveys s WHERE s.workspace_id = ? ORDER BY s.updated_at DESC`,
      ).bind(workspaceId).all();
      return json({ surveys: result.results ?? [] });
    }
    if (parts[2] === 'surveys' && request.method === 'POST') {
      if (role === 'viewer') throw new HttpError('Viewer access cannot create interviews.', 403);
      const body = await readJson(request);
      return createSurvey(env.WOLF_DB, url, workspaceId, body);
    }
  }

  if (parts[0] === 'surveys') {
    const code = parts[1]?.toUpperCase();
    if (!code || !/^SUR\d+$/.test(code)) throw new HttpError('Invalid survey code.', 400);
    const row = await surveyByCode(env.WOLF_DB, code);
    if (!row) throw new HttpError('Survey not found.', 404);
    const role = await requireWorkspace(env.WOLF_DB, identity, row.workspace_id, ['owner', 'steward', 'interviewer', 'viewer']);

    if (parts.length === 2 && request.method === 'GET') {
      return json({ code, status: row.status, revision: row.revision, record: parseStoredJson(row.record_json), analysis: await latestAnalysis(env.WOLF_DB, code), analysisConsent: row.analysis_consent === null ? null : Boolean(row.analysis_consent), analysisConsentAt: row.analysis_consent_at });
    }

    if (parts.length === 2 && request.method === 'PATCH') {
      if (role === 'viewer') throw new HttpError('Viewer access cannot change interviews.', 403);
      const body = await readJson(request);
      const status = requiredText(body.status, 'status', 32);
      if (!SURVEY_STATUSES.has(status)) throw new HttpError('Invalid workflow status.', 400);
      const now = new Date().toISOString();
      await env.WOLF_DB.prepare(`UPDATE wolf_surveys SET status = ?, updated_at = ? WHERE code = ?`).bind(status, now, code).run();
      return json({ code, status, updatedAt: now });
    }
    if (parts[2] === 'record' && request.method === 'GET') {
      return json({ code, revision: row.revision, record: parseStoredJson(row.record_json) });
    }
    if (parts[2] === 'analysis' && request.method === 'POST') {
      if (role === 'viewer') throw new HttpError('Viewer access cannot publish analysis.', 403);
      if (row.analysis_consent !== 1) throw new HttpError('The participant did not authorize manual subscription analysis for this interview.', 403);
      const body = await readJson(request);
      if (body.payload === undefined) throw new HttpError('payload is required.', 400);
      validateAnalysisReturnAgainstRecord(body.payload, parseStoredJson(row.record_json));
      const encoded = JSON.stringify(body.payload);
      if (encoded.length > MAX_RECORD_BYTES) throw new HttpError('Analysis return is too large.', 413);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await env.WOLF_DB.batch([
        env.WOLF_DB.prepare(`INSERT INTO wolf_analysis_returns (id, survey_code, payload_json, created_at) VALUES (?, ?, ?, ?)`).bind(id, code, encoded, now),
        env.WOLF_DB.prepare(`UPDATE wolf_surveys SET status = 'completed', updated_at = ? WHERE code = ?`).bind(now, code),
      ]);
      return json({ id, code, createdAt: now }, 201);
    }
  }

  return json({ error: 'Unknown operator route.' }, 404);
}

async function createSurvey(db, url, workspaceId, body) {
  const packId = requiredText(body.packId, 'packId', 200);
  const recipientLabel = requiredText(body.recipientLabel, 'recipientLabel', 200);
  const surveyLabel = requiredText(body.surveyLabel, 'surveyLabel', 200);
  const counterResults = await db.batch([
    db.prepare(`INSERT OR IGNORE INTO wolf_counters (name, value) VALUES ('survey', 0)`),
    db.prepare(`UPDATE wolf_counters SET value = value + 1 WHERE name = 'survey' RETURNING value`),
  ]);
  const number = Number(counterResults[1]?.results?.[0]?.value);
  if (!Number.isInteger(number) || number < 1) throw new HttpError('Unable to allocate an interview code.', 503);
  const code = `SUR${String(number).padStart(2, '0')}`;
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO wolf_surveys (code, workspace_id, pack_id, recipient_label, survey_label, token_hash, status, revision, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'invited', 0, ?, ?)`,
  ).bind(code, workspaceId, packId, recipientLabel, surveyLabel, tokenHash, now, now).run();
  return json({ code, token, invitationUrl: `${url.origin}/wolf/${code}#k=${token}`, packId, recipientLabel, surveyLabel, status: 'invited', createdAt: now }, 201);
}

async function handleRecipient(request, env, code, parts) {
  if (!/^SUR\d+$/.test(code)) return json({ error: 'Invalid survey code.' }, 400);
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return json({ error: 'Invitation token required.' }, 401);
  const row = await surveyByCode(env.WOLF_DB, code);
  if (!row || (await sha256(token)) !== row.token_hash || row.status === 'revoked') return json({ error: 'Invitation is invalid or revoked.' }, 403);

  if (parts[0] === 'bootstrap' && request.method === 'GET') {
    return json({ code, packId: row.pack_id, recipientLabel: row.recipient_label, surveyLabel: row.survey_label, status: row.status, revision: row.revision, record: parseStoredJson(row.record_json), analysis: await latestAnalysis(env.WOLF_DB, code) });
  }
  if ((parts[0] === 'sync' && request.method === 'PUT') || (parts[0] === 'submit' && request.method === 'POST')) {
    if (row.status === 'completed') return json({ error: 'This interview is complete and read-only.' }, 423);
    const body = await readJson(request);
    const record = body.record;
    if (!record || typeof record !== 'object') return json({ error: 'record is required.' }, 400);
    if (record.recordId !== code) return json({ error: 'Record identity does not match this invitation.' }, 409);
    if (record.packId !== row.pack_id) return json({ error: 'Record pack does not match this invitation.' }, 409);
    const baseRevision = Number(body.baseRevision ?? 0);
    if (baseRevision !== Number(row.revision)) return json({ error: 'A newer server copy exists.', conflict: true, revision: row.revision, record: parseStoredJson(row.record_json) }, 409);
    const encoded = JSON.stringify(record);
    if (encoded.length > MAX_RECORD_BYTES) return json({ error: 'Record is too large.' }, 413);
    const now = new Date().toISOString();
    const submitted = parts[0] === 'submit';
    const analysisConsent = submitted ? body.analysisConsent : null;
    if (submitted && typeof analysisConsent !== 'boolean') return json({ error: 'analysisConsent must explicitly be true or false when submitting.' }, 400);
    const nextStatus = submitted ? 'submitted' : row.status === 'invited' ? 'started' : row.status;
    const nextRevision = Number(row.revision) + 1;
    await env.WOLF_DB.prepare(
      `UPDATE wolf_surveys SET record_json = ?, revision = ?, status = ?, started_at = COALESCE(started_at, ?),
              submitted_at = CASE WHEN ? THEN ? ELSE submitted_at END,
              analysis_consent = CASE WHEN ? THEN ? ELSE analysis_consent END,
              analysis_consent_at = CASE WHEN ? THEN ? ELSE analysis_consent_at END,
              updated_at = ? WHERE code = ?`,
    ).bind(encoded, nextRevision, nextStatus, now, submitted ? 1 : 0, now, submitted ? 1 : 0, analysisConsent ? 1 : 0, submitted ? 1 : 0, now, now, code).run();
    return json({ code, status: nextStatus, revision: nextRevision, updatedAt: now });
  }
  if (parts[0] === 'updates' && request.method === 'GET') return json({ code, status: row.status, revision: row.revision, analysis: await latestAnalysis(env.WOLF_DB, code) });
  return json({ error: 'Unknown recipient route.' }, 404);
}

async function requireOperatorIdentity(request, env) {
  if (env.WOLF_TEST_MODE === 'true') {
    const testEmail = request.headers.get('x-wolf-test-email');
    if (testEmail) return makeIdentity(testEmail, env.WOLF_OWNER_EMAIL);
  }
  const token = request.headers.get('cf-access-jwt-assertion') ?? '';
  if (!token) throw new HttpError('Cloudflare Access login required.', 401);
  const claims = await verifyAccessJwt(token, env.CF_ACCESS_TEAM_DOMAIN, env.CF_ACCESS_AUD);
  return makeIdentity(claims.email, env.WOLF_OWNER_EMAIL);
}

function makeIdentity(email, ownerEmail) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new HttpError('Authenticated email is missing.', 401);
  return { email: normalized, isRoot: normalized === normalizeEmail(ownerEmail) };
}

async function verifyAccessJwt(token, teamDomain, audience) {
  if (!teamDomain || !audience) throw new HttpError('Cloudflare Access validation is not configured.', 503);
  const sections = token.split('.');
  if (sections.length !== 3) throw new HttpError('Invalid Access token.', 401);
  const header = JSON.parse(decodeBase64UrlText(sections[0]));
  const claims = JSON.parse(decodeBase64UrlText(sections[1]));
  const issuer = `https://${String(teamDomain).replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  const keys = await accessSigningKeys(issuer);
  const jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk || header.alg !== 'RS256') throw new HttpError('Invalid Access signing key.', 401);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64UrlBytes(sections[2]), new TextEncoder().encode(`${sections[0]}.${sections[1]}`));
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!valid || claims.iss !== issuer || !audiences.includes(audience) || Number(claims.exp) <= now || Number(claims.nbf ?? 0) > now) throw new HttpError('Access login is invalid or expired.', 401);
  return claims;
}

async function accessSigningKeys(issuer) {
  if (accessKeyCache.issuer === issuer && accessKeyCache.expiresAt > Date.now()) return accessKeyCache.keys;
  const response = await fetch(`${issuer}/cdn-cgi/access/certs`);
  if (!response.ok) throw new HttpError('Unable to validate Access login.', 503);
  const keys = (await response.json()).keys ?? [];
  accessKeyCache = { issuer, expiresAt: Date.now() + 5 * 60_000, keys };
  return keys;
}

async function ensureRootWorkspace(db, email) {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO wolf_workspaces (id, name, slug, created_by, created_at) VALUES ('root', 'AXM', 'axm', ?, ?)`).bind(email, now),
    db.prepare(`INSERT OR IGNORE INTO wolf_memberships (workspace_id, email, role, status, created_by, created_at) VALUES ('root', ?, 'steward', 'active', ?, ?)`).bind(email, email, now),
  ]);
}

async function listWorkspaces(db, identity) {
  if (identity.isRoot) {
    const result = await db.prepare(`SELECT id, name, slug, 'owner' AS role FROM wolf_workspaces ORDER BY name`).all();
    return result.results ?? [];
  }
  const result = await db.prepare(
    `SELECT w.id, w.name, w.slug, m.role FROM wolf_workspaces w JOIN wolf_memberships m ON m.workspace_id = w.id WHERE m.email = ? AND m.status = 'active' ORDER BY w.name`,
  ).bind(identity.email).all();
  return result.results ?? [];
}

async function requireWorkspace(db, identity, workspaceId, roles) {
  if (identity.isRoot) return 'owner';
  const row = await db.prepare(`SELECT role FROM wolf_memberships WHERE workspace_id = ? AND email = ? AND status = 'active'`).bind(workspaceId, identity.email).first();
  if (!row || !roles.includes(row.role)) throw new HttpError('You do not have access to this workspace.', 403);
  return row.role;
}

async function listMembers(db, workspaceId) {
  const result = await db.prepare(`SELECT email, role, status, created_at FROM wolf_memberships WHERE workspace_id = ? ORDER BY email`).bind(workspaceId).all();
  return result.results ?? [];
}

async function surveyByCode(db, code) { return db.prepare(`SELECT * FROM wolf_surveys WHERE code = ?`).bind(code).first(); }
async function latestAnalysis(db, code) {
  const row = await db.prepare(`SELECT id, payload_json, created_at FROM wolf_analysis_returns WHERE survey_code = ? ORDER BY created_at DESC LIMIT 1`).bind(code).first();
  return row ? { id: row.id, payload: parseStoredJson(row.payload_json), createdAt: row.created_at } : null;
}
async function readJson(request) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_RECORD_BYTES) throw new HttpError('Request is too large.', 413);
  try { return await request.json(); } catch { throw new HttpError('Request body must be valid JSON.', 400); }
}
function requiredText(value, field, maximum) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(`${field} is required.`, 400);
  return value.trim().slice(0, maximum);
}
function normalizeEmail(value) { return String(value ?? '').trim().toLowerCase(); }
function slugify(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'workspace'; }
function parseStoredJson(value) { if (!value) return null; try { return JSON.parse(value); } catch { return null; } }
function validateAnalysisReturnAgainstRecord(payload, record) {
  if (!record || !Array.isArray(record.responses)) throw new HttpError('This interview has no synchronized testimony to analyze.', 409);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.schemaVersion !== 1 || payload.kind !== 'wolf-survey-analysis-return') {
    throw new HttpError('Analysis return must be schemaVersion 1 and kind wolf-survey-analysis-return.', 400);
  }
  if (!Array.isArray(payload.claims) || payload.claims.length === 0) throw new HttpError('Analysis return must contain at least one cited claim.', 400);
  const frozen = new Map();
  for (const response of record.responses) {
    const revision = Array.isArray(response?.revisions) ? response.revisions.at(-1) : null;
    if (revision) frozen.set(`${record.recordId}|${response.promptId}|${revision.revisionId}`, revision.text);
  }
  for (const claim of payload.claims) {
    if (!claim || typeof claim !== 'object' || typeof claim.claimId !== 'string' || !Array.isArray(claim.sourceReferences) || claim.sourceReferences.length === 0) {
      throw new HttpError('Every analysis claim must have a claimId and source references.', 400);
    }
    for (const reference of claim.sourceReferences) {
      const sourceText = frozen.get(`${reference?.recordId}|${reference?.promptId}|${reference?.revisionId}`);
      if (typeof reference?.quote !== 'string' || !reference.quote || !sourceText || !sourceText.includes(reference.quote)) {
        throw new HttpError(`Analysis claim ${claim.claimId} cites testimony outside the synchronized record.`, 400);
      }
    }
  }
}
function randomToken() {
  const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function decodeBase64UrlText(value) { return new TextDecoder().decode(decodeBase64UrlBytes(value)); }
function decodeBase64UrlBytes(value) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function json(payload, status = 200) { return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS }); }
class HttpError extends Error { constructor(message, status) { super(message); this.status = status; } }

export const __test = { sha256, randomToken, requiredText, makeIdentity, decodeBase64UrlText, validateAnalysisReturnAgainstRecord };

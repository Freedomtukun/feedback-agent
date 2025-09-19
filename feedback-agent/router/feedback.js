'use strict';

const Busboy = require('busboy');
const { performFeedbackFlow } = require('../handlers/feedback_file');
const { error } = require('../utils/logger');

const sendJson = (res, code, body) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

// multipart/file 入口
async function handleFeedbackFile(req, res) {
  const bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 10 * 1024 * 1024 } });
  let fileBuffer = Buffer.alloc(0);
  let mime = 'image/jpeg';
  let poseId = null;

  bb.on('file', (_name, file, info) => {
    if (info && info.mimeType) mime = info.mimeType;
    file.on('data', (d) => fileBuffer = Buffer.concat([fileBuffer, d]));
  });

  bb.on('field', (name, value) => {
    if (name === 'poseId' || name === 'pose_id') poseId = value;
  });

  bb.on('error', (e) => {
    error('BUSBOY', e);
    sendJson(res, 400, { ok: false, error: 'BAD_MULTIPART' });
  });

  bb.on('finish', async () => {
    if (!fileBuffer.length) return sendJson(res, 400, { ok: false, error: 'MISSING_FILE' });
    try {
      const out = await performFeedbackFlow(fileBuffer, mime, { poseId });
      return sendJson(res, 200, out);
    } catch (e) {
      error('FLOW', e);
      return sendJson(res, 500, { ok: false, error: 'FLOW_FAILED', detail: formatError(e) });
    }
  });

  req.pipe(bb);
}

// JSON/base64 入口
async function handleFeedbackBase64(req, res) {
  try {
    const body = extractJsonBody(req);
    const rawField = body.image_base64 || body.imageBase64 || '';
    const b64 = rawField.replace(/^data:image\/[^;]+;base64,/, '').trim();
    if (!b64) return sendJson(res, 400, { ok: false, error: 'MISSING_IMAGE_BASE64' });

    const normalizedB64 = normalizeBase64(b64);
    if (!normalizedB64) {
      return sendJson(res, 400, { ok: false, error: 'INVALID_IMAGE_BASE64' });
    }

    const mime = body.mime || 'image/jpeg';
    const buffer = Buffer.from(normalizedB64, 'base64');

    try {
      const out = await performFeedbackFlow(buffer, mime, { poseId: body.poseId || body.pose_id || null });
      return sendJson(res, 200, out);
    } catch (flowErr) {
      error('FLOW', flowErr);
      return sendJson(res, 500, { ok: false, error: 'FLOW_FAILED', detail: formatError(flowErr) });
    }
  } catch (e) {
    error('PARSE_JSON', e);
    return sendJson(res, 400, { ok: false, error: 'BAD_JSON' });
  }
}

function extractJsonBody(req) {
  const raw = req.body;
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  if (typeof raw === 'string' && raw.length) return JSON.parse(raw);
  if (Buffer.isBuffer(raw) && raw.length) return JSON.parse(raw.toString('utf8'));
  return {};
}

function normalizeBase64(value) {
  if (!value || typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return null;

  const mod = clean.length % 4;
  if (mod === 1) return null;
  if (mod === 0) return clean;
  return clean + '='.repeat(4 - mod);
}

function formatError(err) {
  if (!err) return null;
  if (err instanceof Error) {
    const stage = err.stage ? ` (${err.stage})` : '';
    return `${err.message}${stage}`;
  }
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const stage = err.stage ? ` (${err.stage})` : '';
    if (typeof err.message === 'string' && err.message.length) return `${err.message}${stage}`;
    try { return `${JSON.stringify(err)}${stage}`; } catch (_) { return `${String(err)}${stage}`; }
  }
  return String(err);
}

module.exports = { handleFeedbackBase64, handleFeedbackFile };

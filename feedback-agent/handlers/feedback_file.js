'use strict';
const Busboy = require('busboy');
const FormData = require('form-data');
const { http } = require('../services/http_client');
const { ttsMaybe } = require('../services/tts_gate');
const { normalize } = require('../utils/normalize');

exports.handle = async (event) => {
  const scoreUrl = process.env.SCORE_URL;
  if (!scoreUrl) return { ok:false, error:'MISSING_SCORE_URL' };

  const parsed = await parseMultipart(event);
  if (!parsed.file) return { ok:false, error:'FILE_MISSING' };

  const fd = new FormData();
  fd.append('file', parsed.file.buffer, {
    filename: parsed.file.filename || 'upload.jpg',
    contentType: parsed.file.mimetype || 'image/jpeg'
  });
  if (parsed.fields.poseId) fd.append('poseId', parsed.fields.poseId);

  const start = Date.now();
  try {
    const res = await http().post(scoreUrl, fd, { headers: fd.getHeaders() });
    const norm = await normalize(res.data, {
      retryOnPose: true,
      scoreUrl,
      makeFormData: (pose) => {
        const fd2 = new FormData();
        fd2.append('file', parsed.file.buffer, { filename: parsed.file.filename||'upload.jpg', contentType: parsed.file.mimetype||'image/jpeg' });
        fd2.append('poseId', pose);
        return fd2;
      }
    });

    if (norm.ok && norm.advice && process.env.ENABLE_TTS === '1') {
      const tts = await ttsMaybe(norm.advice);
      if (tts?.audio_base64) norm.audio_base64 = tts.audio_base64;
    }

    if (process.env.ALLOW_DIAG === '1') norm._raw = res.data;
    norm.latency_ms = Date.now() - start;
    return norm;
  } catch (e) {
    return { ok:false, error:'UPSTREAM_FAIL', detail:e.message, status:e.status, _upstream:e.data };
  }
};

async function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const result = { fields: {}, file: null };
    try {
      const headers = event.headers || {};
      const contentType = headers['content-type'] || headers['Content-Type'] || '';
      const bb = Busboy({ headers: { 'content-type': contentType } });

      bb.on('file', (_name, stream, filename, _enc, mimetype) => {
        const chunks = [];
        stream.on('data', d => chunks.push(d));
        stream.on('end', () => { result.file = { filename, mimetype, buffer: Buffer.concat(chunks) }; });
      });
      bb.on('field', (name, val) => { result.fields[name] = val; });
      bb.on('finish', () => resolve(result));
      bb.on('error', reject);

      const body = event.body || '';
      const buf = Buffer.isBuffer(body) ? body :
        (event.isBase64Encoded ? Buffer.from(body, 'base64') : Buffer.from(body));
      bb.end(buf);
    } catch (e) { reject(e); }
  });
}
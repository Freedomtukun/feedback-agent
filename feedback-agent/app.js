'use strict';
const { corsHeaders, isPreflight } = require('./utils/cors');

const json = (code, obj) => ({
  isBase64Encoded: false,
  statusCode: code,
  headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  body: JSON.stringify(obj)
});

exports.handleRequest = async (event) => {
  try {
    const method = (event.httpMethod || event.method || 'GET').toUpperCase();
    const path = event.path || event.requestContext?.path || '/';
    const headers = event.headers || {};
    const ct = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();

    if (isPreflight(method)) return { isBase64Encoded:false, statusCode:204, headers:corsHeaders(), body:'' };
    if (path !== '/api/feedback') return json(404, { ok:false, error:'ROUTE_NOT_FOUND', path });

    let action = null;
    if (ct.startsWith('multipart/form-data')) action = 'file';
    else {
      let bodyObj = {};
      try {
        bodyObj = (event.body && typeof event.body === 'string') ? JSON.parse(event.body) : (event.body || {});
      } catch (_) {}
      action = bodyObj.action || event.queryStringParameters?.action || null;
      if (!action && method === 'POST' && (bodyObj.image_url || bodyObj.image_base64)) action = 'score';
      if (!action && method === 'GET') action = 'health';
    }

    if (action === 'health') { const h = require('./handlers/health');       return json(200, await h.handle(event)); }
    if (action === 'diag')   { const h = require('./handlers/diag_http');    return json(200, await h.handle(event)); }
    if (action === 'score')  { const h = require('./handlers/feedback');     return json(200, await h.handle(event)); }
    if (action === 'file')   { const h = require('./handlers/feedback_file');return json(200, await h.handle(event)); }

    return json(400, { ok:false, error:'MISSING_ACTION', hint:'use action=health|diag|score or send multipart for file' });
  } catch (err) {
    console.error('[APP] Uncaught:', err);
    return json(500, { ok:false, error:'INTERNAL', detail: String(err?.message || err) });
  }
};
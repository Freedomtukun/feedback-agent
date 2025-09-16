'use strict';
const { handleRequest } = require('./app');

console.log('[SENTINEL] index.js loaded at', new Date().toISOString());

async function main(event) {
  if (process.env.PURE_MODE === '1') {
    return {
      isBase64Encoded: false,
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, note: 'pure index (set PURE_MODE=0 to exit)' })
    };
  }
  return await handleRequest(event);
}

// Publish every alias the deployment platforms may look for.
exports.main = main;
exports.handler = main;
exports.main_handler = main;

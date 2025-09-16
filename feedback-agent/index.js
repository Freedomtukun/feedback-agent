'use strict';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST'
};

async function main_handler(event = {}) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      isBase64Encoded: false,
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  return {
    isBase64Encoded: false,
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ ok: true })
  };
}

exports.main_handler = main_handler;
exports.main = main_handler;
exports.handler = main_handler;

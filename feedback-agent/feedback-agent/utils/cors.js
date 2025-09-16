'use strict';
exports.corsHeaders = () => {
  const origins = (process.env.CORS_ORIGINS || '*');
  return {
    'Access-Control-Allow-Origin': origins,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization'
  };
};
exports.isPreflight = (method) => method === 'OPTIONS';

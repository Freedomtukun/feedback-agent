'use strict';

const serverless = require('serverless-http');
const app = require('./app');

// 开启二进制类型，确保 multipart/图片不被吃掉
const handler = serverless(app, {
  binary: [
    'multipart/form-data',
    'application/octet-stream',
    'image/jpeg',
    'image/png',
    '*/*'
  ]
});

async function main_handler(event, context) {
  return handler(event, context);
}

exports.main_handler = main_handler;
exports.main = main_handler;
exports.handler = main_handler;

'use strict';

const express = require('express');
const app = express();

// JSON / x-www-form-urlencoded（multipart 由 Busboy 在路由中处理）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 统一 CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// 打印进入的请求，方便排查路由匹配问题
app.use((req, _res, next) => {
  console.info(`[IN] ${req.method} ${req.originalUrl}`);
  next();
});

// 将 /api/feedback-file 重写为标准路径，避免网关路径遗漏造成 404
app.use((req, _res, next) => {
  if (req.method === 'POST' && (req.path === '/api/feedback-file' || req.originalUrl === '/api/feedback-file')) {
    const queryIndex = req.url.indexOf('?');
    const query = queryIndex >= 0 ? req.url.slice(queryIndex) : '';
    req.url = `/api/feedback/file${query}`;
  }
  next();
});

// 健康检查
app.get('/api/feedback/health', (_req, res) =>
  res.status(200).json({ ok: true, ts: Date.now() })
);

// 反馈主流程（两种入口）
const { handleFeedbackBase64, handleFeedbackFile } = require('./router/feedback');
app.post('/api/feedback', handleFeedbackBase64);      // JSON: {image_base64}
app.post('/api/feedback/file', handleFeedbackFile);   // multipart: file=@...
app.post('/api/feedback-file', handleFeedbackFile);   // legacy alias

// 根路径返回可用路由列表，避免输出 HTML 404
app.get('/', (_req, res) => {
  res.json({
    ok: true,
    routes: [
      'GET  /api/feedback/health',
      'POST /api/feedback',
      'POST /api/feedback/file'
    ]
  });
});

// JSON 404 兜底，便于定位网关或路由配置问题
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'NOT_FOUND',
    detail: `No route for ${req.method} ${req.originalUrl}`,
    summary: '路径未匹配，请检查网关配置',
    advice: '确保 API Gateway 的 Path Match 为 /api/feedback/* 并且不重写路径'
  });
});

// 本地调试用：SCF 环境不要 listen
if (process.env.NODE_ENV === 'local') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`[local] listening on ${port}`));
}

module.exports = app;

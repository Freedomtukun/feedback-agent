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

// 健康检查
app.get('/api/feedback/health', (_req, res) =>
  res.status(200).json({ ok: true, ts: Date.now() })
);

// 反馈主流程（两种入口）
const { handleFeedbackBase64, handleFeedbackFile } = require('./router/feedback');
app.post('/api/feedback', handleFeedbackBase64);      // JSON: {image_base64}
app.post('/api/feedback/file', handleFeedbackFile);   // multipart: file=@...
app.post('/api/feedback-file', handleFeedbackFile);   // legacy alias

// 本地调试用：SCF 环境不要 listen
if (process.env.NODE_ENV === 'local') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`[local] listening on ${port}`));
}

module.exports = app;

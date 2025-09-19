'use strict';
const FormData = require('form-data');
const { http } = require('../services/http_client');
const { ttsMaybe } = require('../services/tts_gate');
const { normalize } = require('../utils/normalize');

exports.handle = async (event) => {
  const scoreUrl = process.env.SCORE_URL;
  if (!scoreUrl) return { ok:false, error:'MISSING_SCORE_URL' };

  let body = {};
  try { body = (event.body && typeof event.body === 'string') ? JSON.parse(event.body) : (event.body||{}); } catch(_){}
  const { image_url, image_base64, poseId } = body;
  if (!image_url && !image_base64) return { ok:false, error:'MISSING_IMAGE' };

  // 将 JSON 组装为 multipart 转发给上游（兼容期）
  const fd = new FormData();
  if (image_url)    fd.append('image_url', image_url);
  if (image_base64) fd.append('image_base64', image_base64);
  if (poseId)       fd.append('poseId', poseId);

  const start = Date.now();
  try {
    const res = await http().post(scoreUrl, fd, { headers: fd.getHeaders() });
    // 如果上游报 poseId 缺失 → 自动补一次
    const norm = await normalize(res.data, {
      retryOnPose: true,
      scoreUrl,
      makeFormData: (pose) => {
        const fd2 = new FormData();
        if (image_url)    fd2.append('image_url', image_url);
        if (image_base64) fd2.append('image_base64', image_base64);
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
'use strict';

const { detectAndScore } = require('../services/score_client');
const { drawSkeleton } = require('../utils/skeleton');
const { putSkeletonIfPossible } = require('../services/storage');
const { genAdviceAndSummary } = require('../utils/textgen');
const { synthSpeechIfEnabled } = require('../services/tts_client');

const DEADLINE_MS = Number(process.env.GLOBAL_DEADLINE_MS || 28000);

// 简单总超时
function withDeadline(promise, ms, stage) {
  let timer;
  const guarded = Promise.resolve(promise).finally(() => clearTimeout(timer));
  const watchdog = new Promise((_, rej) => {
    timer = setTimeout(() => {
      const err = new Error('GLOBAL_DEADLINE_EXCEEDED');
      if (stage) err.stage = stage;
      rej(err);
    }, ms);
  });
  return Promise.race([guarded, watchdog]);
}

async function performFeedbackFlow(imageBuffer, mime) {
  const t0 = Date.now();

  // 1) 评分 + 关键点（本地优先）
  const scoreRes = await withDeadline(detectAndScore(imageBuffer, mime), Math.floor(DEADLINE_MS * 0.6), 'score');
  const { score, keypoints, skeleton_url: backendSkeletonUrl, advice: backendAdvice } = scoreRes;

  // 2) 骨架图（如果评分端没给 URL）
  let skeletonUrl = backendSkeletonUrl || null;
  let skeletonBase64 = null;
  if (!skeletonUrl && keypoints && keypoints.length) {
    const drawn = await drawSkeleton(imageBuffer, keypoints);
    const put = await putSkeletonIfPossible(drawn.buffer, mime);
    if (put && put.url) skeletonUrl = put.url;
    else skeletonBase64 = `data:${mime};base64,${drawn.buffer.toString('base64')}`;
  }

  // 3) 文字建议 & summary（如果评分端没有）
  const textPack = backendAdvice
    ? { advice: backendAdvice, summary: await genAdviceAndSummary(null, score).then(r => r.summary), source: 'score_backend' }
    : await genAdviceAndSummary({ keypoints, score }, score);

  // 4) 语音（可选）
  const ttsEnabled = String(process.env.ENABLE_TTS || '1') === '1';
  let audio_base64 = null, ttsSource = null;
  if (ttsEnabled) {
    const speech = await synthSpeechIfEnabled(`${textPack.summary}。${(textPack.advice || []).join('；')}`);
    audio_base64 = speech?.audio_base64 || null;
    ttsSource = speech?.source || null;
  }

  return {
    ok: true,
    score: Math.round(score),
    advice: textPack.advice || [],
    summary: textPack.summary || '',
    audio_base64,
    skeletonUrl,
    skeletonBase64,
    timing: { total_ms: Date.now() - t0 },
    source: { score: scoreRes.source, text: textPack.source, tts: ttsSource }
  };
}

module.exports = { performFeedbackFlow };

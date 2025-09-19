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

async function performFeedbackFlow(imageBuffer, mime, options = {}) {
  const t0 = Date.now();

  // 1) 评分 + 关键点（本地优先）
  const reserveForTail = Math.max(3000, Math.floor(DEADLINE_MS * 0.15));
  const rawScoreBudget = DEADLINE_MS - reserveForTail;
  const scoreBudgetMs = Math.max(500, Math.min(DEADLINE_MS - 500, rawScoreBudget));
  const defaultPoseId = process.env.DEFAULT_POSE_ID || null;
  const poseIdForScore = options.poseId || defaultPoseId;

  const scoreRes = await withDeadline(
    detectAndScore(imageBuffer, mime, { budgetMs: scoreBudgetMs, poseId: poseIdForScore }),
    scoreBudgetMs,
    'score'
  );
  const {
    score,
    keypoints,
    skeleton_url: backendSkeletonUrl,
    advice: backendAdvice,
    poseId,
    poseName,
    detections
  } = scoreRes;
  const effectivePoseId = poseId || poseIdForScore || null;

  const numericScore = Number.isFinite(score) ? Number(score.toFixed(1)) : 0;
  const adviceFromBackend = normalizeAdviceList(backendAdvice);

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
  const textCtx = {
    score: numericScore,
    poseId: effectivePoseId,
    poseName,
    detections,
    keypoints,
    existingAdvice: adviceFromBackend
  };

  const llmPack = await genAdviceAndSummary(textCtx);
  const llmAdviceList = normalizeAdviceList(llmPack.advice);
  const adviceList = adviceFromBackend.length ? adviceFromBackend : llmAdviceList;
  const summary = llmPack.summary || '';
  const textSource = adviceFromBackend.length && llmPack.source
    ? `score_backend+${llmPack.source}`
    : (adviceFromBackend.length ? 'score_backend' : llmPack.source);

  // 4) 语音（可选）
  const ttsEnabled = String(process.env.ENABLE_TTS || '1') === '1';
  let audio_base64 = null, ttsSource = null;
  if (ttsEnabled) {
    const speechText = buildSpeechText(summary, adviceList);
    const speech = await synthSpeechIfEnabled(speechText);
    audio_base64 = speech?.audio_base64 || null;
    ttsSource = speech?.source || null;
  }

  return {
    ok: true,
    score: numericScore,
    advice: adviceList.join('；'),
    adviceList,
    summary,
    audio_base64,
    skeletonUrl,
    skeletonBase64,
    timing: { total_ms: Date.now() - t0 },
    source: { score: scoreRes.source, text: textSource, tts: ttsSource }
  };
}

function normalizeAdviceList(advice) {
  if (!advice) return [];
  if (Array.isArray(advice)) return advice.filter(Boolean).map((s) => String(s));
  if (typeof advice === 'string') return advice.split(/[,，；;\n]/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function buildSpeechText(summary, adviceList) {
  const parts = [];
  if (summary) parts.push(summary);
  if (adviceList && adviceList.length) parts.push(adviceList.join('；'));
  return parts.join('。');
}

module.exports = { performFeedbackFlow };

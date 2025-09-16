'use strict';

const FormData = require('form-data');
const { http } = require('./http_client');

const SCORE_URL = process.env.SCORE_URL;                     // 本地评分
const SCORE_TIMEOUT_MS = Number(process.env.SCORE_TIMEOUT_MS || 10000);
const SCORE_TOKEN = process.env.SCORE_TOKEN || null;

const REMOTE_ENABLED = String(process.env.REMOTE_MODEL_ENABLED || 'false') === 'true';
const REMOTE_URL = process.env.REMOTE_MODEL_URL;             // 远端评分
const REMOTE_TIMEOUT = Number(process.env.REMOTE_MODEL_TIMEOUT || 10000);

function normalize(resp) {
  // 允许多种后端字段名映射为统一结构
  const score = typeof resp.score === 'number' ? resp.score
              : (typeof resp.result?.score === 'number' ? resp.result.score : NaN);

  let keypoints = resp.keypoints || resp.points || resp.keypoints2d || resp.result?.keypoints || [];
  // 如果是 [[x,y,score], ...] 也转成 {x,y,score}
  if (Array.isArray(keypoints) && keypoints.length && Array.isArray(keypoints[0])) {
    keypoints = keypoints.map(([x, y, s]) => ({ x, y, score: s ?? 1 }));
  }

  return {
    score: isNaN(score) ? 0 : score,
    keypoints,
    advice: resp.advice || resp.result?.advice || null,
    skeleton_url: resp.skeletonUrl || resp.skeleton_url || resp.result?.skeletonUrl || null
  };
}

async function callScore(url, buf, mime, timeout) {
  const fd = new FormData();
  fd.append('file', buf, { filename: 'pose.jpg', contentType: mime });

  const headers = Object.assign({}, fd.getHeaders());
  if (SCORE_TOKEN) headers.Authorization = `Bearer ${SCORE_TOKEN}`;

  const { body } = await http({ method: 'POST', url, headers, data: fd, timeout });
  if (!body) throw new Error('EMPTY_SCORE_BODY');
  const norm = normalize(body);
  if (typeof norm.score !== 'number') throw new Error('BAD_SCORE_PAYLOAD');
  return norm;
}

async function detectAndScore(buf, mime) {
  const localFirst = String(process.env.LOCAL_FIRST || 'true') === 'true';
  let lastErr = null;

  const tryLocal = async () => {
    if (!SCORE_URL) throw annotateStage(new Error('NO_LOCAL_SCORE_URL'), 'score_local_config');
    const res = await callScore(SCORE_URL, buf, mime, SCORE_TIMEOUT_MS);
    return Object.assign({ source: 'local' }, res);
  };

  const tryRemote = async () => {
    if (!REMOTE_ENABLED || !REMOTE_URL) throw annotateStage(new Error('REMOTE_DISABLED'), 'score_remote_config');
    const res = await callScore(REMOTE_URL, buf, mime, REMOTE_TIMEOUT);
    return Object.assign({ source: 'remote' }, res);
  };

  if (localFirst) {
    try { return await tryLocal(); } catch (e) { lastErr = annotateStage(e, 'score_local'); }
    try { return await tryRemote(); } catch (e) { lastErr = annotateStage(e, 'score_remote'); }
  } else {
    try { return await tryRemote(); } catch (e) { lastErr = annotateStage(e, 'score_remote'); }
    try { return await tryLocal(); } catch (e) { lastErr = annotateStage(e, 'score_local'); }
  }

  const finalErr = lastErr || annotateStage(new Error('SCORE_ALL_FAILED'), 'score');
  throw finalErr;
}

function annotateStage(err, stage) {
  if (!err) return err;
  try {
    if (err instanceof Error) {
      if (!err.stage) err.stage = stage;
    } else if (typeof err === 'object' && !err.stage) {
      err.stage = stage;
    }
  } catch (_) {
    // ignore stage annotation failures
  }
  return err;
}

module.exports = { detectAndScore };

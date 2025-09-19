'use strict';

const FormData = require('form-data');
const { http } = require('./http_client');

const SCORE_URL = process.env.SCORE_URL;                     // 本地评分
const SCORE_TIMEOUT_MS = Number(process.env.SCORE_TIMEOUT_MS || 10000);
const SCORE_TOKEN = process.env.SCORE_TOKEN || null;
const SCORE_RETRIES = Number.isFinite(Number(process.env.SCORE_RETRIES || process.env.SCORE_RETRY))
  ? Number(process.env.SCORE_RETRIES || process.env.SCORE_RETRY)
  : 0;

const REMOTE_ENABLED = String(process.env.REMOTE_MODEL_ENABLED || 'false') === 'true';
const REMOTE_URL = process.env.REMOTE_MODEL_URL;             // 远端评分
const REMOTE_TIMEOUT = Number(process.env.REMOTE_MODEL_TIMEOUT || 10000);

const PICK_SOURCES = (resp) => [resp, resp?.result, resp?.data];

function pickField(resp, candidates) {
  if (!resp) return undefined;
  const sources = PICK_SOURCES(resp);
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) {
        return src[key];
      }
    }
  }
  return undefined;
}

function normalize(resp) {
  // 允许多种后端字段名映射为统一结构
  const rawScore = pickField(resp, ['score', 'value']);
  const score = Number.isFinite(Number(rawScore)) ? Number(rawScore) : 0;

  let keypoints = pickField(resp, ['keypoints', 'keypoints2d', 'points']);
  if (!Array.isArray(keypoints)) keypoints = [];
  // 如果是 [[x,y,score], ...] 也转成 {x,y,score}
  if (keypoints.length && Array.isArray(keypoints[0])) {
    keypoints = keypoints.map(([x, y, s]) => ({ x, y, score: s ?? 1 }));
  }

  const advice = pickField(resp, ['advice', 'message', 'msg']);
  const skeletonUrl = pickField(resp, ['skeletonUrl', 'skeleton_url', 'skeleton']);
  const poseIdRaw = pickField(resp, ['poseId', 'pose_id', 'pose']);
  const poseNameRaw = pickField(resp, ['poseName', 'pose_name', 'poseTitle']);
  const detections = pickField(resp, ['analysis', 'details', 'problems', 'issues', 'highlights']);

  return {
    score,
    keypoints,
    advice,
    skeleton_url: skeletonUrl || null,
    poseId: poseIdRaw != null ? String(poseIdRaw) : null,
    poseName: poseNameRaw != null ? String(poseNameRaw) : null,
    detections
  };
}

async function callScore(url, buf, mime, timeout, extra = {}) {
  const fd = new FormData();
  fd.append('file', buf, { filename: 'pose.jpg', contentType: mime });
  if (extra.poseId) fd.append('poseId', extra.poseId);

  const headers = Object.assign({}, fd.getHeaders());
  if (SCORE_TOKEN) headers.Authorization = `Bearer ${SCORE_TOKEN}`;

  const requestOptions = { method: 'POST', url, headers, data: fd, timeout };
  if (Number.isFinite(SCORE_RETRIES) && SCORE_RETRIES >= 0) {
    requestOptions['axios-retry'] = { retries: SCORE_RETRIES };
  }

  const { body } = await http(requestOptions);
  if (!body) throw new Error('EMPTY_SCORE_BODY');
  const norm = normalize(body);
  if (typeof norm.score !== 'number') throw new Error('BAD_SCORE_PAYLOAD');
  return norm;
}

async function detectAndScore(buf, mime, opts = {}) {
  const localFirst = String(process.env.LOCAL_FIRST || 'true') === 'true';
  let lastErr = null;
  const startTs = Date.now();
  const budgetMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : null;

  const remainingBudget = () => {
    if (!budgetMs) return null;
    return Math.max(budgetMs - (Date.now() - startTs), 0);
  };

  const pickTimeout = (base) => {
    if (!budgetMs) return base;
    const remaining = remainingBudget();
    if (remaining === null) return base;
    if (remaining <= 0) return 0;
    if (remaining < 1000) return remaining;
    return Math.min(base, remaining);
  };

  const tryLocal = async () => {
    if (!SCORE_URL) throw annotateStage(new Error('NO_LOCAL_SCORE_URL'), 'score_local_config');
    const timeout = pickTimeout(SCORE_TIMEOUT_MS);
    if (timeout <= 0) throw annotateStage(new Error('NO_SCORE_BUDGET_LEFT'), 'score_budget');
    const res = await callScore(SCORE_URL, buf, mime, timeout, { poseId: opts.poseId });
    return Object.assign({ source: 'local' }, res);
  };

  const tryRemote = async () => {
    if (!REMOTE_ENABLED || !REMOTE_URL) throw annotateStage(new Error('REMOTE_DISABLED'), 'score_remote_config');
    const timeout = pickTimeout(REMOTE_TIMEOUT);
    if (timeout <= 0) throw annotateStage(new Error('NO_SCORE_BUDGET_LEFT'), 'score_budget');
    const res = await callScore(REMOTE_URL, buf, mime, timeout, { poseId: opts.poseId });
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

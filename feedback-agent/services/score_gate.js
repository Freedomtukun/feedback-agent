'use strict';

const FormData = require('form-data');
const { createHttpClient } = require('./http_client');
const { info, warn, error } = require('../utils/logger');

const SCORE_URL = process.env.SCORE_URL;
const SCORE_TIMEOUT_MS = readNumber(process.env.SCORE_TIMEOUT_MS);
const SOFT_TIMEOUT_MS = readNumber(process.env.SOFT_TIMEOUT_MS);
const REMOTE_LLM_URL = process.env.REMOTE_LLM_URL;
const REMOTE_LLM_KEY = process.env.REMOTE_LLM_KEY;
const LOCAL_FIRST = parseBoolean(process.env.LOCAL_FIRST, true);

let localClient;
let remoteClient;

const getLocalClient = () => {
  if (!localClient) {
    localClient = createHttpClient({
      timeoutMs: SCORE_TIMEOUT_MS,
      tokenEnv: 'SCORE_TOKEN',
    });
  }
  return localClient;
};

const getRemoteClient = () => {
  if (!remoteClient) {
    remoteClient = createHttpClient({
      timeoutMs: SCORE_TIMEOUT_MS,
      tokenEnv: REMOTE_LLM_KEY ? undefined : 'SCORE_TOKEN',
      token: REMOTE_LLM_KEY || undefined,
      tokenHeader: REMOTE_LLM_KEY ? 'x-api-key' : 'Authorization',
      tokenPrefix: REMOTE_LLM_KEY ? '' : 'Bearer ',
    });
  }
  return remoteClient;
};

const scorePose = async ({ buffer, filename, mimetype }) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid buffer for scoring');
  }

  const attempts = buildAttempts({ buffer, filename, mimetype });
  for (const attempt of attempts) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await attempt.run();
      if (result) return result;
    } catch (err) {
      warn(`Scoring attempt failed via ${attempt.name}`, err?.message || err);
    }
  }

  return null;
};

const buildAttempts = (file) => {
  const list = [];
  const localAttempt = {
    name: 'local-score',
    run: () => withSoftTimeout(localScoreRequest(file), SOFT_TIMEOUT_MS),
  };

  const remoteAttempt = {
    name: 'remote-score',
    run: () => remoteScoreRequest(file),
  };

  if (LOCAL_FIRST) {
    if (SCORE_URL) list.push(localAttempt);
    if (REMOTE_LLM_URL) list.push(remoteAttempt);
  } else {
    if (REMOTE_LLM_URL) list.push(remoteAttempt);
    if (SCORE_URL) list.push(localAttempt);
  }

  return list;
};

const localScoreRequest = async ({ buffer, filename, mimetype }) => {
  if (!SCORE_URL) {
    warn('SCORE_URL is missing for local scoring');
    return null;
  }

  const client = getLocalClient();
  const form = new FormData();
  form.append('file', buffer, { filename: filename || 'pose.jpg', contentType: mimetype || 'application/octet-stream' });

  info('Dispatching local scoring request');
  const response = await client.post(SCORE_URL, form, { headers: form.getHeaders() });
  if (!isSuccess(response.status)) {
    warn('Local scoring responded with non-success status', { status: response.status, data: response.data });
    return null;
  }

  return normalizeScore(response.data);
};

const remoteScoreRequest = async ({ buffer }) => {
  if (!REMOTE_LLM_URL) {
    return null;
  }
  const client = getRemoteClient();
  const payload = {
    image_base64: buffer.toString('base64'),
  };

  info('Dispatching remote scoring request');
  const response = await client.post(REMOTE_LLM_URL, payload);
  if (!isSuccess(response.status)) {
    warn('Remote scoring responded with non-success status', { status: response.status, data: response.data });
    return null;
  }
  return normalizeScore(response.data);
};

const normalizeScore = (data) => {
  if (!data) return null;
  const score = toScore(data);
  const advice = getField(data, ['advice', 'msg', 'message']);
  const skeletonUrl = getField(data, ['skeleton', 'skeletonUrl', 'skeleton_url']);

  if (score === null && !advice) {
    error('Scoring response missing expected fields', data);
    return null;
  }

  return {
    ok: true,
    score,
    advice: advice || '',
    skeletonUrl: skeletonUrl || null,
  };
};

const toScore = (data) => {
  const raw = getField(data, ['score', 'result', 'value']);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const getField = (obj, keys) => {
  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      return obj[key];
    }
  }
  return null;
};

const withSoftTimeout = async (promise, timeout) => {
  const softTimeout = readNumber(timeout);
  if (!softTimeout) return promise;
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('SOFT_TIMEOUT')), softTimeout);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const isSuccess = (status) => status >= 200 && status < 300;

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function readNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

module.exports = {
  scorePose,
};

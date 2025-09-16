'use strict';

const { createHttpClient } = require('./http_client');
const { info, warn } = require('../utils/logger');

const TTS_BASE = process.env.TTS_BASE;
const TTS_HTTP_PATH = (process.env.TTS_HTTP_PATH || '/v1/tts').replace(/\/+/g, '/');
const TTS_TIMEOUT_MS = readNumber(process.env.TTS_TIMEOUT_MS) || 10000;
const VOICE = process.env.VOICE || 'default';
const VOICE_STEP_TIMEOUT_MS = readNumber(process.env.VOICE_STEP_TIMEOUT_MS);
const VOICE_TOTAL_DEADLINE_MS = readNumber(process.env.VOICE_TOTAL_DEADLINE_MS);

let ttsClient;

const getClient = () => {
  if (!ttsClient) {
    ttsClient = createHttpClient({
      baseURL: TTS_BASE,
      timeoutMs: TTS_TIMEOUT_MS,
      tokenEnv: 'TTS_TOKEN',
    });
  }
  return ttsClient;
};

const speak = async (text) => {
  if (!text || typeof text !== 'string') return null;
  if (!TTS_BASE) {
    warn('TTS_BASE missing, skip generating audio');
    return null;
  }

  const client = getClient();
  const payload = buildPayload(text);
  const url = composeUrl(TTS_BASE, TTS_HTTP_PATH);
  const response = await client.post(url, payload);
  if (response.status < 200 || response.status >= 300) {
    warn('TTS service returned non-success status', { status: response.status, data: response.data });
    return null;
  }

  const audio = extractAudio(response.data);
  if (!audio) {
    warn('TTS response missing audio');
    return null;
  }

  info('Generated speech for feedback');
  return audio;
};

const buildPayload = (text) => {
  const payload = { text, voice: VOICE };
  if (VOICE_STEP_TIMEOUT_MS) payload.step_timeout_ms = VOICE_STEP_TIMEOUT_MS;
  if (VOICE_TOTAL_DEADLINE_MS) payload.total_timeout_ms = VOICE_TOTAL_DEADLINE_MS;
  return payload;
};

const composeUrl = (base, path) => {
  const left = base.replace(/\/+$/, '');
  const right = path.replace(/^\/+/, '');
  return `${left}/${right}`;
};

const extractAudio = (data) => {
  if (!data) return null;
  const candidates = [data.audio_base64, data.audioBase64, data.audio];
  const first = candidates.find((value) => typeof value === 'string' && value.length > 0);
  if (!first) return null;
  return first.startsWith('data:') ? first.split(',')[1] : first;
};

function readNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

module.exports = { speak };

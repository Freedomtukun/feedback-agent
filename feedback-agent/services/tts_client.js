'use strict';

const { http } = require('./http_client');

const BASE = process.env.TTS_BASE;
const PATH = process.env.TTS_HTTP_PATH || '/v1/tts';
const AUTH_MODE = process.env.TTS_HTTP_AUTH_MODE || 'body'; // header|body
const TOKEN = process.env.TTS_TOKEN || null;
const VOICE = process.env.VOICE || 'zh-CN-huayan';
const SPEED = Number(process.env.SPEED || 0.9);
const FORMAT = process.env.RETURN_AUDIO_FORMA || 'mp3';
const TTS_TIMEOUT_MS = Number(process.env.TTS_TIMEOUT_MS || 8000);

async function callLocalTTS(text) {
  if (!BASE) throw new Error('NO_TTS_BASE');
  const url = `${BASE}${PATH}`;
  const data = { text, voice: VOICE, speed: SPEED, format: FORMAT };
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_MODE === 'header' && TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (AUTH_MODE === 'body' && TOKEN) data.token = TOKEN;

  const { body } = await http({ method: 'POST', url, data, headers, timeout: TTS_TIMEOUT_MS });
  const audio = body?.audio_base64 || body?.result?.audio_base64;
  if (!audio) throw new Error('BAD_TTS_BODY');
  return { audio_base64: audio, source: 'local-tts' };
}

// 如需远端TTS，在此实现；暂时返回 null 代表不降级
async function callRemoteTTS(_text) { return null; }

async function synthSpeechIfEnabled(text) {
  try { return await callLocalTTS(text); } catch (e) {}
  try { return await callRemoteTTS(text); } catch (e) {}
  return null;
}

module.exports = { synthSpeechIfEnabled };

'use strict';
const { http } = require('./http_client');

exports.ttsMaybe = async (text) => {
  try {
    if (process.env.ENABLE_TTS !== '1') return null;
    const base = process.env.TTS_BASE;
    if (!base) return null;
    const res = await http().post(`${base}/synthesize`, { text });
    if (res?.data?.audio_base64) return { audio_base64: res.data.audio_base64 };
  } catch (e) { console.warn('[TTS] fail', e.status||'', e.message); }
  return null;
};

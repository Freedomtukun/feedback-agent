'use strict';

function healthcheck() {
  return {
    ok: true,
    ts: Date.now(),
    gw_version: process.env.GW_VERSION || null,
    local_first: String(process.env.LOCAL_FIRST || 'true'),
    enable_tts: String(process.env.ENABLE_TTS || '1')
  };
}

module.exports = { healthcheck };

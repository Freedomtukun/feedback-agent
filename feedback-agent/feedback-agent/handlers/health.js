'use strict';
exports.handle = async () => {
  return {
    ok: true,
    service: 'feedback-agent',
    ts: Date.now(),
    env: {
      NODE_ENV: process.env.NODE_ENV || 'dev',
      GW_VERSION: process.env.GW_VERSION || null,
      LOCAL_FIRST: process.env.LOCAL_FIRST || null,
    }
  };
};

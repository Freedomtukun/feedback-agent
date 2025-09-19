'use strict';
const { http } = require('../services/http_client');

exports.handle = async () => {
  const url = process.env.SCORE_URL; // 例如 http://121.5.165.74:5000/api/detect-pose-file
  if (!url) return { ok:false, error:'MISSING_SCORE_URL' };

  let status = null, note = null;
  try {
    // 目标接口通常是 POST，这里发 GET/HEAD 只为探活；405/415 也代表在线。
    const res = await http().get(url, { validateStatus: () => true, timeout: 3000 });
    status = res.status;
    note = 'reachable';
  } catch (e) {
    status = -1; note = String(e?.message || e);
  }
  return { ok: status > 0, target:url, status, note };
};

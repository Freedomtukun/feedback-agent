'use strict';
const fs = require('fs');
const path = require('path');

exports.handle = async () => {
  const root = path.resolve(__dirname, '..');
  const files = [];
  const list = (dir, depth) => {
    if (depth < 0) return;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      files.push({ path: path.relative(root, p)||'.', type: st.isDirectory()?'dir':'file', size: st.isDirectory()?undefined:st.size });
      if (st.isDirectory()) list(p, depth-1);
    }
  };
  list(root, 2);
  const out = {
    ok: true,
    node: process.version,
    env: pick(process.env, ['SCORE_URL','DEFAULT_POSE_ID','ENABLE_TTS','ALLOW_DIAG']),
    files
  };
  return (process.env.ALLOW_DIAG === '1') ? out : { ok:true, tip:'set ALLOW_DIAG=1 to see details' };

  function pick(o, keys){ const r={}; for(const k of keys) if(o[k]!==undefined) r[k]=String(o[k]); return r; }
};
'use strict';

// 统一评分后端的字段 → 前端契约
exports.normalize = (raw) => {
  const out = { ok: true };

  // 评分
  out.score = pickNum(raw, ['score','pose_score','result.score','data.score'], 0);

  // 建议 / 文本
  out.advice = pickStr(raw, ['advice','feedback','result.advice','message','data.advice'], '');

  // 骨架图 URL
  out.skeletonUrl = pickStr(raw, ['skeletonUrl','skeleton_url','result.skeleton','data.skeletonUrl'], null);

  // 容错：如果后端给了错误
  if (raw && raw.ok === false) {
    out.ok = false;
    out.error = raw.error || 'UPSTREAM_ERROR';
    out.detail = raw.detail || null;
  }
  return out;
};

function pickStr(obj, paths, def){
  for (const p of paths) {
    const v = dig(obj, p);
    if (typeof v === 'string' && v.length) return v;
  }
  return def;
}
function pickNum(obj, paths, def){
  for (const p of paths) {
    const v = dig(obj, p);
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  }
  return def;
}
function dig(obj, path){
  return String(path).split('.').reduce((o,k)=> (o && k in o) ? o[k] : undefined, obj);
}

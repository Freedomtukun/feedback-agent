'use strict';
const { http } = require('./services-http_client');

const SUPPORTED_POSES = [
  'mountain_pose','warrior_1','warrior_2','tree_pose','downward_dog','triangle_pose'
];

exports.normalize = async (upstream, ctx = {}) => {
  // 已是规范？
  if (upstream && upstream.ok === true && typeof upstream.score === 'number') return upstream;

  // 常见远端格式 → 统一映射
  let score = Number(upstream?.score) || 0;
  let advice = upstream?.advice || upstream?.message || upstream?.msg || '';
  let skeletonUrl = upstream?.skeletonUrl || upstream?.skeleton_url || upstream?.skeleton || '';

  // 若远端抱怨缺 poseId：自动带 DEFAULT_POSE_ID 或 SUPPORTED_POSES[0] 重试一次
  const code = (upstream?.code || upstream?.error || '').toString();
  if (ctx.retryOnPose && /pose/i.test(code)) {
    const poseId = process.env.DEFAULT_POSE_ID || SUPPORTED_POSES[0];
    const fd = ctx.makeFormData?.(poseId);
    if (fd) {
      try {
        const res = await http().post(ctx.scoreUrl, fd, { headers: fd.getHeaders() });
        return exports.normalize(res.data, { retryOnPose:false });
      } catch (e) {
        return { ok:false, error:'UPSTREAM_RETRY_FAILED', detail: e.message, _upstream:e.data };
      }
    }
  }

  const ok = !!(score && advice);
  return { ok, score, advice, skeletonUrl };
};
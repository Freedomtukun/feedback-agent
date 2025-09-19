'use strict';

// 如需把骨架图上传到 COS：请安装并配置 cos-nodejs-sdk-v5，
// 然后在这里实现 putObject 并返回 {url}。
// 未配置 COS_BUCKET/COS_REGION 时直接返回 null。

async function putSkeletonIfPossible(_buf, _mime) {
  const bucket = process.env.COS_BUCKET;
  const region = process.env.COS_REGION;
  if (!bucket || !region) return null;

  // TODO: 接入 COS SDK，putObject 并返回公开 URL
  return null;
}

module.exports = { putSkeletonIfPossible };

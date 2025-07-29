/**
 * 内容摘要处理器（零依赖）
 * @param {object} params - { text: string, maxLength?: number }
 * @param {object} ctx
 * @returns {{ code:number, message:string, data:{ summary:string } }}
 */
function handleSummary(params = {}, ctx = {}) {
  const { text = '', maxLength = 120 } = params;

  // 🛑 非空校验
  if (typeof text !== 'string' || !text.trim()) {
    return { code: 400, message: '参数 text 不能为空', data: null };
  }

  // ✂️ 超简摘要：按句拆分，拼到 maxLength
  const sentences = text.split(/(?<=[。.!?；;])/);
  let summary = '';
  for (const s of sentences) {
    if ((summary + s).length > maxLength) break;
    summary += s;
  }
  if (!summary) summary = text.slice(0, maxLength);

  ctx.logger?.debug?.('📝 Summary length:', summary.length);

  return { code: 0, message: 'success', data: { summary } };
}

module.exports = { handleSummary };

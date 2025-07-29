/**
 * 作文批改处理器（零依赖 Demo）
 * @param {object} params - { text:string, language?:'zh'|'en', gradeLevel?:number }
 * @param {object} ctx
 * @returns {{ code:number, message:string, data:{ score:number, strengths:string[], suggestions:string[] } }}
 */
function handleComposition(params = {}, ctx = {}) {
  const { text = '', language = 'en', gradeLevel = 6 } = params;

  // 🛑 非空校验
  if (typeof text !== 'string' || !text.trim()) {
    return { code: 400, message: '参数 text 不能为空', data: null };
  }

  // ✏️ 极简评分：词/字数映射 30–100
  const len = language === 'en'
    ? text.trim().split(/\s+/).filter(Boolean).length
    : text.length;
  const score = Math.min(100, Math.max(30, len));

  const strengths   = ['结构清晰', '表达流畅'].slice(0, score > 60 ? 2 : 1);
  const suggestions = ['注意语法', '丰富词汇'].slice(0, 3 - strengths.length);

  ctx.logger?.debug?.('📝 Words/Len:', len);

  return { code: 0, message: 'success', data: { score, strengths, suggestions } };
}

module.exports = { handleComposition };

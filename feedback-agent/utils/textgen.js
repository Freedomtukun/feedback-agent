'use strict';

const { http } = require('../services/http_client');

const LOCAL_FIRST = String(process.env.LOCAL_FIRST || 'true').toLowerCase() === 'true';
const LLM_LOCAL_BASE = process.env.LLM_LOCAL_BASE || process.env.LOCAL_LLM_BASE; // 支持两种变量名
const LOCAL_MODEL = process.env.LOCAL_LLM_MODEL || 'qwen';
const LOCAL_PATH = process.env.LOCAL_LLM_PATH || process.env.LOCAL_LLM_HEALTHZ || '/v1/chat/completions';

const REMOTE_URL = process.env.REMOTE_LLM_URL;
const REMOTE_KEY = process.env.REMOTE_LLM_KEY;
const REMOTE_MODEL = process.env.HUNYUAN_MODEL || 'hunyuan-t1';

const REMOTE_ENABLED = (() => {
  const flag = process.env.REMOTE_MODEL_ENABLED;
  if (flag === undefined) return Boolean(REMOTE_URL);
  return String(flag).toLowerCase() === 'true';
})();

function resolveUrl(base, path) {
  if (!base) return null;
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  const trimmedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}

function buildPrompt(ctx) {
  const { score, poseId, poseName, detections, existingAdvice } = ctx;
  const lines = [];
  if (poseId || poseName) lines.push(`体式: ${poseName || poseId}`);
  if (Number.isFinite(score)) lines.push(`得分: ${score}`);

  const detectionLine = formatDetections(detections);
  if (detectionLine) lines.push(`检测要点: ${detectionLine}`);

  if (existingAdvice && existingAdvice.length) {
    lines.push(`已有提示: ${existingAdvice.join('；')}`);
  }

  return [
    { role: 'system', content: '你是一名精简的瑜伽教练，输出严格遵循 JSON。' },
    { role: 'user', content:
`${lines.join('\n')}
请根据以上信息返回严格 JSON，结构如下：
{"advice":["建议1","建议2"],"summary":"一句话总结"}
要求：
- 建议最多 3 条、每条不超过 20 个汉字
- 总结不超过 16 个汉字
- 如果信息不足，也要给出泛化建议`
    }
  ];
}

function safeParseMaybeJson(text) {
  if (!text) return null;
  // 去掉代码块/多余文本
  const m = text.match(/\{[\s\S]*\}$/);
  const cand = m ? m[0] : text;
  try { return JSON.parse(cand); } catch (_) { return null; }
}

async function callLocal(ctx) {
  const resolved = resolveUrl(LLM_LOCAL_BASE, LOCAL_PATH);
  if (!resolved) throw new Error('NO_LOCAL_LLM');
  const payload = {
    model: LOCAL_MODEL,
    messages: buildPrompt(ctx),
    temperature: 0.3,
    max_tokens: 220
  };
  const { body: resp } = await http({
    method: 'POST',
    url: resolved,
    headers: { 'Content-Type': 'application/json' },
    data: payload
  });
  const txt = resp?.choices?.[0]?.message?.content?.trim() || '';
  const parsed = safeParseMaybeJson(txt);
  if (!parsed) throw new Error('BAD_LOCAL_LLM_OUTPUT');
  return parsed;
}

async function callRemote(ctx) {
  if (!REMOTE_ENABLED || !REMOTE_URL) throw new Error('REMOTE_LLM_DISABLED');
  const payload = {
    model: REMOTE_MODEL,
    messages: buildPrompt(ctx),
    temperature: 0.2,
    max_tokens: 220
  };
  const { body: resp } = await http({
    method: 'POST',
    url: REMOTE_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: REMOTE_KEY ? `Bearer ${REMOTE_KEY}` : undefined
    },
    data: payload
  });
  const txt = resp?.choices?.[0]?.message?.content?.trim() || '';
  const parsed = safeParseMaybeJson(txt);
  if (!parsed) throw new Error('BAD_REMOTE_LLM_OUTPUT');
  return parsed;
}

function formatResult(out, source) {
  const adviceList = Array.isArray(out?.advice)
    ? out.advice.filter(Boolean)
    : out?.advice ? [String(out.advice)] : [];
  const summaryText = typeof out?.summary === 'string' ? out.summary.trim() : '';
  return { advice: adviceList, summary: summaryText, source };
}

function formatDetections(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'string' ? item.trim() : stringifyObject(item)))
      .filter(Boolean)
      .slice(0, 3)
      .join('；');
  }
  if (typeof raw === 'object') {
    const values = Object.entries(raw)
      .map(([key, value]) => {
        if (typeof value === 'string') return `${key}:${value.trim()}`;
        if (typeof value === 'number') return `${key}:${value}`;
        return `${key}:${stringifyObject(value)}`;
      })
      .filter(Boolean)
      .slice(0, 3);
    return values.join('；');
  }
  return '';
}

function stringifyObject(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  try {
    return JSON.stringify(value);
  } catch (_) {
    return '';
  }
}

async function genAdviceAndSummary(ctx = {}) {
  const llmCtx = Object.assign({}, ctx, {
    score: Number.isFinite(ctx.score) ? Number(ctx.score) : undefined,
    existingAdvice: Array.isArray(ctx.existingAdvice)
      ? ctx.existingAdvice.filter(Boolean)
      : ctx.existingAdvice ? [String(ctx.existingAdvice)] : []
  });

  let lastErr = null;

  if (LOCAL_FIRST) {
    try {
      const out = await callLocal(llmCtx);
      return formatResult(out, 'local-llm');
    } catch (e) { lastErr = e; }
    try {
      const out = await callRemote(llmCtx);
      return formatResult(out, 'remote-llm');
    } catch (e) { lastErr = e; }
  } else {
    try {
      const out = await callRemote(llmCtx);
      return formatResult(out, 'remote-llm');
    } catch (e) { lastErr = e; }
    try {
      const out = await callLocal(llmCtx);
      return formatResult(out, 'local-llm');
    } catch (e) { lastErr = e; }
  }

  // 兜底模板（保证前端稳定）
  const score = Number.isFinite(llmCtx.score) ? llmCtx.score : null;
  return {
    advice: ['收紧核心延展脊柱', '放松肩颈避免塌腰', '脚跟下探保持稳定'],
    summary: score >= 85 ? '姿态稳健' : score >= 60 ? '尚可提升' : '基础待加强',
    source: 'fallback'
  };
}

module.exports = { genAdviceAndSummary };

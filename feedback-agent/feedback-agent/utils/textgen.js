'use strict';

const { http } = require('../services/http_client');

const LOCAL_FIRST = String(process.env.LOCAL_FIRST || 'true') === 'true';
const LLM_LOCAL_BASE = process.env.LLM_LOCAL_BASE;                 // e.g. http://121.5.165.74:8080
const LOCAL_MODEL = process.env.LOCAL_LLM_MODEL || 'qwen';
const LOCAL_HEALTH = process.env.LOCAL_LLM_HEALTHZ || '/v1/chat/completions';

const REMOTE_ENABLED = String(process.env.REMOTE_MODEL_ENABLED || 'false') === 'true';
const REMOTE_URL = process.env.REMOTE_LLM_URL;                     // e.g. https://api.hunyuan.cloud.tencent.com/...
const REMOTE_KEY = process.env.REMOTE_LLM_KEY;
const REMOTE_MODEL = process.env.HUNYUAN_MODEL || 'hunyuan-t1';

function buildPrompt(score) {
  return [
    { role: 'system', content: '你是严格控字数的瑜伽教练。仅输出结构化 JSON。' },
    { role: 'user', content:
`根据分数 ${score}，输出：
1) 三条以内中文建议（每条<=20字，短句可执行）
2) 一句总体评价（<=16字）
只返回JSON：{"advice":["...","..."],"summary":"..."}`}
  ];
}

function safeParseMaybeJson(text) {
  if (!text) return null;
  // 去掉代码块/多余文本
  const m = text.match(/\{[\s\S]*\}$/);
  const cand = m ? m[0] : text;
  try { return JSON.parse(cand); } catch (_) { return null; }
}

async function callLocal(score) {
  if (!LLM_LOCAL_BASE) throw new Error('NO_LOCAL_LLM');
  const url = `${LLM_LOCAL_BASE}${LOCAL_HEALTH}`;
  const body = { model: LOCAL_MODEL, messages: buildPrompt(score), temperature: 0.3, max_tokens: 180 };
  const { body: resp } = await http({ method: 'POST', url, headers: { 'Content-Type': 'application/json' }, data: body });
  const txt = resp?.choices?.[0]?.message?.content?.trim() || '';
  const parsed = safeParseMaybeJson(txt);
  if (!parsed) throw new Error('BAD_LOCAL_LLM_OUTPUT');
  return parsed;
}

async function callRemote(score) {
  if (!REMOTE_ENABLED || !REMOTE_URL) throw new Error('REMOTE_LLM_DISABLED');
  const body = { model: REMOTE_MODEL, messages: buildPrompt(score), temperature: 0.2, max_tokens: 180 };
  const { body: resp } = await http({
    method: 'POST',
    url: REMOTE_URL,
    headers: { 'Content-Type': 'application/json', Authorization: REMOTE_KEY ? `Bearer ${REMOTE_KEY}` : undefined },
    data: body
  });
  const txt = resp?.choices?.[0]?.message?.content?.trim() || '';
  const parsed = safeParseMaybeJson(txt);
  if (!parsed) throw new Error('BAD_REMOTE_LLM_OUTPUT');
  return parsed;
}

async function genAdviceAndSummary(_features, score) {
  let lastErr = null;

  if (LOCAL_FIRST) {
    try {
      const out = await callLocal(score);
      return { advice: out.advice || [], summary: out.summary || '', source: 'local-llm' };
    } catch (e) { lastErr = e; }
    try {
      const out = await callRemote(score);
      return { advice: out.advice || [], summary: out.summary || '', source: 'remote-llm' };
    } catch (e) { lastErr = e; }
  } else {
    try {
      const out = await callRemote(score);
      return { advice: out.advice || [], summary: out.summary || '', source: 'remote-llm' };
    } catch (e) { lastErr = e; }
    try {
      const out = await callLocal(score);
      return { advice: out.advice || [], summary: out.summary || '', source: 'local-llm' };
    } catch (e) { lastErr = e; }
  }

  // 兜底模板（保证前端稳定）
  return {
    advice: ['收紧核心延展脊柱', '放松肩颈避免塌腰', '脚跟下探保持稳定'],
    summary: score >= 85 ? '姿态稳健' : score >= 60 ? '尚可提升' : '基础待加强',
    source: 'fallback'
  };
}

module.exports = { genAdviceAndSummary };

/**
 * utils/tts.js
 * ---------------------------------------------
 * Unified helper for Tencent Cloud Text‑to‑Speech (TTS) + COS caching.
 * 
 * Usage:
 *   const { synthesizeSpeech } = require("../utils/tts");
 *   const url = await synthesizeSpeech("你好，欢迎来到冥想时间。");
 *   // → https://cdn.example.com/meditation/audio/<hash>.mp3
 * 
 * Environment variables (CloudBase → 环境变量):
 *   # --- TTS ---
 *   TTS_SECRET_ID       腾讯云语音合成 SecretId
 *   TTS_SECRET_KEY      腾讯云语音合成 SecretKey
 *   TTS_REGION          默认 ap-guangzhou
 *   VOICE_TYPE          参考官网，1001=通用女声、101016=晓曼
 *   SAMPLE_RATE         8000 | 16000  (默认 16000)
 *   SPEED               -2 ~ 2        (默认 0)
 *   VOLUME              0  ~ 10       (默认 5)
 *   
 *   # --- COS ---
 *   COS_SECRET_ID       腾讯云 COS SecretId
 *   COS_SECRET_KEY      腾讯云 COS SecretKey
 *   COS_BUCKET          形如 mybucket-125xxxxxxx
 *   COS_REGION          ap-shanghai / ap-guangzhou ...
 *   COS_CDN             可选，配置自定义加速域名则返回该域名
 * ---------------------------------------------
 */

const tencentcloud = require("tencentcloud-sdk-nodejs-tts");
const COS = require("cos-nodejs-sdk-v5");
const crypto = require("crypto");

// ---------- Init clients ----------
const ttsClient = new tencentcloud.tts.v20190823.Client({
  credential: {
    secretId: process.env.TTS_SECRET_ID,
    secretKey: process.env.TTS_SECRET_KEY,
  },
  region: process.env.TTS_REGION || "ap-guangzhou",
  profile: { httpProfile: { endpoint: "tts.tencentcloudapi.com" } },
});

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
});

// ---------- Helpers ----------
const buildCosUrl = (key) =>
  process.env.COS_CDN
    ? `${process.env.COS_CDN}/${key}`
    : `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com/${key}`;

const md5 = (str) => crypto.createHash("md5").update(str).digest("hex");

// ---------- Main ----------
/**
 * @param {string} text  文本，≤ 1000 汉字/4000 英文字符/总字节 2000
 * @param {object} opts  可选覆盖参数 { voiceType, speed, volume, sampleRate }
 * @returns {Promise<string>} 公开可访问的 MP3 URL
 */
async function synthesizeSpeech(text, opts = {}) {
  if (!text || typeof text !== "string") {
    throw new Error("[TTS] text 不能为空");
  }

  const voiceType = Number(opts.voiceType ?? process.env.VOICE_TYPE ?? 1001);
  const speed = Number(opts.speed ?? process.env.SPEED ?? 0);   // -2 ~ 2
  const volume = Number(opts.volume ?? process.env.VOLUME ?? 5); // 0  ~ 10
  const sampleRate = Number(opts.sampleRate ?? process.env.SAMPLE_RATE ?? 16000);

  // 1️⃣ Cache by md5(text)
  const key = `meditation/audio/${md5(`${voiceType}_${speed}_${volume}_${text}`)}.mp3`;
  try {
    await cos.headObject({
      Bucket: process.env.COS_BUCKET,
      Region: process.env.COS_REGION,
      Key: key,
    });
    return buildCosUrl(key);
  } catch (err) {
    // Not found → continue synthesize
    if (err.statusCode !== 404) console.warn("[TTS] COS headObject error", err.code);
  }

  // 2️⃣ Call Tencent TTS
  const { Audio } = await ttsClient.TextToVoice({
    Text: text,
    SessionId: `tts_${Date.now()}`,
    ModelType: 1, // Chat → 使用 标准模型
    VoiceType: voiceType,
    Codec: "mp3",
    PrimaryLanguage: 1, // 1=中文, 2=英文
    SampleRate: sampleRate,
    Speed: speed,
    Volume: volume,
  });

  const buffer = Buffer.from(Audio, "base64");

  // 3️⃣ Upload to COS (public-read)
  await cos.putObject({
    Bucket: process.env.COS_BUCKET,
    Region: process.env.COS_REGION,
    Key: key,
    Body: buffer,
    ContentType: "audio/mpeg",
    ACL: "public-read",
  });

  return buildCosUrl(key);
}

module.exports = {
  synthesizeSpeech,
};

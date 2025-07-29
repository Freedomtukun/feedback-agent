/**
 * 配置管理模块
 * 支持环境变量和默认配置
 */

// 从环境变量读取配置
const {
  HUNYUAN_API_KEY,
  COS_BUCKET,
  TC_SECRET_ID,
  TC_SECRET_KEY,
  WHISPER_ENDPOINT,
  NODE_ENV
} = process.env;

// 默认配置
const DEFAULT_CONFIG = {
  region: 'ap-shanghai',
  whisperEndpoint: 'http://localhost:5010/transcribe',
  llmTimeout: 30000,
  ttsTimeout: 10000
};

/**
 * 获取完整配置对象
 * @returns {object} 配置对象
 */
export function getConfig() {
  return {
    // LLM 配置
    llm: {
      apiKey: HUNYUAN_API_KEY || '',
      timeout: DEFAULT_CONFIG.llmTimeout,
      model: 'hunyuan-pro' // 可以通过环境变量覆盖
    },
    
    // TTS 配置
    tts: {
      secretId: TC_SECRET_ID || '',
      secretKey: TC_SECRET_KEY || '',
      region: DEFAULT_CONFIG.region,
      timeout: DEFAULT_CONFIG.ttsTimeout
    },
    
    // Whisper 配置
    whisper: {
      endpoint: WHISPER_ENDPOINT || DEFAULT_CONFIG.whisperEndpoint
    },
    
    // COS 配置
    cos: {
      bucket: COS_BUCKET || '',
      region: DEFAULT_CONFIG.region,
      secretId: TC_SECRET_ID || '',
      secretKey: TC_SECRET_KEY || ''
    },
    
    // 环境标识
    env: NODE_ENV || 'production',
    
    // 是否开启调试日志
    debug: NODE_ENV === 'development'
  };
}

/**
 * 验证配置完整性
 * @param {object} config - 配置对象
 * @returns {object} 验证结果
 */
export function validateConfig(config) {
  const errors = [];
  
  if (!config.llm.apiKey) {
    errors.push('缺少 HUNYUAN_API_KEY 环境变量');
  }
  
  if (!config.tts.secretId || !config.tts.secretKey) {
    errors.push('缺少腾讯云密钥配置 (TC_SECRET_ID/TC_SECRET_KEY)');
  }
  
  if (!config.cos.bucket) {
    errors.push('缺少 COS_BUCKET 环境变量');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// 导出配置实例
export const config = getConfig();

// 向后兼容的导出
export const {
  HUNYUAN_API_KEY: exportedApiKey,
  COS_BUCKET: exportedBucket,
  TC_SECRET_ID: exportedSecretId,
  TC_SECRET_KEY: exportedSecretKey
} = process.env;

export const REGION = DEFAULT_CONFIG.region;
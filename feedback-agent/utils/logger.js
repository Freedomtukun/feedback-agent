/**
 * 云函数统一日志工具
 * @module utils/logger
 */

// 日志级别映射
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// 从环境变量获取日志级别，默认为 info
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.info;

/**
 * 格式化时间戳
 * @returns {string} ISO格式时间戳
 */
const getTimestamp = () => new Date().toISOString();

/**
 * 脱敏处理敏感信息
 * @param {any} value - 原始值
 * @param {string} type - 数据类型标识
 * @returns {any} 脱敏后的值
 */
const maskSensitive = (value, type = 'default') => {
  if (value == null) return value;
  
  switch (type) {
    case 'userId':
      return typeof value === 'string' && value.length > 6 
        ? `${value.slice(0, 3)}***${value.slice(-3)}`
        : '***';
    
    case 'size':
      return typeof value === 'number' 
        ? `${Math.round(value / 1024)}KB`
        : value;
    
    case 'email':
      return typeof value === 'string' && value.includes('@')
        ? `${value.split('@')[0].slice(0, 3)}***@${value.split('@')[1]}`
        : '***';
    
    default:
      return typeof value === 'string' && value.length > 8
        ? `${value.slice(0, 4)}***`
        : '***';
  }
};

/**
 * 格式化日志对象
 * @param {any} data - 日志数据
 * @returns {string} 格式化后的字符串
 */
const formatLogData = (data) => {
  if (typeof data === 'string') return data;
  if (typeof data === 'object' && data !== null) {
    try {
      return JSON.stringify(data, null, 2);
    } catch (err) {
      return '[Circular Object]';
    }
  }
  return String(data);
};

/**
 * 通用日志输出函数
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {object} meta - 元数据对象
 */
const log = (level, message, meta = {}) => {
  const levelNum = LOG_LEVELS[level];
  
  // 级别过滤
  if (levelNum < currentLogLevel) return;
  
  const timestamp = getTimestamp();
  const levelTag = `[${level.toUpperCase()}]`;
  const timeTag = `[${timestamp}]`;
  
  // 构建日志前缀
  const prefix = `${levelTag}${timeTag}`;
  
  // 选择输出方法
  const consoleFn = level === 'error' ? console.error : 
                   level === 'warn' ? console.warn : 
                   console.log;
  
  // 输出日志
  if (Object.keys(meta).length > 0) {
    consoleFn(`${prefix} ${message}`, formatLogData(meta));
  } else {
    consoleFn(`${prefix} ${message}`);
  }
};

/**
 * Debug级别日志
 * @param {string} message - 日志消息
 * @param {object} meta - 元数据
 */
const debug = (message, meta) => log('debug', message, meta);

/**
 * Info级别日志
 * @param {string} message - 日志消息
 * @param {object} meta - 元数据
 */
const info = (message, meta) => log('info', message, meta);

/**
 * Warning级别日志
 * @param {string} message - 日志消息
 * @param {object} meta - 元数据
 */
const warn = (message, meta) => log('warn', message, meta);

/**
 * Error级别日志
 * @param {string} message - 日志消息
 * @param {object} meta - 元数据
 */
const error = (message, meta) => log('error', message, meta);

module.exports = {
  debug,
  info,
  warn,
  error,
  maskSensitive,
  // 导出当前日志级别供其他模块使用
  getCurrentLevel: () => Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === currentLogLevel)
};
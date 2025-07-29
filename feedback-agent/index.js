/**
 * 通用反馈型智能体 - 云函数主入口
 * 支持多领域场景：瑜伽评分、作业助手、健康建议等
 * 
 * @author Your Name
 * @version 1.4.1 - 参数校验增强版
 * @license ISC
 */

const fs = require('fs');
const path = require('path');
const { checkType, assertRequired } = require('./utils/validate');  // 引入校验工具

// ==================== 全局错误处理 ====================
process.on('unhandledRejection', (err) => {
  console.error('[🔥 UNHANDLED REJECTION]', {
    message: err.message,
    stack: err.stack?.split('\n').slice(0, 3)
  });
});

process.on('uncaughtException', (err) => {
  console.error('[🔥 UNCAUGHT EXCEPTION]', {
    message: err.message,
    stack: err.stack?.split('\n').slice(0, 3)
  });
  process.exit(1);
});

// ==================== 环境配置 ====================
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // debug | info | warn | error
const NODE_ENV = process.env.NODE_ENV || 'production';
const IS_LOCAL = NODE_ENV === 'local' || NODE_ENV === 'development';

// 智能日志器
const logger = {
  debug: (...args) => (['debug'].includes(LOG_LEVEL) || IS_LOCAL) && console.log('🔍', ...args),
  info: (...args) => ['debug', 'info'].includes(LOG_LEVEL) && console.log('ℹ️', ...args),
  warn: (...args) => ['debug', 'info', 'warn'].includes(LOG_LEVEL) && console.warn('⚠️', ...args),
  error: (...args) => console.error('❌', ...args)
};

// ==================== 业务配置 ====================
const ROUTER_CONFIG = {
  'feedback': {
    module: './router/feedback',
    handler: 'handleFeedback',
    description: '通用反馈处理（瑜伽评分等）'
  },
  'homework': {
    module: './router/homeworkHelper',
    handler: 'handleHomework',
    description: '作业辅助功能'
  },
  'health': {
    module: './router/healthReport',
    handler: 'handleHealthReport',
    description: '健康建议生成'
  },
  'summary': {
    module: './router/summaryHelper',
    handler: 'handleSummary',
    description: '内容摘要生成'
  },
  'composition': {
    module: './router/compositionHelper',
    handler: 'handleComposition',
    description: '作文批改服务'
  },
  'ping': {
    module: './router/system',
    handler: 'handlePing',
    description: '系统健康检查'
  }
};

const STATUS_CODE = {
  SUCCESS: 0,
  PARAM_ERROR: 400,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
  MODULE_ERROR: 501
};

// ==================== 模块缓存优化 ====================
const moduleCache = new Map();
const MODULE_CACHE_LIMIT = 20; // 防止内存泄漏

/**
 * 高性能模块加载器（带缓存和内存保护）
 * @param {string} modulePath - 模块路径
 * @param {string} handlerName - 处理函数名
 * @returns {Function|null} 处理函数或null
 */
const loadModuleHandler = (modulePath, handlerName) => {
  const cacheKey = `${modulePath}#${handlerName}`;
  
  // 🚀 缓存命中，直接返回
  if (moduleCache.has(cacheKey)) {
    logger.debug(`📦 模块缓存命中: ${cacheKey}`);
    return moduleCache.get(cacheKey);
  }
  
  const startTime = Date.now();
  
  try {
    logger.debug(`🔄 首次加载模块: ${modulePath}.${handlerName}`);
    
    // 解析并加载模块
    const resolvedPath = require.resolve(modulePath);
    const loadedModule = require(modulePath);
    
    if (!loadedModule) {
      throw new Error('模块返回 null 或 undefined');
    }
    
    // 验证目标处理函数
    const targetHandler = loadedModule[handlerName];
    
    if (!targetHandler) {
      const availableFunctions = Object.keys(loadedModule).filter(key => 
        typeof loadedModule[key] === 'function'
      );
      throw new Error(
        `处理函数 '${handlerName}' 不存在。可用函数: [${availableFunctions.join(', ')}]`
      );
    }
    
    if (typeof targetHandler !== 'function') {
      throw new Error(`'${handlerName}' 不是函数，类型: ${typeof targetHandler}`);
    }
    
    // 🛡️ 内存保护：清理过期缓存
    if (moduleCache.size >= MODULE_CACHE_LIMIT) {
      logger.warn(`模块缓存达到上限(${MODULE_CACHE_LIMIT})，清理中...`);
      moduleCache.clear();
    }
    
    // 🎯 缓存成功加载的处理函数
    moduleCache.set(cacheKey, targetHandler);
    
    const duration = Date.now() - startTime;
    logger.info(`✅ 模块加载成功: ${cacheKey} (${duration}ms)`);
    
    return targetHandler;
    
  } catch (error) {
    logger.error(`模块加载失败 [${cacheKey}]:`, {
      message: error.message,
      code: error.code
    });
    
    // 仅在调试模式输出详细诊断信息
    if (IS_LOCAL || LOG_LEVEL === 'debug') {
      logger.debug('🔍 项目结构诊断:', getProjectDiagnostics());
    }
    
    return null;
  }
};

// ==================== 工具函数 ====================

/**
 * 安全JSON解析（先定义，避免调用顺序混乱）
 * @param {string} str - JSON字符串
 * @returns {object} 解析结果
 */
const safeJsonParse = (str) => {
  if (!str || typeof str !== 'string') {
    return {};
  }
  
  try {
    const parsed = JSON.parse(str);
    logger.debug('✅ JSON解析成功');
    return parsed;
  } catch (error) {
    logger.error('JSON解析失败:', {
      error: error.message,
      preview: str.substring(0, 100) + (str.length > 100 ? '...' : '')
    });
    return {};
  }
};

/**
 * 增强型请求体解析器（支持多种触发器）
 * @param {any} event - 云函数事件对象
 * @returns {object} 解析后的对象
 */
const parseRequestBody = (event) => {
  // 🌐 HTTP/API网关触发
  if (event.body) {
    // Base64编码自动解码
    let body = event.body;
    if (event.isBase64Encoded) {
      try {
        body = Buffer.from(body, 'base64').toString();
        logger.debug('🔓 Base64解码成功');
      } catch (error) {
        logger.error('Base64解码失败:', error.message);
        return {};
      }
    }
    return safeJsonParse(body);
  }
  
  // ⏰ 定时器触发 - 直接返回确认，不进入业务逻辑
  if (event.Time && event.TriggerName) {
    logger.info('⏰ 定时器触发，短路返回');
    return { type: 'timer_ack', triggerName: event.TriggerName };
  }
  
  // 📁 COS触发
  if (event.Records) {
    logger.info('📁 COS触发');
    return { type: 'cos', records: event.Records };
  }
  
  // 📨 消息队列触发
  if (event.messages) {
    logger.info('📨 消息队列触发');
    return { type: 'cmq', messages: event.messages };
  }
  
  // 🧪 直接传入的对象（测试/调试）
  if (typeof event === 'object' && event.type) {
    return event;
  }
  
  logger.warn('⚠️ 未知触发器类型，使用默认参数');
  return {};
};

/**
 * 标准响应格式化器（支持API网关）
 * @param {number} code - 状态码
 * @param {any} data - 响应数据
 * @param {string} message - 响应消息
 * @param {object} meta - 元数据（可选）
 * @returns {object} 标准响应对象
 */
const formatResponse = (code = STATUS_CODE.SUCCESS, data = null, message = '', meta = {}) => {
  const isSuccess = code === STATUS_CODE.SUCCESS;
  
  const response = {
    code: code,
    message: isSuccess ? 'success' : (message || 'error'),
    data: isSuccess ? data : null,
    timestamp: new Date().toISOString(),
    ...meta
  };
  
  // 生产环境只记录关键响应
  if (IS_LOCAL || LOG_LEVEL === 'debug' || !isSuccess) {
    logger.info(`📤 响应 [${code}]:`, response);
  }
  
  // 🌐 如果是通过API网关调用，返回HTTP格式
  if (meta.isApiGateway) {
    return {
      isBase64Encoded: false,
      statusCode: isSuccess ? 200 : (code === STATUS_CODE.NOT_FOUND ? 404 : 500),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(response)
    };
  }
  
  return response;
};

/**
 * 增强型参数验证器
 * @param {object} params - 参数对象
 * @param {object} schema - 验证模式
 * @returns {object} 验证结果
 */
const validateParams = (params, schema = {}) => {
  const errors = [];
  
  // 必需字段检查
  if (schema.required) {
    schema.required.forEach(field => {
      if (!(field in params) || params[field] == null) {
        errors.push(`缺少必需参数: ${field}`);
      }
    });
  }
  
  // 类型检查
  if (schema.types) {
    Object.entries(schema.types).forEach(([field, expectedType]) => {
      if (field in params && typeof params[field] !== expectedType) {
        errors.push(`参数 ${field} 类型错误，期望: ${expectedType}，实际: ${typeof params[field]}`);
      }
    });
  }
  
  // 长度限制
  if (schema.maxLength) {
    Object.entries(schema.maxLength).forEach(([field, maxLen]) => {
      if (params[field] && params[field].length > maxLen) {
        errors.push(`参数 ${field} 长度超限，最大: ${maxLen}，实际: ${params[field].length}`);
      }
    });
  }
  
  // 枚举值检查
  if (schema.enum) {
    Object.entries(schema.enum).forEach(([field, allowedValues]) => {
      if (params[field] && !allowedValues.includes(params[field])) {
        errors.push(`参数 ${field} 值无效，允许值: [${allowedValues.join(', ')}]，实际: ${params[field]}`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * 系统诊断信息（仅调试时使用）
 * @returns {object} 诊断信息
 */
const getProjectDiagnostics = () => {
  try {
    const diagnostics = {
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        env: NODE_ENV
      },
      structure: {
        rootFiles: [],
        routerExists: false,
        errors: []
      }
    };
    
    // 检查项目结构
    if (fs.existsSync('.')) {
      diagnostics.structure.rootFiles = fs.readdirSync('.').slice(0, 10); // 限制输出
    }
    
    if (fs.existsSync('./router')) {
      diagnostics.structure.routerExists = true;
    } else {
      diagnostics.structure.errors.push('router目录缺失');
    }
    
    return diagnostics;
  } catch (error) {
    return { error: error.message };
  }
};

/**
 * 检测API网关触发器（更精确的判断）
 * @param {object} event - 事件对象
 * @returns {boolean} 是否为API网关触发
 */
const detectApiGateway = (event) => {
  return !!(
    event.requestContext || 
    (event.headers && event.httpMethod) ||
    (event.headers && event.queryStringParameters !== undefined)
  );
};

// ==================== 主处理器 ====================

/**
 * 主云函数处理器
 * @param {object} event - 云函数事件对象
 * @param {object} context - 云函数上下文对象
 * @returns {object} 标准响应对象
 */
const mainHandler = async (event, context) => {
  const startTime = Date.now();
  const requestId = context?.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  
  // 🎯 检测触发源
  const isApiGateway = detectApiGateway(event);
  
  logger.info('🚀 ========== 云函数启动 ==========');
  logger.debug('📋 请求详情:', {
    requestId,
    functionName: context?.functionName,
    memoryLimit: context?.memoryLimitInMB,
    isApiGateway,
    eventKeys: Object.keys(event || {})
  });
  
  try {
    // 📥 解析请求参数
    const requestBody = parseRequestBody(event);
    const { type, ...businessParams } = requestBody;
    
    // ⏰ 定时器任务短路处理
    if (type === 'timer_ack') {
      logger.info('⏰ 定时器任务确认');
      return formatResponse(STATUS_CODE.SUCCESS, { ack: true, triggerName: requestBody.triggerName });
    }
    
    logger.debug('📊 业务参数:', {
      type,
      paramsCount: Object.keys(businessParams).length
    });
    
    // ✅ 参数校验：必填字段 + 类型
    try {
      // 1) 必填字段检查
      assertRequired({ type, userId: requestBody.userId }, ['type', 'userId']);

      // 2) 类型检查
      if (!checkType(type, 'string')) {
        throw new Error('参数 "type" 必须是 string');
      }
      
      // 3) 枚举值检查
      if (!Object.keys(ROUTER_CONFIG).includes(type)) {
        throw new Error(`无效的路由类型: ${type}`);
      }
    } catch (error) {
      return formatResponse(
        STATUS_CODE.PARAM_ERROR,
        null,
        error.message,
        {
          requestId,
          availableTypes: Object.keys(ROUTER_CONFIG),
          isApiGateway
        }
      );
    }
    
    // 🎯 路由匹配（由于已通过enum验证，这里理论上不会失败）
    const routeConfig = ROUTER_CONFIG[type];
    
    logger.info(`🎯 路由匹配: ${type} -> ${routeConfig.description}`);
    
    // 🔧 加载业务处理模块
    const businessHandler = loadModuleHandler(routeConfig.module, routeConfig.handler);
    
    if (!businessHandler) {
      return formatResponse(
        STATUS_CODE.NOT_FOUND,
        null,
        `路由 '${type}' 对应的处理模块未找到`,
        {
          requestId,
          module: routeConfig.module,
          handler: routeConfig.handler,
          isApiGateway
        }
      );
    }
    
    // ⚡ 执行业务逻辑
    logger.debug('🔄 执行业务逻辑...');
    const businessStartTime = Date.now();
    
    const businessResult = await businessHandler(businessParams, {
      ...context,
      requestId,
      startTime,
      type,
      logger
    });
    
    const businessDuration = Date.now() - businessStartTime;
    logger.info(`✅ 业务执行完成 (${businessDuration}ms)`);
    
    // 📤 处理响应格式
    let finalResponse;
    
    if (businessResult && typeof businessResult === 'object' && 'code' in businessResult) {
      // 业务函数返回标准格式
      finalResponse = {
        ...businessResult,
        meta: {
          requestId,
          duration: Date.now() - startTime,
          businessDuration,
          type,
          ...businessResult.meta
        }
      };
      
      // API网关格式转换
      if (isApiGateway) {
        return formatResponse(businessResult.code, businessResult.data, businessResult.message, {
          ...finalResponse.meta,
          isApiGateway: true
        });
      }
    } else {
      // 包装为标准格式
      finalResponse = formatResponse(
        STATUS_CODE.SUCCESS,
        businessResult,
        'success',
        {
          requestId,
          duration: Date.now() - startTime,
          businessDuration,
          type,
          isApiGateway
        }
      );
    }
    
    const totalDuration = Date.now() - startTime;
    logger.info(`🎉 请求完成 (${totalDuration}ms)`);
    
    return finalResponse;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('🔥 云函数异常:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5), // 限制栈信息长度
      requestId,
      duration
    });
    
    return formatResponse(
      STATUS_CODE.SERVER_ERROR,
      null,
      IS_LOCAL ? `服务器错误: ${error.message}` : '服务器内部错误',
      {
        requestId,
        duration,
        errorType: error.name,
        isApiGateway: detectApiGateway(event)
      }
    );
  }
};

// ==================== 导出配置 ====================

module.exports = {
  // 🎯 主处理函数（腾讯云默认查找）
  main_handler: mainHandler,
  
  // 兼容性导出
  main: mainHandler,
  handler: mainHandler,
  
  // 工具函数导出（供测试/其他模块使用）
  formatResponse,
  validateParams,
  parseRequestBody,
  safeJsonParse,
  STATUS_CODE,
  ROUTER_CONFIG,
  logger
};
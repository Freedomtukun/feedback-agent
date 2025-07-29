"use strict";

/**
 * 系统级路由处理器 (router/system.js)
 * 提供运行状况检测与基础信息查询。
 *
 * - handlePing      : 健康检查，返回 "pong" 及时间戳。
 * - handleVersion   : 返回当前服务版本及依赖信息（可选，用不到可删）。
 *
 * 保持与 ROUTER_CONFIG 中的声明一致：
 *   'ping': {
 *     module: './router/system',
 *     handler: 'handlePing',
 *   }
 */

const os = require("os");
const path = require("path");
const pkg = require(path.join(__dirname, "..", "package.json"));

/**
 * Ping -> Pong
 * @returns {Promise<{code:number,message:string,data:Object}>}
 */
exports.handlePing = async () => {
  return {
    code: 0,
    message: "pong",
    data: {
      service: "feedback-agent",
      version: pkg.version,
      hostname: os.hostname(),
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * 可选：返回更详细的版本/依赖信息，方便排障。
 * 如当前路由表用不到，可以注释掉。
 */
exports.handleVersion = async () => {
  return {
    code: 0,
    message: "version-info",
    data: {
      version: pkg.version,
      dependencies: pkg.dependencies,
      node: process.version,
    },
  };
};

// 若以后需要更多系统级接口，继续在此文件追加并在 ROUTER_CONFIG 中注册即可。

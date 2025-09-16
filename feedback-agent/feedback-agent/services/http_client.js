'use strict';

const axios = require('axios');
const axiosRetry = require('axios-retry');

const instance = axios.create({
  timeout: Number(process.env.DEFAULT_HTTP_TIMEOUT || 8000),
  maxContentLength: 20 * 1024 * 1024,
  maxBodyLength: 20 * 1024 * 1024
});

axiosRetry(instance, {
  retries: Number(process.env.LLM_RETRY || 2),
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (e) =>
    axiosRetry.isNetworkOrIdempotentRequestError(e) ||
    e.code === 'ECONNABORTED' ||
    (e.response && e.response.status >= 500)
});

module.exports = {
  async http(options) {
    try {
      const response = await instance.request(options);
      return { status: response.status, body: response.data, headers: response.headers };
    } catch (err) {
      // 这里抛错，方便上层捕获和日志
      throw new Error(`HTTP ${options.method || 'GET'} ${options.url} failed: ${err.message}`);
    }
  }
};

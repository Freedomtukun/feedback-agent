'use strict';
const axios = require('axios');

exports.http = () => {
  const instance = axios.create({
    timeout: Number(process.env.DEFAULT_HTTP_TIMEOUT) || 8000,
    maxBodyLength: Infinity
  });
  instance.interceptors.request.use(cfg => {
    cfg.headers = { ...(cfg.headers||{}), 'X-Request-Id': genId() };
    return cfg;
  });
  instance.interceptors.response.use(
    res => res,
    err => {
      const e = new Error(err.message);
      e.isAxios = true;
      e.status = err.response?.status;
      e.data = err.response?.data;
      throw e;
    }
  );
  return instance;
};
function genId(){ return Math.random().toString(16).slice(2) + Date.now().toString(36); }
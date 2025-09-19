'use strict';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const levelName = (process.env.LOG_LEVEL || 'info').toLowerCase();
const activeLevel = LEVELS[levelName] !== undefined ? LEVELS[levelName] : LEVELS.info;
const nodeEnv = process.env.NODE_ENV || 'development';

const format = (level, message, extra) => {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${nodeEnv}] [${level.toUpperCase()}] ${message}`;
  if (!extra || extra.length === 0) return base;
  const details = extra
    .map((item) => {
      if (item instanceof Error) {
        return item.stack || item.message;
      }
      if (typeof item === 'object') {
        try {
          return JSON.stringify(item);
        } catch (_err) {
          return String(item);
        }
      }
      return String(item);
    })
    .join(' ');
  return `${base} ${details}`;
};

const shouldLog = (level) => LEVELS[level] <= activeLevel;

const log = (level, message, ...extra) => {
  if (!shouldLog(level)) return;
  const output = format(level, message, extra);
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](output);
};

module.exports = {
  info: (msg, ...extra) => log('info', msg, ...extra),
  warn: (msg, ...extra) => log('warn', msg, ...extra),
  error: (msg, ...extra) => log('error', msg, ...extra),
  debug: (msg, ...extra) => log('debug', msg, ...extra),
};

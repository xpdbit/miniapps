/**
 * 结构化日志工具
 * 提供带时间戳和函数名的标准化日志输出
 * CloudBase 云函数中日志输出到微信开发者工具控制台
 */

/**
 * 获取当前时间戳 (ISO 8601 格式)
 * @returns {string}
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * 格式化日志行
 * @param {string} level - 日志级别 (INFO / WARN / ERROR)
 * @param {string} message - 日志内容
 * @param {object} [data] - 结构化附加数据
 * @param {string} [functionName] - 所属云函数名
 * @returns {string} 格式化后的日志字符串
 */
function formatLog(level, message, data, functionName) {
  const prefix = functionName ? ` [${functionName}]` : '';
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `[${getTimestamp()}] [${level}]${prefix} ${message}${dataStr}`;
}

const logger = {
  /**
   * 记录 INFO 级别日志
   * @param {string} message
   * @param {object} [data]
   * @param {string} [functionName]
   */
  info: (message, data, functionName) => {
    console.log(formatLog('INFO', message, data, functionName));
  },

  /**
   * 记录 WARN 级别日志
   * @param {string} message
   * @param {object} [data]
   * @param {string} [functionName]
   */
  warn: (message, data, functionName) => {
    console.warn(formatLog('WARN', message, data, functionName));
  },

  /**
   * 记录 ERROR 级别日志
   * @param {string} message
   * @param {object} [data]
   * @param {string} [functionName]
   */
  error: (message, data, functionName) => {
    console.error(formatLog('ERROR', message, data, functionName));
  },

  /**
   * 为指定云函数创建带命名空间的 logger 实例
   *
   * @param {string} name - 云函数名称
   * @returns {{ info: Function, warn: Function, error: Function }}
   *
   * @example
   * const log = logger.createNamedLogger('foodRecognize');
   * log.info('函数被调用');
   */
  createNamedLogger: (name) => ({
    info: (msg, data) => logger.info(msg, data, name),
    warn: (msg, data) => logger.warn(msg, data, name),
    error: (msg, data) => logger.error(msg, data, name),
  }),
};

module.exports = { logger };

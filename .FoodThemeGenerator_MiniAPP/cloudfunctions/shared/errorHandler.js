/**
 * 统一错误处理中间件
 * 提供 CustomAppError 类和 withErrorHandler 包装器
 * 确保所有云函数返回统一格式的错误响应
 */

const { createErrorResponse } = require('./response');
const { logger } = require('./logger');

/**
 * 自定义应用错误类
 * 用于在业务逻辑中抛出可控的应用层错误
 */
class CustomAppError extends Error {
  /**
   * @param {number} errCode - 错误码 (参考 ErrorCode 枚举)
   * @param {string} errMsg - 错误描述
   * @param {*} [data=null] - 附加错误数据
   */
  constructor(errCode, errMsg, data = null) {
    super(errMsg);
    this.name = 'CustomAppError';
    this.errCode = errCode;
    this.errMsg = errMsg;
    this.data = data;
  }
}

/**
 * 统一错误处理包装器
 * 包裹云函数主逻辑，自动捕获异常并返回标准错误响应
 *
 * @param {Function} handlerFn - 异步处理函数 (async () => ...)
 * @param {object} [options] - 可选配置
 * @param {string} [options.functionName] - 函数名称（用于日志）
 * @returns {Promise<object>} 标准 API 响应
 */
async function withErrorHandler(handlerFn, options = {}) {
  const startTime = Date.now();
  try {
    const result = await handlerFn();
    const elapsed = Date.now() - startTime;

    // 如果结果已经是响应格式，直接补充 elapsed 返回
    if (result && typeof result === 'object' && 'success' in result) {
      result.elapsed = result.elapsed || elapsed;
      return result;
    }

    // 原始返回值，用 createResponse 包装
    const { createResponse } = require('./response');
    return createResponse(result, 0, '操作成功', { elapsed });
  } catch (error) {
    const elapsed = Date.now() - startTime;

    // 自定义应用错误 — 已知的可控错误
    if (error instanceof CustomAppError) {
      logger.warn(
        `应用错误 [${error.errCode}]: ${error.errMsg}`,
        { data: error.data },
        options.functionName
      );
      return createErrorResponse(error.errCode, error.errMsg, error.data, { elapsed });
    }

    // 参数验证错误
    if (error.name === 'ValidationError') {
      logger.warn(`验证错误: ${error.message}`, null, options.functionName);
      return createErrorResponse(1002, error.message, null, { elapsed });
    }

    // 未知／未捕获错误
    logger.error(
      `未捕获错误: ${error.message}`,
      { stack: error.stack },
      options.functionName
    );
    return createErrorResponse(1000, '未知错误', null, { elapsed });
  }
}

module.exports = {
  CustomAppError,
  withErrorHandler,
};

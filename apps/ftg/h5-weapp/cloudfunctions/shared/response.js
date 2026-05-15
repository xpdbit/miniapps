/**
 * 标准 API 响应构建工具
 * 对应前端类型 ApiResponse<T>
 * 提供统一的 success/error 响应格式
 */

/**
 * 构建成功响应
 * @param {*} data - 响应数据
 * @param {number} [errCode=0] - 错误码（成功为 0）
 * @param {string} [errMsg='操作成功'] - 成功消息
 * @param {object} [options] - 可选配置
 * @param {number} [options.elapsed=0] - 请求耗时 (ms)
 * @returns {{ success: boolean, data: *, errCode: number, errMsg: string, elapsed: number }}
 */
function createResponse(data, errCode = 0, errMsg = '操作成功', options = {}) {
  return {
    success: true,
    data: data !== undefined ? data : null,
    errCode,
    errMsg,
    elapsed: options.elapsed || 0,
  };
}

/**
 * 构建错误响应
 * @param {number} errCode - 错误码
 * @param {string} errMsg - 错误信息
 * @param {*} [data=null] - 附加数据
 * @param {object} [options] - 可选配置
 * @param {number} [options.elapsed=0] - 请求耗时 (ms)
 * @returns {{ success: boolean, data: *, errCode: number, errMsg: string, elapsed: number }}
 */
function createErrorResponse(errCode, errMsg, data = null, options = {}) {
  return {
    success: false,
    data,
    errCode,
    errMsg,
    elapsed: options.elapsed || 0,
  };
}

module.exports = {
  createResponse,
  createErrorResponse,
};

/**
 * getOpenId 云函数
 * 获取当前用户的微信 OPENID
 *
 * CloudBase 天然免登录认证，
 * 通过 wx-server-sdk 的 WXContext 获取用户身份。
 *
 * 超时: 3s  |  内存: 128MB
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

/**
 * 云函数入口
 *
 * @param {object} _event - 请求事件（本函数无需参数）
 * @param {object} context - 云函数上下文
 * @returns {{ openid: string }} 用户 openid
 */
exports.main = async (_event, context) => {
  const { OPENID } = cloud.getWXContext();

  return {
    openid: OPENID,
  };
};

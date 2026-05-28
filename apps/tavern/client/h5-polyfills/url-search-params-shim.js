/**
 * core-js-pure/web/url-search-params 的兼容 shim
 * core-js-pure 3.x 已移除 web/ 路径下的 URLSearchParams polyfill，
 * 因为 URLSearchParams API 在所有现代浏览器中已是内置 API。
 * 本 shim 仅供 @pmmmwh/react-refresh-webpack-plugin 的 HMR 客户端使用。
 */
module.exports = typeof URLSearchParams !== 'undefined' ? URLSearchParams : undefined;

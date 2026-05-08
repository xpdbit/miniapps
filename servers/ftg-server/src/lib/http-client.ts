/**
 * 共享 HTTP 客户端 — 带连接复用的 Keep-Alive 配置
 *
 * 所有外部 API 调用（DashScope、微信、PP-ShiTuV2、IP 定位）使用此实例，
 * 以减少 TCP 连接创建开销和 ECS 上的并发连接数。
 */
import axios from 'axios';
import http from 'http';
import https from 'https';

// HTTP Keep-Alive Agent — 复用 TCP 连接
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60_000,   // 空闲连接保持 60s
  maxSockets: 10,            // 每个主机最多 10 个并发 socket
  maxFreeSockets: 5,         // 空闲时保留 5 个 socket
  timeout: 30_000,           // socket 超时
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60_000,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 30_000,
});

/**
 * 预配置的 HTTP 客户端实例
 * - 自动启用 Keep-Alive 和连接复用
 * - 30 秒请求超时
 * - 限制每个主机的并发连接数不超过 10
 */
const httpClient = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 30_000,
});

export default httpClient;

// 共享 MySQL 连接池 — 所有 Admin API 路由复用同一连接池
import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'mysql',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'ftg_user',
  password: process.env.MYSQL_PASSWORD || '',
  database: 'food_theme_generator',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
})

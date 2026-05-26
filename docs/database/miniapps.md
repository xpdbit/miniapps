# miniapps 库 — 公用

> **状态**: current
> **更新**: 2026-05-24

## 说明

跨项目公用数据库，存储用户认证、会话、管理后台数据。

## 表

| 表名 | 说明 |
|------|------|
| `User` | 微信用户 (openid, nickname, avatarUrl, lastLoginAt) |
| `AdminUser` | 管理后台账户 (username, passwordHash, role) |
| `Project` | 项目配置 (name, apiBaseUrl, status) |
| `AuditLog` | 审计日志 (adminId, action, targetType, targetId, detail) |
| `UserAuth` | 多认证绑定 (password/wechat/phone) |
| `Session` | 会话管理 |

---

> 最后更新: 2026-05-24

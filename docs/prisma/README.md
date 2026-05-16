# prisma — 统一数据库 Schema

## 概述

Root-level Prisma Schema (`prisma/schema.prisma`) 集中管理所有小程序的数据库表，共 14 张表 + 5 个枚举。

## 数据库

MySQL 8.0，通过 Docker Compose 部署（容器名 `mysql`）。

## Schema 结构

### FTG 核心表（9表）

| 表名 | 说明 | 主要字段 |
|------|------|---------|
| `User` | 微信用户 | openid, nickname, avatarUrl, lastLoginAt |
| `FoodRecord` | 食物记录 | userId, foodName, foodType, calories, imageUrl, themeId |
| `Checkin` | 打卡记录 | foodRecordId, location, checkinDate |
| `Theme` | 主题模板 | name, templateMarkup, cssClasses, category, isActive |
| `ThemeClass` | CSS Class | name, cssProperties (JSON), category |
| `ThemeUsageLog` | 主题使用统计 | themeId, foodRecordId, userId |
| `Achievement` | 成就定义 | name, description, icon, conditionType, conditionValue |
| `UserAchievement` | 用户成就 | userId, achievementId, unlockedAt |
| `ApiKey` | 外部 API 密钥 | userId, serviceName, encryptedKey, isActive |
| `Favorite` | 收藏记录 | userId, foodRecordId |
| `PipelineRecord` | AI 流水线追踪 | userId, status, progress, resultJson |

### 管理表（3表）

| 表名 | 说明 |
|------|------|
| `AdminUser` | 管理后台账户 (username, passwordHash, role) |
| `Project` | 项目配置 (name, apiBaseUrl, status) |
| `AuditLog` | 审计日志 (adminId, action, targetType, targetId, detail) |

### 枚举

`FoodType`, `PipelineStatus`, `AdminRole`, `AdminStatus`, `ProjectStatus`

## ORM 版本

| 项目 | Prisma 版本 |
|------|------------|
| ftg-server | v6.19 |
| game1-server | v5.22 |
| tavern-server | v5.10 |
| dashboard | v6.19 |

> **注意**: 版本分化已列为反模式，需统一升级。

## 相关文档

- [FTG Server Schema 详情](../apps/ftg/server/README.md#数据库)
- [Game1 Server Schema](../apps/game1/server/README.md#数据库)
- [Tavern Server Schema](../apps/tavern/server/README.md#数据库)

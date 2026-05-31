# 数据库

> **状态**: current
> **更新**: 2026-05-31
> 项目使用 4 个独立 MySQL 数据库，各有独立 Prisma Schema。

## 架构总览

| 数据库 | Prisma Schema | 项目 | 表数 |
|--------|--------------|------|------|
| `miniapps` | `schema-miniapps.prisma` | 公用（用户/认证/会话/管理后台） | 5 表 |
| `food_theme_generator` | `schema-food-theme-generator.prisma` | FTG | 11 表 |
| `ai_tavern` | `apps/tavern/server/prisma/schema.prisma` | AI-Tavern | 13 表 |
| `game1` | `schema-game1.prisma` | Game1 | 7 表 |

## ORM 版本

| 项目 | Prisma 版本 |
|------|------------|
| ftg-server | v6.19 |
| game1-server | v5.22 |
| tavern-server | v5.10 |
| dashboard | v6.19 |

> **注意**: 版本分化已列为反模式，需统一升级。

## 各库详情

| 数据库 | 文档 |
|--------|------|
| miniapps（公用） | `docs/database/miniapps.md` |
| food_theme_generator（FTG） | `docs/database/ftg.md` |
| ai_tavern（Tavern） | `docs/database/tavern.md` |
| game1（Game1） | `docs/database/game1.md` |

## Prisma Schema 位置

```
prisma/
├── schema-miniapps.prisma
├── schema-food-theme-generator.prisma
├── schema-ai-tavern.prisma
└── schema-game1.prisma
```

## 相关文档

- 各项目 README 也包含数据库部分
- 部署连接配置见 `docs/ops/servers.md`

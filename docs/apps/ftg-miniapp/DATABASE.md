# 数据库设计

> 🚫 **废弃文档** — 本文档描述的是已弃用的 CloudBase NoSQL 数据库设计 (2025)。
> 当前架构已完全迁移至 MySQL 8.0 + Prisma ORM。
> 统一 Prisma Schema 定义在 `prisma/schema.prisma`（14 张表：User/FoodRecord/Theme/AdminUser 等，覆盖所有子项目）。
> servers 各项目的 Prisma Client 通过 `prisma generate` 从该统一 Schema 生成。

---

**本文档全文共包含 8 个 NoSQL 集合设计和安全规则，所有内容均已过时。**
**如需参考旧数据库设计的完整内容，请查看 Git 历史中的此文件。**

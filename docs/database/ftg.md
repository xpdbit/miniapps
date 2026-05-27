# food_theme_generator 库 — FTG

> **状态**: current
> **更新**: 2026-05-27

## 说明

FTG（食物主题生成器）业务数据库。

## 表（11 表）

| 表名 | 说明 | 主要字段 |
|------|------|---------|
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

---

> 最后更新: 2026-05-27

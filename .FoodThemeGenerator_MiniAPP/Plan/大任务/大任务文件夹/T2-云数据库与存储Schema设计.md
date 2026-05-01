# T2: 云数据库与存储Schema设计

- **波次**: 1
- **预估时长**: 3-4 小时
- **依赖**: T1
- **阻塞**: T4, T12, T13, T15

## 做什么

1. 设计并创建所有云数据库集合:
   - `users`：用户信息（openid, nickname, avatarUrl, createdAt, totalRecords, totalCheckins, themePreference）
   - `food_records`：食物记录（openid, imageFileID, themeImageFileID, foodName, foodType, calories, aiDescription, gameDescription, latitude, longitude, locationName, ipLocation, createdAt, themeId）
   - `checkins`：打卡记录（openid, foodRecordId, locationName, latitude, longitude, timestamp, streakCount）
   - `achievements`：成就定义（achievementId, name, description, iconUrl, unlockCondition, conditionValue, themeId）
   - `user_achievements`：用户成就（openid, achievementId, unlockedAt, progress, isUnlocked）
   - `themes`：主题定义（themeId, name, gameName, frameConfig, previewImageUrl, isActive, sortOrder）
   - `api_keys`：用户API密钥（openid, serviceName, apiKey, isActive, createdAt, lastUsed）— 加密存储
2. 为每个集合创建索引:
   - `food_records`: `{openid: 1, createdAt: -1}`, `{foodType: 1}`
   - `checkins`: `{openid: 1, timestamp: -1}`
   - `user_achievements`: `{openid: 1, isUnlocked: 1}`
3. 创建数据库安全规则（仅允许用户读写自己的数据）
4. 设计云存储目录结构:
   - `food-images/{openid}/{timestamp}.jpg`
   - `theme-images/{openid}/{themeId}/{timestamp}.png`
   - `avatars/{openid}.jpg`
   - `theme-frames/{themeId}/`
5. 编写数据访问层（DAL）：封装所有云数据库操作
6. 编写数据模型 TypeScript 接口

## 绝对不能做

- ❌ 不要把安全规则设为 `true`（公开读写）
- ❌ 不要在 `food_records` 中重复存储完整的用户信息
- ❌ 不要创建无索引的查询

## 推荐Agent配置

- **类别**: `deep` — Schema设计需要理解数据关系和查询模式
- **技能**: `[]`

## 验收标准

- [ ] 所有7个集合在CloudBase控制台中可见
- [ ] 每个集合的索引已创建
- [ ] 安全规则正确配置（跨用户数据隔离）
- [ ] DAL层代码封装完成（每个集合至少 create, getById, list, update, delete 方法）
- [ ] 云存储目录结构已规划

## 提交

- **消息**: `feat(db): 设计云数据库Schema与索引`
- **文件**: cloudfunctions/ 下的数据库初始化文件, src/services/db/

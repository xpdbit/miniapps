# 云函数 API 参考

> ⚠️ **旧架构文档** — 本文档描述的是项目早期的 CloudBase 云函数架构。
> 当前架构已迁移至 Express REST API（servers/ftg-server），云函数仅存部分遗留功能。
> 如需了解当前 API，请参考 `servers/ftg-server/src/routes/`。

所有云函数通过 `wx.cloud.callFunction({ name, data })` 调用。

## 云函数列表

| 云函数 | 调用方 | 功能 |
|--------|--------|------|
| `getOpenId` | 前端 | 获取用户 OpenID |
| `orchestrateAIPipeline` | 前端 | AI 流水线编排（核心） |
| `foodRecognize` | 编排器 | 食物识别（调用 PP-ShiTuV2） |
| `textGenerate` | 编排器 | 文本生成（调用混元大模型） |
| `createFoodRecord` | 前端/编排器 | 创建食物记录 |
| `getUserStats` | 前端 | 获取用户统计数据 |
| `checkAchievement` | 前端 | 成就检查与解锁 |
| `manageApiKey` | 前端 | API 密钥管理 |
| `generateShareCard` | 前端 | 生成分享卡片 |
| `getLocationByIP` | 前端 | IP 定位 |
| `db_init` | 管理员 | 数据库初始化 |
| `themeCompose` | 前端 | 主题合成（备用） |

## 响应格式

所有云函数统一使用 `shared/response.ts` 格式化响应：

```typescript
// 成功响应
{
  code: 0,
  data: { ... },
  message: "ok"
}

// 错误响应
{
  code: 1001,
  data: null,
  message: "错误描述"
}
```

---

## 1. getOpenId — 获取用户身份

```
wx.cloud.callFunction({ name: 'getOpenId' })
```

**入参**：无

**出参**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `data.openid` | string | 用户微信 OpenID |
| `data.appid` | string | 小程序 AppID |

---

## 2. orchestrateAIPipeline — AI 流水线编排

核心编排函数，串联整个 AI 识别与主题生成流程。

```
wx.cloud.callFunction({
  name: 'orchestrateAIPipeline',
  data: {
    action: 'start',
    imageFileID: 'cloud://xxx.jpg',
    themeId: 'dont_starve'
  }
})
```

**入参 action 类型**：

| action | 说明 | 额外参数 |
|--------|------|----------|
| `start` | 启动新流水线 | `imageFileID`, `themeId` |
| `status` | 查询流水线状态 | `pipelineId` |

**start 额外参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `imageFileID` | string | ✅ | 食物图片云存储 ID |
| `themeId` | string | ✅ | 目标主题 ID |

**出参 (start)**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `pipelineId` | string | 流水线唯一 ID |

**出参 (status)**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | 当前状态（见状态机） |
| `progress` | number | 进度百分比 0-100 |

**状态机状态**：
| 状态 | 进度 | 说明 |
|------|------|------|
| `queued` | 0% | 已入队 |
| `preprocessing` | 10% | 图片预处理 |
| `recognizing` | 30% | 食物识别中 |
| `generating` | 55% | 文本生成中 |
| `composing` | 80% | Canvas 合成中 |
| `completed` | 100% | 完成 |
| `failed` | 0% | 失败 |

---

## 3. foodRecognize — 食物识别

由编排器内部调用，也可前端直接调用。

```
wx.cloud.callFunction({
  name: 'foodRecognize',
  data: {
    imageFileID: 'cloud://xxx.jpg'
  }
})
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `imageFileID` | string | ✅ | 待识别图片云存储 ID |

**出参**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `foodName` | string | 食物名称 |
| `confidence` | number | 置信度 (0-1) |
| `foodType` | string | 食物类型枚举值 |
| `calories` | object | `{ total, per100g, protein, fat, carbs }` |
| `alternatives` | array | 备选识别结果 |

**缓存策略**：识别结果缓存 24 小时，基于 `imageFileID` 去重。

---

## 4. textGenerate — 文本生成

调用腾讯混元大模型生成游戏化描述文本。

```
wx.cloud.callFunction({
  name: 'textGenerate',
  data: {
    foodName: '番茄炒蛋',
    foodType: 'dish',
    themeId: 'zelda_cooking'
  }
})
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `foodName` | string | ✅ | 食物名称 |
| `foodType` | string | ✅ | 食物类型 |
| `themeId` | string | ✅ | 目标主题 |

**出参**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `short` | string | 简短描述 |
| `gameStyle` | string | 游戏化风格描述 |
| `detail` | string | 详细描述 |

---

## 5. createFoodRecord — 食物记录管理

```
wx.cloud.callFunction({
  name: 'createFoodRecord',
  data: {
    action: 'create',
    record: { ... }
  }
})
```

**action 类型**：

| action | 说明 |
|--------|------|
| `create` | 创建食物记录 |
| `getById` | 按 ID 获取 |
| `listByUser` | 用户记录列表 |
| `softDelete` | 软删除记录 |

**create 入参**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `record.imageFileID` | string | 原图云存储 ID |
| `record.themeImageFileID` | string | 合成图云存储 ID |
| `record.foodName` | string | 食物名称 |
| `record.foodType` | string | 食物类型 |
| `record.calories` | object | 卡路里信息 |
| `record.aiDescription` | object | AI 描述 |
| `record.gameDescription` | string | 游戏化描述 |
| `record.themeId` | string | 主题 ID |
| `record.latitude` | number | 纬度（可选） |
| `record.longitude` | number | 经度（可选） |
| `record.locationName` | string | 位置名称（可选） |

---

## 6. getUserStats — 用户统计

```
wx.cloud.callFunction({
  name: 'getUserStats'
})
```

**入参**：无（自动获取当前用户 openid）

**出参**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `totalRecords` | number | 总记录数 |
| `totalCheckins` | number | 总打卡数 |
| `streakDays` | number | 连续打卡天数 |
| `totalCalories` | number | 总热量 |
| `foodTypeDistribution` | object | 食物类型分布 |
| `themeDistribution` | object | 主题使用分布 |

---

## 7. checkAchievement — 成就系统

```
wx.cloud.callFunction({
  name: 'checkAchievement'
})
```

**入参**：无（系统自动检查所有成就条件）

**出参**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `unlocked` | array | 新解锁的成就列表 |
| `progress` | array | 进度更新的成就列表 |

---

## 8. manageApiKey — API 密钥管理

```
wx.cloud.callFunction({
  name: 'manageApiKey',
  data: {
    action: 'set',
    serviceName: 'hunyuan',
    apiKey: 'sk-xxx'
  }
})
```

**action 类型**：

| action | 说明 |
|--------|------|
| `set` | 设置 API 密钥 |
| `get` | 获取 API 密钥 |
| `delete` | 删除 API 密钥 |

---

## 9. generateShareCard — 分享卡片

```
wx.cloud.callFunction({
  name: 'generateShareCard',
  data: {
    foodRecordId: 'xxx'
  }
})
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `foodRecordId` | string | ✅ | 食物记录 ID |

**出参**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `shareImageFileID` | string | 分享卡片云存储 ID |

---

## 10. getLocationByIP — IP 定位

```
wx.cloud.callFunction({
  name: 'getLocationByIP'
})
```

**入参**：无（自动获取请求 IP）

**出参**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `city` | string | 城市名称 |
| `province` | string | 省份名称 |
| `district` | string | 区县名称 |

---

## 11. db_init — 数据库初始化

管理员一次性初始化数据库集合和索引。

```
wx.cloud.callFunction({
  name: 'db_init'
})
```

**执行操作**：
1. 创建 7 个集合（如不存在）
2. 创建必要索引
3. 插入预置数据（成就定义、主题定义）

---

## 12. themeCompose — 主题合成（备用）

Canvas 主题合成的服务端备用方案。

```
wx.cloud.callFunction({
  name: 'themeCompose',
  data: {
    foodImageFileID: 'cloud://xxx.jpg',
    themeId: 'dont_starve',
    foodName: '番茄炒蛋',
    gameDescription: '获得道具：🍳...'
  }
})
```

**入参**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `foodImageFileID` | string | ✅ | 食物原图 |
| `themeId` | string | ✅ | 主题 ID |
| `foodName` | string | ✅ | 食物名称 |
| `gameDescription` | string | ✅ | 游戏化描述 |

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| `0` | 成功 |
| `1001` | 参数错误 |
| `1002` | 未登录 |
| `1003` | 权限不足 |
| `2001` | 识别服务调用失败 |
| `2002` | 文本生成失败 |
| `2003` | 图片合成失败 |
| `3001` | 数据库操作失败 |
| `3002` | 记录不存在 |
| `4001` | API 密钥未配置 |
| `4002` | API 密钥已过期 |
| `5000` | 内部错误 |

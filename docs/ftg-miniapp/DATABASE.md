# 数据库设计

基于 **微信云开发 CloudBase 云数据库**，使用 NoSQL 文档型存储。

## 集合总览

| 集合名称 | 用途 | 主键策略 |
|----------|------|----------|
| `users` | 用户信息 | `_id` = 微信 openid |
| `food_records` | 食物识别记录 | 自动生成 |
| `checkins` | 打卡记录 | 自动生成 |
| `achievements` | 成就定义（预置） | 自动生成 |
| `user_achievements` | 用户成就关联 | 自动生成 |
| `themes` | 主题定义（预置） | 自动生成 |
| `api_keys` | API 密钥管理 | 自动生成 |
| `pipeline_status` | AI 流水线状态（临时的） | 自动生成 |

---

## 1. users — 用户集合

用户通过 CloudBase 免登录后，首次使用时自动创建。

```typescript
interface UserDoc {
  _id: string;           // 微信 openid（主键）
  nickname: string;      // 用户昵称
  avatarUrl: string;     // 头像云文件 ID
  createdAt: string;     // 注册时间 (ISO 8601)
  totalRecords: number;  // 总食物记录数
  totalCheckins: number; // 总打卡数
  themePreference: string; // 主题偏好 (themeId)
}
```

**索引**：
- `_id`（默认主键）

---

## 2. food_records — 食物记录

核心数据集合，存储每次 AI 识别的完整结果。

```typescript
interface FoodRecordDoc {
  _id: string;              // 记录 ID
  openid: string;           // 用户 openid
  imageFileID: string;      // 原图云文件 ID
  themeImageFileID: string; // 主题合成图云文件 ID
  foodName: string;         // 食物名称
  foodType: FoodType;       // 食物类型枚举
  calories: CalorieInfo;    // 卡路里信息
  aiDescription: AIFoodDescription; // AI 描述
  gameDescription: string;  // 游戏化描述
  latitude: number;         // 纬度
  longitude: number;        // 经度
  locationName: string;     // 位置名称
  ipLocation: string;       // IP 定位
  createdAt: string;        // 创建时间
  themeId: string;          // 主题 ID
  remark?: string;          // 用户备注
  isDeleted?: boolean;      // 软删除标记
  deletedAt?: string;       // 删除时间
}
```

**索引**：
- `_id`（默认）
- `openid` + `createdAt`（desc）— 用户记录列表查询
- `isDeleted` — 软删除过滤

**卡路里信息子结构**：
```typescript
interface CalorieInfo {
  total: number;    // 总热量 (kcal)
  per100g: number;  // 每100g热量
  protein: number;  // 蛋白质 (g)
  fat: number;      // 脂肪 (g)
  carbs: number;    // 碳水化合物 (g)
}
```

---

## 3. checkins — 打卡记录

关联食物记录，记录用户打卡行为。

```typescript
interface CheckinDoc {
  _id: string;           // 打卡 ID
  openid: string;        // 用户 openid
  foodRecordId: string;  // 关联食物记录 ID
  locationName: string;  // 打卡位置
  latitude: number;      // 纬度
  longitude: number;     // 经度
  timestamp: string;     // 打卡时间 (ISO 8601)
  streakCount: number;   // 连续打卡天数
}
```

**索引**：
- `_id`（默认）
- `openid` + `timestamp`（desc）— 用户打卡列表

---

## 4. achievements — 成就定义

系统预置数据，定义所有可解锁成就。

```typescript
interface AchievementDoc {
  _id: string;                       // 文档 ID
  achievementId: string;             // 成就逻辑 ID
  name: string;                      // 成就名称
  description: string;               // 成就描述
  iconUrl: string;                   // 图标云文件 ID
  unlockCondition: AchievementCondition; // 解锁条件
  themeId: string;                   // 关联主题 ID
}
```

---

## 5. user_achievements — 用户成就

关联用户与成就，追踪解锁进度。

```typescript
interface UserAchievementDoc {
  _id: string;          // 文档 ID
  openid: string;       // 用户 openid
  achievementId: string; // 成就 ID
  unlockedAt: string;   // 解锁时间
  progress: number;     // 当前进度 (0-目标值)
  isUnlocked: boolean;  // 是否已解锁
}
```

**索引**：
- `_id`（默认）
- `openid` + `achievementId`（唯一索引）

---

## 6. themes — 主题定义

系统预置数据，定义所有可用主题。

```typescript
interface ThemeDoc {
  _id: string;               // 文档 ID
  themeId: string;           // 主题逻辑 ID
  name: string;              // 主题名称
  gameName: string;          // 游戏名称
  frameConfig: ThemeConfig;  // 合成配置
  previewImageUrl: string;   // 预览图云文件 ID
  isActive: boolean;         // 是否启用
  sortOrder: number;         // 排序序号
}
```

**主题合成配置子结构**：
```typescript
interface ThemeConfig {
  frame: {
    frameImageId: string;   // 边框图片云文件 ID
    borderWidth: number;    // 边框宽度 (px)
    borderRadius: number;   // 圆角半径
    overlayColor: string;   // 叠加层颜色 (rgba)
    overlayOpacity: number; // 透明度 0-1
  };
  compose: {
    imageScale: number;     // 图片缩放 0-1
    offsetX: number;        // X 偏移 (px)
    offsetY: number;        // Y 偏移 (px)
    textTemplate: string;   // 文案模板
    textColor: string;      // 文案颜色
    fontSize: number;       // 字体大小
    textX: number;          // 文本 X 位置
    textY: number;          // 文本 Y 位置
  };
}
```

---

## 7. api_keys — API 密钥

管理系统级 API 密钥（加密存储）。

```typescript
interface ApiKeyDoc {
  _id: string;         // 文档 ID
  openid: string;      // 用户 openid
  serviceName: string; // 服务名 (hunyuan / ppshitu)
  apiKey: string;      // API 密钥（加密）
  isActive: boolean;   // 是否启用
  createdAt: string;   // 创建时间
  lastUsed: string;    // 最后使用时间
}
```

**索引**：
- `_id`（默认）
- `openid` + `serviceName`（唯一索引）

---

## 8. pipeline_status — 流水线状态（临时集合）

```typescript
interface PipelineStatusDoc {
  _id: string;          // 流水线 ID
  openid: string;       // 用户 openid
  status: string;       // queued | preprocessing | recognizing | generating | composing | completed | failed
  progress: number;     // 0-100
  imageFileID: string;  // 图片云文件 ID
  themeId: string;      // 主题 ID
  result?: {            // 完成后的结果
    foodName: string;
    foodType: string;
    gameDescription: string;
  };
  createdAt: string;    // 创建时间
  updatedAt: string;    // 更新时间
}
```

---

## 安全规则

所有集合默认仅创建者可读写，云函数使用管理员权限操作。前端通过 `wx.cloud.callFunction()` 间接访问数据，不直接操作数据库。

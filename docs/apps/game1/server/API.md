# Game1 Server API 文档

**基础路径**: `/api/v1/game1`

**认证方式**:

| 中间件 | 说明 |
|--------|------|
| `no auth` | 无需认证，完全公开 |
| `requireAuth` | 需要 Bearer Token (JWT)，通过微信登录获取 |
| `optionalAuth` | 可选认证，携带 Token 可获取个性化数据 |
| `requireAdmin` | 需要管理员权限（`requireAuth` + admin role 或 adminToken） |

---

## auth — 认证

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/auth/login` | no auth | 微信登录，通过 `code` 换取 JWT Token |
| GET | `/auth/me` | requireAuth | 获取当前登录玩家的基本信息 |

### POST /auth/login

使用微信临时 code 登录，返回 JWT Token 和玩家信息。

**请求体**:
```json
{
  "code": "string"  // 微信登录临时 code
}
```

**响应**:
```json
{
  "token": "string",
  "player": { ... }
}
```

### GET /auth/me

获取当前登录玩家的详细信息。

---

## players — 玩家

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/players/:id` | requireAuth | 获取指定玩家的信息 |
| PUT | `/players/:id/profile` | requireAuth | 更新玩家资料（昵称、头像） |
| GET | `/players/:id/stats` | requireAuth | 获取玩家统计信息 |
| PUT | `/players/:id/sync` | requireAuth | 同步游戏数据（带增速校验） |
| POST | `/players/:id/reconcile` | requireAuth | 登录调协（计算离线收益，客户端启动时调用一次） |
| GET | `/rankings` | optionalAuth | 排行榜 |

### PUT /players/:id/sync

同步服务端权威数据，包含增速校验防止篡改。

**请求体**:
```json
{
  "level": "number",
  "exp": "number",
  "gold": "number",
  "gems": "number",
  "totalMileage": "number",
  "playTime": "number",
  "prestigeCount": "number"
}
```

**响应**:
```json
{
  "player": { ... },
  "corrected": "boolean",       // 是否发生过纠偏
  "corrections": "string[]"     // 纠偏原因列表
}
```

### POST /players/:id/reconcile

服务端计算玩家离线期间的收益，返回权威数据。

### GET /rankings

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| sortBy | string | `totalMileage` | 排序字段（`totalMileage` / `level`）|
| limit | number | `50` | 返回数量（最大 100）|
| offset | number | `0` | 偏移量 |

---

## save — 云端存档

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| PUT | `/save/:playerId` | requireAuth | 上传存档（支持版本冲突智能合并） |
| GET | `/save/:playerId` | requireAuth | 下载存档 |
| DELETE | `/save/:playerId` | requireAuth | 删除存档 |
| GET | `/save/:playerId/meta` | requireAuth | 获取存档元信息（版本、校验和、更新时间） |

### PUT /save/:playerId

存档大小限制为 1MB。当提供 `expectedVersion` 且与服务端版本不匹配时，自动执行智能合并。

**请求体**:
```json
{
  "saveData": "object",             // 存档数据
  "expectedVersion": "number"       // 可选，客户端已知的版本号
}
```

**响应（合并）**:
```json
{
  "merged": "boolean",
  "save": { "version": "number", "checksum": "string", ... },
  "conflicts": "string[]"
}
```

---

## pvp — PVP 对战

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/pvp/result` | requireAuth | 提交对战结果 |
| GET | `/pvp/leaderboard` | optionalAuth | PVP 排行榜 |
| GET | `/pvp/rank/:playerId` | optionalAuth | 获取玩家排名与段位 |
| GET | `/pvp/history` | requireAuth | 获取当前玩家的对战历史 |

### POST /pvp/result

提交 PVP 对战结果，触发 ELO 评分更新。

**请求体**:
```json
{
  "opponentId": "number",         // 对手 ID
  "result": "victory|defeat|draw", // 对战结果
  "battleLog": "object"           // 可选，对战日志
}
```

### GET /pvp/leaderboard

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | number | `50` | 返回数量（最大 100）|
| offset | number | `0` | 偏移量 |

### GET /pvp/history

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | number | `20` | 返回数量（最大 100）|
| offset | number | `0` | 偏移量 |

---

## achievements — 成就系统

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/achievements/check` | requireAuth | 检查当前玩家所有成就条件，解锁符合条件的成就 |
| GET | `/achievements/:playerId` | requireAuth | 获取指定玩家的完整成就列表（含已解锁和未解锁） |

### POST /achievements/check

服务端读取玩家的 `totalMileage`、`level`、`pvpWins`、`prestigeCount`、`loginDays` 等数据，自动解锁满足条件的成就。

**响应**:
```json
{
  "unlocked": [ "achievementId1", "achievementId2", ... ]
}
```

---

## config — 游戏配置

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/config/:key` | no auth | 获取单个配置项的值 |
| GET | `/config/keys` | no auth | 获取所有配置键名 |
| POST | `/config/batch` | no auth | 批量获取配置项 |
| PUT | `/config/:key` | requireAdmin | 更新配置项 |

### POST /config/batch

**请求体**:
```json
{
  "keys": ["string", "string", ...]
}
```

**响应**:
```json
{
  "configs": { "key1": "value1", "key2": "value2", ... }
}
```

### PUT /config/:key

**请求体**:
```json
{
  "value": "any"
}
```

---

## admin — 管理后台

所有 admin 路由均需要管理员权限（`requireAdmin`）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/players` | 玩家列表（分页 + 搜索 + 排序） |
| GET | `/admin/dashboard` | 运营数据概览 |
| DELETE | `/admin/players/:id` | 软删除玩家 |
| GET | `/admin/achievements` | 成就统计（各成就解锁人数 + 解锁率） |
| GET | `/admin/pvp/leaderboard` | PVP 排行榜（管理员版） |
| GET | `/admin/players/:id/detail` | 玩家详细信息（含成就/PVP/存档） |
| GET | `/admin/pvp/matches` | PVP 对战记录列表 |
| GET | `/admin/achievements/trend` | 成就解锁趋势 |
| GET | `/admin/share-stats` | 全局分享统计 |

### GET /admin/players

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | `1` | 页码 |
| pageSize | number | `20` | 每页数量（最大 100）|
| search | string | - | 搜索关键词 |
| sortBy | string | - | 排序字段 |
| sortOrder | string | - | 排序方向（`asc` / `desc`）|

### GET /admin/pvp/matches

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | `1` | 页码 |
| pageSize | number | `20` | 每页数量（最大 100）|
| playerId | number | - | 按玩家 ID 筛选 |

### GET /admin/achievements/trend

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| days | number | `30` | 统计天数（最大 365）|

---

## social — 社交分享

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/social/share-callback` | requireAuth | 记录分享事件 |
| GET | `/social/share-stats` | requireAuth | 获取当前玩家的分享统计 |

### POST /social/share-callback

**请求体**:
```json
{
  "shareType": "pvp_victory|prestige|achievement|normal"
}
```

### GET /social/share-stats

返回当前玩家的分享次数和各类分享统计。

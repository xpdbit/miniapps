# FTG 后端 API 参考

> 基础路径：所有路由挂载在 `/api/v1` 前缀下。
> 响应格式：`{ success: boolean, errCode: number, errMsg: string, data: any }`
> 鉴权方式：`Authorization: Bearer <JWT>` 请求头。

## 健康检查

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/health` | 否 | 服务健康检查，返回 `{ status, timestamp }` |

Swagger UI 可通过 `GET /api/v1/docs` 访问。

---

## 认证（Auth）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/v1/auth/login` | 否 | 微信 code 登录，返回 JWT token |
| GET | `/api/v1/auth/me` | 是 | 获取当前用户信息 |
| PATCH | `/api/v1/auth/me` | 是 | 更新昵称（nickname）或头像 URL（avatarUrl） |
| POST | `/api/v1/auth/avatar` | 是 | 上传头像，multipart/form-data，字段名 avatar，上限 5MB |
| GET | `/api/v1/auth/avatar/view/:filename` | 否 | 访问头像文件（绕过微信 URL 限制） |
| POST | `/api/v1/auth/decrypt-user-info` | 是 | 解密微信加密数据（encryptedData + iv），更新用户资料 |

---

## 用户（Users）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/v1/users/me/stats` | 是 | 当前用户统计（记录数 / 打卡数 / 食物类型分布） |
| GET | `/api/v1/users/me/profile` | 是 | 当前用户公开资料 |
| GET | `/api/v1/users` | 是 | 分页用户列表（admin），支持 page / pageSize / keyword / startDate / endDate |
| GET | `/api/v1/users/:id/stats` | 是 | 指定用户统计（admin） |

---

## 食物记录（Records）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/v1/records` | 是 | 创建食物记录，multipart/form-data（字段 + image），上限 10MB |
| GET | `/api/v1/records` | 是 | 分页查询，支持 page / limit / foodType / themeId 过滤 |
| GET | `/api/v1/records/search` | 是 | 模糊搜索，参数 `?q=keyword` |
| GET | `/api/v1/records/stats` | 是 | 统计（食物类型分布 + 日期趋势） |
| GET | `/api/v1/records/:id` | 是 | 记录详情 |
| DELETE | `/api/v1/records/:id` | 是 | 软删除记录 |

---

## AI 流水线（Pipeline）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/v1/pipeline/start` | 是 | 上传图片启动 AI 流水线（识别 + 描述 + 存储），返回 pipelineId |
| GET | `/api/v1/pipeline/:id/status` | 是 | 查询流水线执行状态和结果 |

内部流程：图片识别 → AI 文本生成 → 主题渲染 → OSS 存储。限制 5 次/分钟/用户。

---

## 食物识别（Recognize）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/v1/recognize` | 是 | 图片食物识别，调用 PP-ShiTuV2，multipart，上限 10MB |

---

## AI 文本生成（Text Gen）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/v1/generate-text` | 是 | AI 生成食物主题描述（DashScope / 通义千问），参数 foodName / foodType / themeId |

---

## 打卡（Checkins）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/v1/checkins` | 是 | 打卡。参数 foodRecordId, latitude?, longitude?, locationName? |
| GET | `/api/v1/checkins` | 是 | 打卡列表，分页（page / limit） |
| GET | `/api/v1/checkins/today` | 是 | 今日打卡状态 |
| GET | `/api/v1/checkins/streak` | 是 | 连续打卡天数 |

---

## 主题（Themes）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/v1/themes` | 否 | 主题列表，支持 `?isActive=true&projectId=ftg` 过滤 |
| GET | `/api/v1/themes/by-short/:shortName` | 否 | 通过短命名查询主题 |
| GET | `/api/v1/themes/:themeId` | 否 | 主题详情（含 templateMarkup, cssClasses） |
| GET | `/api/v1/themes/:themeId/stats` | 否 | 主题使用统计 |
| POST | `/api/v1/themes` | 是 | 创建主题。参数 name, gameName, description?, shortName? 等 |
| PUT | `/api/v1/themes/:themeId` | 是 | 更新主题 |
| PATCH | `/api/v1/themes/:themeId/toggle` | 是 | 切换主题启用/禁用状态 |
| DELETE | `/api/v1/themes/:themeId` | 是 | 删除主题（被引用时返回 409） |
| POST | `/api/v1/themes/:themeId/usage` | 否 | 记录主题使用次数。参数 recordId, userId |

---

## CSS Class（Theme Classes）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/v1/theme-classes` | 否 | Class 列表，支持 `?projectId=ftg&category=official` 过滤 |
| GET | `/api/v1/theme-classes/allowed-properties` | 否 | CSS 属性白名单 |
| GET | `/api/v1/theme-classes/:classId` | 否 | 单个 class 详情 |
| POST | `/api/v1/theme-classes` | 是 | 创建 class。参数 name, cssProperties, category?, description? |
| PUT | `/api/v1/theme-classes/:classId` | 是 | 更新 class |
| DELETE | `/api/v1/theme-classes/:classId` | 是 | 删除 class（被主题引用时返回 409） |

---

## 主题渲染（Theme Render）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/v1/theme/render` | 否 | 通用模板渲染，返回结构化的 html + css |
| POST | `/api/v1/theme/render-preview` | 是 | 管理端模板预览，返回渲染 HTML |

---

## 成就（Achievements）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/v1/achievements` | 是 | 所有成就定义列表 |
| GET | `/api/v1/achievements/my` | 是 | 当前用户成就解锁进度 |
| POST | `/api/v1/achievements/check` | 是 | 检查条件并解锁成就，返回新解锁列表 |

---

## API 密钥（API Keys）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/v1/api-keys` | 是 | 设置 API Key（加密存储）。参数 serviceName, apiKey |
| GET | `/api/v1/api-keys/:serviceName` | 是 | 检查指定服务 Key 是否存在 |
| DELETE | `/api/v1/api-keys/:serviceName` | 是 | 删除指定服务 Key |

---

## 收藏（Favorites）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/v1/favorites` | 是 | 收藏食物记录。参数 recordId |
| DELETE | `/api/v1/favorites/:recordId` | 是 | 取消收藏 |
| GET | `/api/v1/favorites` | 是 | 收藏列表，分页（page / limit） |
| GET | `/api/v1/favorites/check` | 是 | 批量检查收藏状态，参数 `?ids=1,2,3` |

---

## 分享（Share）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/v1/share-card` | 是 | 生成食物记录分享卡片。参数 foodRecordId |

---

## 定位（Location）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/v1/location/ip` | 可选 | IP 地理定位，返回 city / province / district。底层调用 ip-api.com |

---

## 文件上传（Upload）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/v1/upload` | 是 | 通用图片上传（base64 JSON），返回可公开访问的 URL |

## 错误码说明

| errCode | 说明 |
|---------|------|
| 0 | 成功 |
| 1000 | 服务器内部错误 |
| 1001 | 参数错误或缺失 |
| 1003 | 资源不存在 |
| 1004 | 跨域请求被拒绝 |
| 2000 | 未登录 |
| 2001 | 用户不存在 |
| 400 | 请求参数无效（部分模块使用） |
| 500 | 上传失败 |
| 7000 | 记录模块错误 |
| — | 各模块定义的专属错误码 |

> 完整错误码枚举见 `src/types/api.ts` 中的 `ErrorCode`。

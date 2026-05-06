# ftg-miniapp — 微信小程序

**食物主题生成器 (FTG)** 的小程序前端，基于 Taro 4.x + React 18。

## 技术栈

- **框架**: Taro 4.x (React 18)
- **语言**: TypeScript (strict)
- **样式**: Sass (.scss) 模块化
- **状态管理**: Zustand
- **HTTP 客户端**: Taro.request 封装 (JWT 自动携带)

## 页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `pages/home/index` | 主要功能入口 |
| 拍照 | `pages/camera/index` | 食物拍照 |
| 结果 | `pages/result/index` | AI 识别结果展示 |
| 我的 | `pages/profile/index` | 个人中心 |
| 设置 | `pages/settings/index` | 主题偏好、API 配置 |
| 历史 | `pages/history/index` | 历史记录 |
| 打卡 | `pages/checkin/index` | 位置打卡 |
| 统计 | `pages/stats/index` | 饮食数据统计 |
| 成就 | `pages/achievements/index` | 成就系统 |
| 图鉴 | `pages/gallery/index` | 美食图鉴 |
| 收藏 | `pages/favorites/index` | 收藏记录 |
| 记录 | `pages/record/index` | 打卡记录列表 |

## 组件库

共享组件位于 `src/components/`：
- **AppButton** — 4 种变体的按钮
- **AppCard** — 通用卡片
- **SectionHeader** — 区块标题
- **EmptyState** — 空状态占位
- **Icon** — 18 个内联 SVG 图标
- **Skeleton** — 4 种骨架屏
- **charts/** — 原生 Canvas 2D 图表（折线/饼图/柱状图/热力图）

## 核心服务

- **认证**: 微信登录 (`wx.login`) → JWT token → 自动校验
- **HTTP**: HttpClient 封装（超时检测 + 中文错误提示）
- **自定义 tabBar**: eventCenter 事件驱动高亮

## 文档

- [API.md](./API.md) — 云函数 API 参考（旧架构）
- [DATABASE.md](./DATABASE.md) — 数据库设计（旧架构）
- [DEVELOPMENT.md](./DEVELOPMENT.md) — 开发指南

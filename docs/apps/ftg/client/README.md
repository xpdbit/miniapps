# FTG 小程序 — 食物主题生成器

> 基于 Taro 4.x + React 18 + TypeScript 的跨平台微信小程序，AI 识别食物并生成个性化主题图片。

## 技术栈

| 层 | 技术 |
|------|------|
| 框架 | Taro 4.x + React 18 |
| 语言 | TypeScript strict |
| 状态管理 | Zustand |
| 样式 | Sass + CSS Modules (`.module.scss`) |
| 图表 | Canvas 2D 原生绘制（4 种图表） |
| 后端 API | Express + Prisma ORM |
| AI 识别 | PP-ShiTuV2 独立容器 |

## 页面（12 + 1 隐私）

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `pages/home` | 今日打卡状态、拍照入口、最近记录 |
| 相机 | `pages/camera` | 拍照/相册选图、闪光灯切换、上传识别 |
| 结果 | `pages/result` | AI 识别结果展示、主题合成图、保存/重拍/分享 |
| 画廊 | `pages/gallery` | 3 个子 Tab：历史照片 / 收藏 / 主题管理 |
| 记录编辑 | `pages/record` | 手动创建/编辑食物记录表单 |
| 记录详情 | `pages/record/detail` | 单条记录查看、软删除、分享 |
| 收藏 | `pages/favorites` | 收藏列表、取消收藏、分页加载 |
| 历史 | `pages/history` | 记录列表、搜索、筛选、排序、分组 |
| 成就 | `pages/achievements` | 成就展示、进度条、解锁状态 |
| 统计 | `pages/stats` | 热量趋势折线图、类型分布饼图、排行柱状图、打卡日历热力图 |
| 个人 | `pages/profile` | 头像昵称、功能入口、统计概览 |
| 打卡 | `pages/checkin` | GPS/IP 定位打卡、连续天数记录 |
| 设置 | `pages/settings` | AI 服务状态、混元 API Key 管理 |

## 组件（9 个）

- **AppButton** — 4 种变体（主/次/文字/图标）
- **AppCard / SectionHeader / EmptyState** — 通用布局
- **Loading** — 3 种加载模式
- **Icon** — 18 个内联 SVG 图标
- **Skeleton** — 4 种骨架屏类型
- **Canvas 图表** — LineChart / PieChart / BarChart / CalendarHeatmap（原生 Canvas 2D）

## 数据流

- **认证**：微信登录 → `wx.login()` → `POST /auth/login` → JWT 本地持久化 → 自动校验初始化
- **HTTP**：`HttpClient` 封装 `Taro.request`，自动携带 JWT，超时检测 + 中文错误提示
- **Mock 降级**：`TARO_APP_MOCK_AUTH=true` 绕过微信授权，用于 H5 开发
- **架构**：双路径 API（HTTP API 为主，云函数为遗留兼容），自定义 tabBar 由 `eventCenter` 事件驱动高亮

## 目录结构

```
src/
├── app.ts               # 入口（认证初始化）
├── app.config.ts        # 路由配置（3 tabBar + 10 子页面）
├── app.scss             # CSS 变量系统（颜色/字体/间距/阴影/z-index）
├── pages/               # 12 页面
├── components/          # 9 组件（含 charts/ 子目录）
├── stores/              # authStore（Zustand）
├── services/            # 6 业务服务 + httpClient
├── hooks/               # usePipelineStatus
├── custom-tab-bar/      # 自定义底部导航
├── types/               # 7 类型定义文件
├── constants/           # 6 常量文件
└── utils/               # 图片处理、定位（GPS+IP）、Canvas 合成、分享、错误边界
```

## 开发命令

```bash
npm run dev:weapp        # 微信开发者工具（watch）
npm run build:weapp      # 生产构建
npm run dev:h5           # H5 模式（watch）
npm run build:h5         # H5 生产构建
npm run type-check       # TypeScript 类型检查
```

## 路由配置

底部 3 个 tabBar 页面：首页、画廊、个人。其余页面为 subPackages 子路由，按需加载。

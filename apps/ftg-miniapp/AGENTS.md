# apps/ftg-miniapp — 微信小程序

## OVERVIEW
Taro 4.x 微信小程序 (React 18 + TypeScript + Sass)，AI 图片识别食材 → Canvas 合成主题图片。

## STRUCTURE
```
apps/ftg-miniapp/
├── src/
│   ├── app.ts           # 小程序入口
│   ├── pages/           # 页面组件 (home/camera/gallery/result/record/stats等)
│   ├── components/      # 共享组件
│   │   ├── AppButton/   # 通用按钮 (4变体+loading)
│   │   ├── AppCard/     # 通用卡片
│   │   ├── SectionHeader/ # 区域标题组件
│   │   ├── EmptyState/  # 空状态组件
│   │   ├── Skeleton/    # 骨架屏 (4类型)
│   │   ├── Icon/        # SVG 图标系统 (18图标)
│   │   ├── charts/      # Canvas 2D 图表 (Line/Pie/Bar/CalendarHeatmap)
│   │   └── Loading.tsx  # 加载遮罩 (含type/zIndex)
│   ├── hooks/           # 自定义 Hooks
│   ├── stores/          # Zustand 状态管理 (authStore)
│   ├── custom-tab-bar/  # 自定义底部栏 (替代原生 tabBar)
│   ├── services/        # 云函数调用/API 封装
│   │   ├── db/          # 云数据库 DAL 层 (10个)
│   │   ├── httpClient.ts # 统一 HTTP 客户端 (JWT 自动携带)
│   │   ├── authService.ts # 微信登录 + Token 验证封装
│   │   └── themeApi.ts  # 主题 HTTP API 服务
│   ├── types/           # TypeScript 类型定义
│   ├── constants/       # 常量定义
│   └── utils/           # 工具函数 (Canvas/图片/定位/分享)
├── cloudfunctions/      # 云函数 (servers/ftg-server 的 REST API 正在替代中)
├── config/              # Taro 构建配置
├── project.config.json  # 微信开发者工具配置
└── tsconfig.json        # TypeScript 配置
```

## WHERE TO LOOK
| 任务 | 位置 | 说明 |
|------|------|------|
| 页面 | `src/pages/` | 12 个页面 (home/camera/gallery/result等) |
| 共享组件库 | `src/components/` | AppButton/AppCard/SectionHeader/EmptyState/Icon(18SVG)/Skeleton(4类型)/Loading |
| 图表组件 | `src/components/charts/` | Canvas 2D 原生图表 (Line/Pie/Bar/CalendarHeatmap) |
| 主题画廊 | `src/pages/gallery/` | API 优先 + 本地回退 |
| 主题 HTTP API | `src/services/themeApi.ts` | 对接 servers/ftg-server 的 RESTful 主题接口 |
| 认证 HTTP 服务 | `src/services/authService.ts` | 微信登录 + Token 验证封装 |
| HTTP 客户端 | `src/services/httpClient.ts` | 统一 HTTP 封装 (JWT 自动携带) |
| 认证状态管理 | `src/stores/authStore.ts` | Zustand 认证状态 (token/user/初始化) |
| 自定义 tabBar | `src/custom-tab-bar/` | 自定义底部栏 (事件驱动高亮) |
| 全局样式 | `src/app.scss` | CSS 变量系统（颜色/字体/间距/阴影/z-index） |
| 样式 | `src/` | Sass (.scss) 模块化样式 |

## CONVENTIONS
- Taro 4.x API，构建命令 `taro build --type weapp`
- React 18 + TypeScript strict 模式
- Sass 模块化样式 (`.module.scss`)
- 路径别名 `@/*`, `@utils/*`, `@components/*`, `@services/*`, `@types/*`, `@constants/*`
- Prettier: printWidth 100, singleQuote, trailingComma all

## ANTI-PATTERNS
- ❌ `textGenerate` 云函数为占位实现 — 待接入混元 AI
- ❌ `getUserStats` 云函数返回硬编码零值 — 需实现数据库聚合
- ❌ 不得在组件中直接写复杂业务逻辑 — 抽到 hooks/services
- ❌ 禁止 `eslint-disable` 无充分理由的注释
- ❌ **空 catch 块** — `src/app.ts` 有 4 个空 catch 块（line 55 "环境不支持时静默"、line 94/117/131 "Toast 失败时静默处理"），应添加错误日志
- ❌ **TODO 占位实现** — `src/pages/result/index.tsx` line 108 `// TODO: 调用云函数保存食物记录`，handleSave 未完成
- ❌ **Mock 降级代码** — `src/stores/authStore.ts` 存在 `TARO_APP_MOCK_AUTH=true` mock 分支，上线前需清理

## COMMANDS
```bash
npm run dev:weapp        # Taro 开发模式 (watch 热重载)
npm run build:weapp      # Taro 生产构建
npm run build:weapp:prod # 生产+压缩构建
npm run type-check       # TypeScript 类型检查
npm run lint             # ESLint 代码检查
npm run format           # Prettier 格式化
```

## NOTES
- **CSS 变量系统**: `app.scss` 定义了完整的颜色/字体/间距/阴影/z-index 变量
- **图标系统**: Icon 组件使用 `<Image>` + data URI 渲染 SVG，支持 size/color prop，由 `@/components/Icon` 导入
- **图表组件**: charts/ 下的 4 个图表使用原生 Canvas 2D，没有第三方图表依赖，类型在 `@/components/charts` 中定义
- **共享组件**: 从 `@/components` barrel 统一导出（AppButton/AppCard/SectionHeader/EmptyState/Icon/Skeleton/Loading）
- **页面动画**: 各页面已添加淡入/滑动动画，`app.scss` 包含全局 `prefers-reduced-motion` 支持
- 云函数上传需通过微信开发者工具或 cloudbaserc.json 配置
- AI 流水线: 前端触发 → `orchestrateAIPipeline` 编排 → 多函数并行处理 → 返回结果
- 图片合成在前端完成 (Canvas 2D)，非服务端合成
- **认证流程**: wx.login() → POST /auth/login → JWT token → Taro Storage 持久化 → 自动校验(initialize)
- **自定义 tabBar**: CustomTabBar 组件使用 Taro eventCenter 监听 tabChange 事件驱动高亮，替代原生 tabBar
- **HTTP 客户端**: HttpClient 类封装 Taro.request，支持超时检测和网络连接错误中文提示
- `.FoodThemeGenerator_MiniAPP/` 为旧版，勿修改

# ftg-miniapp — 微信小程序

## OVERVIEW
Taro 4.x 微信小程序 (React 18 + TypeScript + Sass)，AI 图片识别食材 → Canvas 合成主题图片。

## STRUCTURE
```
ftg-miniapp/
├── src/
│   ├── app.ts           # 小程序入口
│   ├── pages/           # 页面组件 (home/camera/theme/result等)
│   ├── components/      # 共享组件
│   ├── hooks/           # 自定义 Hooks
│   ├── services/        # 云函数调用/API 封装
│   │   ├── db/          # 云数据库 DAL 层 (10个)
│   │   └── themeApi.ts  # 主题 HTTP API 服务
│   ├── types/           # TypeScript 类型定义
│   ├── constants/       # 常量定义
│   └── utils/           # 工具函数 (Canvas/图片/定位/分享)
├── cloudfunctions/      # 云函数 (ftg-server 的 REST API 正在替代中)
├── config/              # Taro 构建配置
├── project.config.json  # 微信开发者工具配置
└── tsconfig.json        # TypeScript 配置
```

## WHERE TO LOOK
| 任务 | 位置 | 说明 |
|------|------|------|
| 页面 | `src/pages/` | 12 个页面 (home/camera/gallery/result等) |
| 组件 | `src/components/` | Loading 等共享组件 |
| 主题画廊 | `src/pages/gallery/` | API 优先 + 本地回退 |
| 主题 HTTP API | `src/services/themeApi.ts` | 对接 ftg-server 的 RESTful 主题接口 |
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
- 云函数上传需通过微信开发者工具或 cloudbaserc.json 配置
- AI 流水线: 前端触发 → `orchestrateAIPipeline` 编排 → 多函数并行处理 → 返回结果
- 图片合成在前端完成 (Canvas 2D)，非服务端合成
- `.FoodThemeGenerator_MiniAPP/` 为旧版，勿修改

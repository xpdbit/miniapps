# 🍔 食物主题生成器 (Food Theme Generator)

基于 **Taro 4.x + React 18 + TypeScript** 的微信小程序，通过 AI 识别食物并生成个性化主题图片。

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Taro 4.x + React 18 + TypeScript |
| 后端 | 微信云开发 CloudBase |
| 食物识别 | PP-ShiTuV2 (PaddleClas) - CloudRun 部署 |
| 主题合成 | Canvas 2D 图片合成 |
| 文本生成 | 腾讯混元大模型 |
| 用户认证 | CloudBase 天然免登录 |

## 📁 目录结构

```
food-theme-generator/
├── config/                  # Taro 构建配置
│   ├── index.ts            # 主配置
│   ├── dev.ts              # 开发环境
│   └── prod.ts             # 生产环境
├── src/
│   ├── pages/              # 页面
│   │   └── index/          # 首页
│   ├── components/         # 公共组件
│   ├── utils/              # 工具函数
│   ├── types/              # TypeScript 类型定义
│   ├── constants/          # 全局常量
│   ├── services/           # 业务服务层
│   ├── assets/             # 静态资源
│   │   └── icons/          # 图标
│   ├── app.ts              # 应用入口 (CloudBase 初始化)
│   ├── app.config.ts       # 应用配置 (路由/tabBar)
│   ├── app.scss            # 全局样式 (CSS 变量主题)
│   └── index.html          # HTML 入口
├── cloudfunctions/         # 云函数目录
├── project.config.json     # 微信小程序配置
├── tsconfig.json           # TypeScript 配置 (strict)
├── .eslintrc.js            # ESLint 配置
├── .prettierrc             # Prettier 配置
└── .editorconfig           # 编辑器配置
```

## 🚀 快速开始

### 前置要求

- Node.js >= 18
- npm >= 9
- 微信开发者工具（最新稳定版）
- 微信小程序 AppID（注册微信公众平台获取）

### 安装与运行

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.dev .env
# 编辑 .env，填入 CloudBase 环境ID 和 AI 服务 Endpoint

# 3. 配置 project.config.json
# 将 "appid" 替换为你的小程序 AppID

# 4. 开发模式运行
npm run dev:weapp

# 5. 生产构建
npm run build:weapp:prod
```

### 在微信开发者工具中

1. 打开微信开发者工具
2. 导入项目，选择本项目根目录
3. 填入 AppID
4. 开始调试

## 📝 开发规范

- **TypeScript 严格模式**：禁止 `any` 类型，禁止 `@ts-ignore`
- **ESLint 零容忍**：提交前通过 `npm run lint` 检查
- **禁止 console.log**（生产代码）：使用 `console.warn` / `console.error` 替代
- **组件禁止直用 `wx` API**：统一通过服务层封装调用

## 🤖 环境变量

| 变量 | 说明 |
|------|------|
| `CLOUDBASE_ENV_ID` | CloudBase 环境 ID |
| `HUNYUAN_ENDPOINT` | 混元 AI 服务端点 |
| `PPSHITU_ENDPOINT` | PP-ShiTuV2 食物识别端点 |

## 📋 开发计划

详见 `Plan/大任务/大任务队列.md`

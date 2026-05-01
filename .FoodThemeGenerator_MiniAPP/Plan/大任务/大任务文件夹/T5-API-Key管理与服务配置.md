# T5: API Key管理与服务配置

- **波次**: 1
- **预估时长**: 3-4 小时
- **依赖**: T1, T3
- **阻塞**: T4, T10

## 做什么

1. 在云函数 `manageApiKey` 中实现API Key的加密存储（AES-256加密）
2. 实现 API Key 的 CRUD 操作: 添加、查看（脱敏显示）、更新、删除
3. 创建设置页面（`src/pages/settings/`）:
   - 显示当前AI服务状态:
     - PP-ShiTuV2 食物识别服务（自部署，显示CloudRun服务状态）
     - 混元AI文本生成服务（显示Key状态：默认 / 自定义）
   - 混元AI配置区域：用户输入 API Key，测试连接按钮
   - PP-ShiTuV2 服务状态检测：调用 `/health` 端点检查
   - 各服务剩余额度显示
4. 实现Key验证功能: 用户输入Key后，调用云函数验证有效性
5. 实现服务降级逻辑: 自定义Key失效时自动回退到默认服务
6. Key安全展示: 显示脱敏Key（`sk-****1234`），提供完整查看按钮（需二次确认）

> **注意**: PP-ShiTuV2 为自部署服务，不涉及外部API Key。T5 仅需管理混元AI的Key配置。

## 绝对不能做

- ❌ 不要在前端localStorage中明文存储API Key
- ❌ 不要在日志中打印完整API Key
- ❌ 不要在页面URL参数中传递API Key
- ❌ 不要跳过Key验证

## 推荐Agent配置

- **类别**: `visual-engineering` — 设置页面需要良好的UX设计
- **技能**: `[]`

## 验收标准

- [ ] 设置页面渲染正常，所有表单字段可交互
- [ ] 用户输入Key后"测试连接"按钮可验证有效性
- [ ] Key存储后脱敏显示（`sk-****abcd`）
- [ ] 自定义Key失效时自动回退默认服务
- [ ] 删除Key后确认提示正常弹出

## 提交

- **消息**: `feat(settings): 实现API Key管理与服务切换`
- **文件**: src/pages/settings/, cloudfunctions/manageApiKey/

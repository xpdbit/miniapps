# T10: AI流水线编排

- **波次**: 2
- **预估时长**: 4-5 小时
- **依赖**: T3, T4, T5, T8
- **阻塞**: T14

## 做什么

1. 在云函数 `orchestrateAIPipeline` 中实现AI处理的完整流水线:
   - 步骤1: 图片预处理
   - 步骤2: 调用 `foodRecognize` → 获取食物名称、热量、类型
   - 步骤3: 并行调用 `textGenerate` → 生成游戏风格描述
   - 步骤4: 等待客户端Canvas合成完成
   - 步骤5: 汇总结果 → 写入 `food_records` → 返回完整结果
2. 实现流水线状态机: `queued → preprocessing → recognizing → generating → composing → completed | failed`
3. 每个状态变更写入 `pipeline_status` 集合（前端轮询进度）
4. 实现错误处理和重试: 单服务失败重试3次（指数退避），全部失败降级处理
5. 实现并发队列管理（为后期接入高并发服务做准备）
6. 前端轮询机制: 创建 `usePipelineStatus` Hook，每2秒轮询
7. 实现"处理中"UI: 步骤进度条，预计剩余时间

## 绝对不能做

- ❌ 不要让前端直接调用多个云函数手动拼接
- ❌ 不要让失败的流水线静默退出
- ❌ 不要在流水线中忽略某个步骤的失败

## 推荐Agent配置

- **类别**: `deep` — 涉及状态机设计、并发控制和错误恢复策略
- **技能**: `[]`

## 验收标准

- [ ] 完整流水线从 imageFileID 输入到最终结果返回，全程自动化
- [ ] 流水线状态实时更新到数据库
- [ ] 单个步骤失败后自动重试，3次均失败后优雅降级
- [ ] 并发队列正常运行
- [ ] 前端进度条与后端状态同步

## 提交

- **消息**: `feat(pipeline): 实现AI流水线编排`
- **文件**: cloudfunctions/orchestrateAIPipeline/, src/hooks/usePipelineStatus.ts

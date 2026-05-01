# T3: 云函数API代理层

- **波次**: 1
- **预估时长**: 3-4 小时
- **依赖**: T1
- **阻塞**: T4, T5, T7, T8, T10

## 做什么

1. 创建所有云函数的脚手架项目结构（每个云函数独立目录，含 `index.js` + `package.json` + `config.json`）
2. 核心云函数列表:
   - `foodRecognize` — 调用百度AI菜品识别
   - `themeCompose` — Canvas主题合成（服务端合成备选）
   - `textGenerate` — 调用混元AI生成游戏风格描述
   - `getLocationByIP` — IP定位解析
   - `manageApiKey` — API Key的加密存储和验证
   - `createFoodRecord` — 创建食物记录（含事务）
   - `getUserStats` — 聚合查询用户统计数据
   - `checkAchievement` — 检查并解锁成就
   - `generateShareCard` — 生成分享卡片图片
3. 为每个云函数配置合理的超时时间和内存
4. 实现统一的云函数错误处理中间件
5. 实现云函数日志记录
6. 实现 API Key 的安全存储和读取
7. 配置云函数HTTP触发器

## 绝对不能做

- ❌ 不要在云函数代码中硬编码API Key
- ❌ 不要让云函数超时设置过短
- ❌ 不要在单个云函数中处理过多逻辑

## 推荐Agent配置

- **类别**: `deep` — 需要全局视角设计统一的错误处理和密钥管理
- **技能**: `[]`

## 验收标准

- [ ] 所有9个云函数目录结构创建完成
- [ ] 统一错误处理中间件在所有云函数中复用
- [ ] 日志记录格式统一
- [ ] API Key读取逻辑能从数据库或环境变量正确获取
- [ ] 至少一个云函数可通过开发者工具正常调用

## 提交

- **消息**: `feat(cloud): 构建云函数API代理层`
- **文件**: cloudfunctions/ 下所有文件

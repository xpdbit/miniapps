# T4: PP-ShiTuV2 食物识别服务（服务端部署）

- **波次**: 1
- **预估时长**: 5-6 小时
- **依赖**: T1, T2, T3
- **阻塞**: T10, T12

## 背景说明

> **原方案**：百度AI菜品识别（云端API）  
> **新方案**：PP-ShiTuV2（PaddleClas）—— 自部署，无调用次数限制，识别精度更高  
> **部署方式**：客户端部署不可行（PP-ShiTuV2需双模型+FAISS向量检索，小程序/浏览器不支持），必须服务端部署  
> **推荐架构**：CloudBase CloudRun（云托管）Docker + Paddle Serving，保持在CloudBase生态内

### 架构概览

```
微信小程序 → CloudBase云函数(foodRecognize) → CloudRun Docker(PP-ShiTuV2) → 返回结果
                                              ↓
                                         CloudBase云存储(图片)
                                              ↓
                                         CloudBase数据库(缓存)
```

## 做什么

### 第一部分：PP-ShiTuV2 服务端部署（CloudRun）

1. 创建 PP-ShiTuV2 Paddle Serving Docker 镜像:
   - 基于 `paddlepaddle/paddle:2.5.2` 基础镜像
   - 安装 PaddleServing + PP-ShiTuV2 依赖
   - 下载主体检测模型（PicoDet-LCNet_x2_5_mainbody，~30MB）
   - 下载特征提取模型（PPLCNetV2_base，~19MB）
   - 准备食物分类向量索引库（FAISS）
2. 在 CloudBase CloudRun 上部署容器:
   - 最低配置：2核4G（可满足单实例推理）
   - 配置环境变量：模型路径、端口号、日志级别
   - 配置健康检查端点 `GET /health`
3. 实现 PP-ShiTuV2 推理API:
   - `POST /predict` — 接收base64图片，返回识别结果
   - 返回格式: `{ foodName, confidence, category, nutrition{...}, gallery{...} }`
   - 支持批量推理：`POST /predict/batch`

### 第二部分：云函数代理层（foodRecognize）

4. 在云函数 `foodRecognize` 中集成 PP-ShiTuV2 服务:
   - 接收小程序端传来的图片 fileID
   - 从云存储下载图片 → 压缩到PP-ShiTuV2要求的规格（最大边≤640px, JPEG, quality=0.9）
   - 转换图片为 base64
   - 调用 CloudRun PP-ShiTuV2 服务 `POST /predict`
   - 解析返回结果，映射到业务字段
5. 实现结果缓存机制:
   - 基于图片 fileID 哈希缓存，24小时内直接返回缓存
   - 缓存存储到 `food_recognize_cache` 集合
6. 实现食物分类映射表:
   - PP-ShiTuV2原始输出（foodName）→ 业务分类（肉类/蔬菜/主食/汤类/甜点/饮品）
   - 基于预定义的关键词映射规则（如名称含"肉"→肉类，含"饭"→主食）
7. 实现错误处理和降级:
   - CloudRun 服务不可用 → 返回友好错误 `{errCode: -3, errMsg: '识别服务暂不可用，请稍后重试'}`
   - 图片质量过低/非食物 → PP-ShiTuV2返回低置信度(<0.3)时提示 `{errCode: -2, errMsg: '未识别到食物'}`
   - CloudRun QPS超限 → 自动等待重试（最多3次指数退避）

### 第三部分：食物知识库建设

8. 准备食物识别分类数据库:
   - 建立 `food_gallery` 集合（至少200种常见食物的向量索引）
   - 每种食物包含: 名称、分类、营养信息（每100g热量/蛋白质/脂肪/碳水）、示例图片
9. 实现向量检索增强:
   - PP-ShiTuV2提取图像特征向量 → FAISS检索最相似的食物条目
   - 返回Top-3候选结果及置信度

## 绝对不能做

- ❌ 不要在小程序客户端加载模型或运行推理
- ❌ 不要在云函数（Node.js）中直接运行PP-ShiTuV2
- ❌ 不要跳过图片预处理（PP-ShiTuV2对输入尺寸有要求）
- ❌ 不要假设所有图片都是食物（置信度<0.3时返回未识别）
- ❌ 不要将模型文件打包进云函数（太大，应放在CloudRun容器内）

## 模型与硬件规格

| 组件 | 说明 |
|------|------|
| 主体检测模型 | PicoDet-LCNet_x2_5_mainbody (~30MB) |
| 特征提取模型 | PPLCNetV2_base (~19MB) |
| CloudRun最低配置 | 2核4G，单实例推理延迟 50-90ms |
| CloudRun推荐配置 | 4核8G，支持并发推理 |
| 月费估算 | CloudRun按量计费，约 ¥100-300/月（根据调用量） |

## 推荐Agent配置

- **类别**: `deep` — 涉及Docker部署、模型服务化、向量检索和错误恢复策略
- **技能**: `[]`

## 验收标准

- [ ] CloudRun PP-ShiTuV2 服务成功部署，`GET /health` 返回 200
- [ ] `POST /predict` 传入有效食物图片 → 返回食物名称、分类、置信度
- [ ] 传入非食物图片 → 返回 `{errCode: -2, errMsg: '未识别到食物'}`
- [ ] 同一图片24小时内重复调用 → 返回缓存结果
- [ ] CloudRun 服务不可用时 → 云函数返回降级错误（非崩溃）
- [ ] food_gallery 集合包含至少200种食物数据
- [ ] 向量检索返回Top-3候选结果

## 参考文档

- PP-ShiTuV2 官方文档: https://github.com/PaddlePaddle/PaddleClas/blob/release/2.6/docs/zh_CN/models/PP-ShiTu/README.md
- Paddle Serving 部署: https://github.com/PaddlePaddle/PaddleClas/blob/release/2.6/docs/zh_CN/deployment/PP-ShiTu/paddle_serving.md
- CloudBase CloudRun 文档: https://docs.cloudbase.net/run/

## 提交

- **消息**: `feat(ai): 集成PP-ShiTuV2食物识别服务（CloudRun部署）`
- **文件**: cloudfunctions/foodRecognize/, docker/ppshituv2/, cloudbaserc.json (CloudRun配置)

# PP-ShiTuV2 食物识别服务

## 部署方式

在 CloudBase CloudRun 上部署 Docker 容器。

### 1. 构建镜像

```bash
cd docker/ppshituv2
docker build -t ppshituv2-food-recognize .
```

### 2. 推送到 CloudRun

```bash
# 使用 CloudBase CLI 部署
tcb cloudrun deploy -e your-env-id \
  --name ppshituv2 \
  --image ppshituv2-food-recognize:latest \
  --port 8080 \
  --cpu 2 --mem 4G \
  --min-num 1 --max-num 5
```

### 3. 健康检查

```bash
curl https://your-service.run.tcloudbase.com/health
# → { "status": "ok", "version": "2.0.0" }
```

### 4. 测试识别

```bash
curl -X POST https://your-service.run.tcloudbase.com/predict \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "base64-encoded-image"}'
```

## API 文档

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |
| POST | /predict | 单张图片食物识别 |
| POST | /predict/batch | 批量图片识别 |

## 硬件要求

- 最低: 2 核 4GB
- 推荐: 4 核 8GB
- 单实例推理延迟: 50-90ms
- 约 100-300 元/月（按量计费）

## 模型信息

| 组件 | 模型 | 大小 |
|------|------|------|
| 主体检测 | PicoDet-LCNet_x2_5_mainbody | ~30MB |
| 特征提取 | PPLCNetV2_base | ~19MB |

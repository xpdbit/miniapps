# PP-ShiTuV2 食物识别服务 Docker 镜像
FROM paddlepaddle/paddle:2.5.2

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r /app/requirements.txt

# 复制应用代码
COPY app.py /app/

# 创建模型目录
RUN mkdir -p /app/models

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

WORKDIR /app
EXPOSE 8080

# 启动 Flask 服务
CMD ["python", "app.py"]

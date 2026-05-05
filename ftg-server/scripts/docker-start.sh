#!/bin/bash
# =============================================================================
# FTG_Server Docker 启动脚本
# 用法：./scripts/docker-start.sh [--build] [--profile <name>]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查 docker 和 docker compose 是否可用
if ! command -v docker &> /dev/null; then
    log_error "Docker 未安装。请先安装 Docker：https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    log_error "Docker Compose 插件未安装或版本过旧。请升级 Docker。"
    exit 1
fi

# 切换到项目目录
cd "$PROJECT_DIR"
log_info "工作目录：$(pwd)"

# 检查 .env.production 是否存在
if [ ! -f ".env.production" ]; then
    log_error ".env.production 文件不存在！"
    log_info "请从模板创建：cp .env.production .env.production.local 并编辑"
    exit 1
fi

# 检查必填环境变量
check_env_var() {
    local var_name="$1"
    local var_value
    var_value=$(grep -E "^${var_name}=" .env.production | cut -d'=' -f2-)
    if [ -z "$var_value" ] || [ "$var_value" = "\"\"" ] || [ "$var_value" = "''" ]; then
        log_warn "环境变量 ${var_name} 未设置。请编辑 .env.production"
    fi
}

check_env_var "MYSQL_PASSWORD"
check_env_var "MYSQL_ROOT_PASSWORD"
check_env_var "JWT_SECRET"
check_env_var "DASHSCOPE_API_KEY"
check_env_var "ENCRYPTION_KEY"

# 解析参数
BUILD_FLAG=""
PROFILE_FLAG=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --build)
            BUILD_FLAG="--build"
            shift
            ;;
        --profile)
            PROFILE_FLAG="--profile $2"
            shift 2
            ;;
        *)
            log_warn "未知参数：$1"
            shift
            ;;
    esac
done

# 启动服务
log_info "正在启动 FTG_Server 服务..."
log_info "服务清单：mysql, redis, ppshituv2, server"

# shellcheck disable=SC2086
docker compose --env-file .env.production up -d $BUILD_FLAG $PROFILE_FLAG

echo ""
log_info "所有服务已启动！"
echo ""
log_info "服务访问地址："
echo "  FTG_Server API:  http://localhost:3000"
echo "  健康检查:        http://localhost:3000/health"
echo "  MySQL:           localhost:3306"
echo "  Redis:           localhost:6379"
echo "  PP-ShiTuV2:     http://localhost:5000 (仅容器内部)"
echo ""

log_info "查看日志：docker compose --env-file .env.production logs -f [service_name]"
log_info "停止服务：docker compose --env-file .env.production down"

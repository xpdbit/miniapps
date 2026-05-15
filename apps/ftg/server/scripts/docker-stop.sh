#!/bin/bash
# =============================================================================
# FTG_Server Docker 停止脚本
# 用法：./scripts/docker-stop.sh [--rm] [--volumes]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$PROJECT_DIR"

# 解析参数
RM_FLAG=""
VOLUMES_FLAG=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --rm)
            RM_FLAG="--rmi all"
            shift
            ;;
        --volumes)
            VOLUMES_FLAG="-v"
            shift
            ;;
        *)
            log_warn "未知参数：$1"
            shift
            ;;
    esac
done

# 检查服务是否在运行
RUNNING_SERVICES=$(docker compose --env-file .env.production ps --services 2>/dev/null || true)
if [ -z "$RUNNING_SERVICES" ]; then
    log_info "没有运行中的 FTG_Server 服务。"
    exit 0
fi

log_info "正在停止 FTG_Server 服务..."

# shellcheck disable=SC2086
docker compose --env-file .env.production down $VOLUMES_FLAG $RM_FLAG

log_info "所有服务已停止。"

if [ -n "$VOLUMES_FLAG" ]; then
    log_warn "数据卷已删除，MySQL 和 Redis 数据将丢失！"
fi

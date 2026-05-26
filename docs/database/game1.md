# game1 库 — Game1

> **状态**: current
> **更新**: 2026-05-24

## 说明

Game1（挂机放置游戏）业务数据库。

## 表（7 表）

| 表名 | 说明 |
|------|------|
| `Player` | 玩家信息 |
| `CloudSave` | 云端存档（JSON 格式 + 版本号 + MD5 checksum，1MB 上限） |
| `PvpMatch` | PVP 对战记录 |
| `PvpRanking` | PVP 排行榜（ELO 评分 K=32） |
| `Achievement` | 成就记录 |
| `ShareLog` | 分享日志 |
| `GameConfig` | 游戏配置 |

---

> 最后更新: 2026-05-24

// ─── 统一 API 响应 ───
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  errCode?: number;
  errMsg?: string;
}

// ─── JWT Payload ───
export interface JwtPayload {
  playerId: string;
  uuid: string;
  role: 'player' | 'admin';
}

// ─── 玩家 ───
export interface PlayerProfile {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  level: number;
  totalMileage: number;
  playTime: number;
  prestigeCount: number;
}

// ─── 存档 ───
export interface CloudSaveData {
  version: number;
  checksum?: string;
  data: Record<string, unknown>;
  savedAt: string;
}

// ─── PVP ───
export interface PvpMatchResult {
  playerId: string;
  opponentId: string;
  result: 'victory' | 'defeat' | 'draw';
  battleLog?: Record<string, unknown>;
}

export interface PvpRankingEntry {
  rank: number;
  playerId: string;
  nickname: string | null;
  rating: number;
  wins: number;
  losses: number;
}

// ─── 排行榜 ───
export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string | null;
  avatarUrl: string | null;
  value: number;
}

// ─── 成就 ───
export interface AchievementCheckResult {
  achievementId: string;
  isUnlocked: boolean;
  progress: number;
}

// ─── 玩家统计 ───
export interface PlayerStats {
  totalPlayTime: number;
  totalMatches: number;
  wins: number;
  losses: number;
  currentRating: number;
  currentRank: string;
  totalMileage: number;
  achievementCount: number;
  level: number;
  prestigeCount: number;
}

// ─── 分页 ───
export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

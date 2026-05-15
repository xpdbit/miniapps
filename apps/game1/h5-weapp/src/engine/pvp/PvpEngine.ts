import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';
import { pickRandom } from '../../utils/random';

// ---------------------------------------------------------------------------
// 事件载荷类型
// ---------------------------------------------------------------------------

export interface PvpMatchFoundEvent {
  matchId: string;
  playerRating: number;
  opponentRating: number;
  opponentName: string;
}

export interface PvpMatchResultEvent {
  matchId: string;
  result: 'win' | 'loss' | 'draw';
  ratingChange: number;
  newRating: number;
}

// ---------------------------------------------------------------------------
// 核心类型
// ---------------------------------------------------------------------------

export interface PvpMatch {
  matchId: string;
  opponentName: string;
  opponentLevel: number;
  opponentRating: number;
  result: 'win' | 'loss' | 'draw' | 'pending';
  timestamp: number;
  ratingChange: number;
}

export interface PvpLeaderboardEntry {
  name: string;
  rating: number;
  wins: number;
  losses: number;
  rank: number;
}

export interface PvpSaveData {
  rating: number;
  seasonHigh: number;
  totalMatches: number;
  wins: number;
  losses: number;
  winStreak: number;
  matchHistory: PvpMatch[];
  playersRecord: Record<string, PvpPlayerStats>;
}

export interface PvpMatch {
  matchId: string;
  opponentName: string;
  opponentLevel: number;
  opponentRating: number;
  result: 'win' | 'loss' | 'draw' | 'pending';
  timestamp: number;
  ratingChange: number;
}

export interface PvpPlayerStats {
  playerId: string;
  rating: number;
  wins: number;
  losses: number;
  totalMatches: number;
  winStreak: number;
  lastMatchTime: number;
}

const AI_NAMES = ['流浪剑客', '暗夜行者', '铁壁守卫', '风语者', '烈焰法师', '冰霜骑士', '影刃刺客', '圣光牧师', '雷霆战士', '毒蛇猎手'];
const BASE_RATING = 1000;
const ELO_K = 32;

export class PvpEngine implements IModule {
  readonly moduleId = 'PvpEngine';
  private static _instance: PvpEngine;
  static get instance(): PvpEngine {
    if (!PvpEngine._instance) PvpEngine._instance = new PvpEngine();
    return PvpEngine._instance;
  }

  private rating = BASE_RATING;
  private seasonHigh = BASE_RATING;
  private totalMatches = 0;
  private wins = 0;
  private losses = 0;
  private winStreak = 0;
  private matchHistory: PvpMatch[] = [];

  /** 多玩家记录（扩展用） */
  private playersRecord: Map<string, PvpPlayerStats> = new Map();

  private constructor() {}

  // ========================================================================
  //  状态查询
  // ========================================================================

  getRating(): number { return this.rating; }

  getStats(): { rating: number; seasonHigh: number; totalMatches: number; wins: number; losses: number; winStreak: number } {
    return { rating: this.rating, seasonHigh: this.seasonHigh, totalMatches: this.totalMatches, wins: this.wins, losses: this.losses, winStreak: this.winStreak };
  }

  /** 获取指定玩家统计数据 */
  getPlayerStats(playerId: string): PvpPlayerStats | undefined {
    return this.playersRecord.get(playerId) ? { ...this.playersRecord.get(playerId)! } : undefined;
  }

  /** 获取或创建玩家记录 */
  private getOrCreatePlayer(playerId: string): PvpPlayerStats {
    const existing = this.playersRecord.get(playerId);
    if (existing) return existing;
    const record: PvpPlayerStats = {
      playerId,
      rating: BASE_RATING,
      wins: 0,
      losses: 0,
      totalMatches: 0,
      winStreak: 0,
      lastMatchTime: 0,
    };
    this.playersRecord.set(playerId, record);
    return record;
  }

  // ========================================================================
  //  匹配
  // ========================================================================

  /**
   * 寻找对手（AI 模拟）
   * @param playerId 当前玩家 ID
   * @returns 匹配对象
   */
  findMatch(playerId?: string): PvpMatch {
    const opponentRating = this.rating + Math.floor(Math.random() * 200 - 100);
    const match: PvpMatch = {
      matchId: `pvp_${Date.now()}`,
      opponentName: pickRandom(AI_NAMES),
      opponentLevel: Math.max(1, Math.floor(this.rating / 100)),
      opponentRating,
      result: 'pending',
      timestamp: Date.now(),
      ratingChange: 0,
    };

    this.matchHistory.push(match);

    // 发出匹配成功事件
    globalEventBus.emit<PvpMatchFoundEvent>('pvp:matchFound', {
      matchId: match.matchId,
      playerRating: this.rating,
      opponentRating,
      opponentName: match.opponentName,
    });

    // 记录玩家的匹配请求
    if (playerId) {
      this.getOrCreatePlayer(playerId);
    }

    return match;
  }

  // ========================================================================
  //  结算
  // ========================================================================

  /**
   * 提交对战结果
   * @param matchId 匹配 ID
   * @param result  结果
   * @param playerId 当前玩家 ID（可选，用于多玩家记录）
   * @returns 天梯分变化
   */
  submitMatchResult(matchId: string, result: 'win' | 'loss' | 'draw', playerId?: string): number {
    const expectedWinRate = 1 / (1 + 10 ** ((this.rating - BASE_RATING) / 400));
    const change = Math.round(ELO_K * ((result === 'win' ? 1 : result === 'draw' ? 0.5 : 0) - expectedWinRate));
    this.rating += change;
    if (this.rating > this.seasonHigh) this.seasonHigh = this.rating;
    this.totalMatches++;
    if (result === 'win') { this.wins++; this.winStreak++; }
    else if (result === 'loss') { this.losses++; this.winStreak = 0; }
    const match = this.matchHistory.find(m => m.matchId === matchId);
    if (match) { match.result = result; match.ratingChange = change; }

    // 更新玩家记录
    if (playerId) {
      const record = this.getOrCreatePlayer(playerId);
      record.rating = this.rating;
      record.totalMatches++;
      if (result === 'win') { record.wins++; record.winStreak++; }
      else if (result === 'loss') { record.losses++; record.winStreak = 0; }
      record.lastMatchTime = Date.now();
    }

    globalEventBus.emit<PvpMatchResultEvent>('pvp:matchResult', {
      matchId,
      result,
      ratingChange: change,
      newRating: this.rating,
    });

    return change;
  }

  // ========================================================================
  //  查询
  // ========================================================================

  getMatchHistory(limit = 20): PvpMatch[] { return this.matchHistory.slice(-limit).reverse(); }

  getLeaderboard(): PvpLeaderboardEntry[] {
    return [
      { name: '无名旅者', rating: this.rating, wins: this.wins, losses: this.losses, rank: 1 },
      { name: 'AI_Master', rating: 1500, wins: 120, losses: 45, rank: 2 },
      { name: 'DarkKnight', rating: 1350, wins: 89, losses: 34, rank: 3 },
      { name: 'SwiftWind', rating: 1200, wins: 67, losses: 28, rank: 4 },
      { name: 'IronShield', rating: 1100, wins: 55, losses: 30, rank: 5 },
    ];
  }

  // ========================================================================
  //  IModule
  // ========================================================================

  tick(_deltaSeconds: number): void {}

  onSave(): SaveData {
    const playersRecord: Record<string, PvpPlayerStats> = {};
    this.playersRecord.forEach((record, id) => { playersRecord[id] = { ...record }; });
    return {
      rating: this.rating,
      seasonHigh: this.seasonHigh,
      totalMatches: this.totalMatches,
      wins: this.wins,
      losses: this.losses,
      winStreak: this.winStreak,
      matchHistory: this.matchHistory,
      playersRecord,
    } as unknown as SaveData;
  }

  onLoad(data: SaveData): void {
    const save = data as unknown as PvpSaveData;
    this.rating = save.rating ?? BASE_RATING;
    this.seasonHigh = save.seasonHigh ?? BASE_RATING;
    this.totalMatches = save.totalMatches ?? 0;
    this.wins = save.wins ?? 0;
    this.losses = save.losses ?? 0;
    this.winStreak = save.winStreak ?? 0;
    this.matchHistory = save.matchHistory ?? [];
    this.playersRecord.clear();
    if (save.playersRecord) {
      for (const [id, record] of Object.entries(save.playersRecord)) {
        this.playersRecord.set(id, record);
      }
    }
  }

  reset(): void {
    this.rating = BASE_RATING;
    this.seasonHigh = BASE_RATING;
    this.totalMatches = 0;
    this.wins = 0;
    this.losses = 0;
    this.winStreak = 0;
    this.matchHistory = [];
    this.playersRecord.clear();
  }
}


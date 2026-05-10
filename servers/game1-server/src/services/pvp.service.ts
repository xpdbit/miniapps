import { PrismaClient, type Prisma } from '@prisma/client';
import { calculateElo, getRankFromRating } from '../lib/elo';
import { ValidationError } from '../utils/errors';

const prisma = new PrismaClient();

/**
 * 获取当前赛季号（YYYYMM 格式）
 */
export function getCurrentSeason(): number {
  const now = new Date();
  return now.getFullYear() * 100 + (now.getMonth() + 1);
}

export interface SubmitMatchParams {
  playerId: number;
  opponentId: number;
  result: 'victory' | 'defeat' | 'draw';
  battleLog?: Record<string, unknown>;
}

export interface SubmitMatchResult {
  match: {
    id: number;
    playerId: number;
    opponentId: number;
    result: string;
    ratingChange: number;
    playerRating: number;
    opponentRating: number;
    season: number;
    createdAt: Date;
  };
  ratingChange: number;
  newRating: number;
  opponentRatingChange: number;
  opponentNewRating: number;
}

/**
 * 提交对战结果，计算 ELO 并更新排行榜
 */
export async function submitMatchResult(params: SubmitMatchParams): Promise<SubmitMatchResult> {
  const { playerId, opponentId, result, battleLog } = params;

  if (playerId === opponentId) {
    throw new ValidationError('不能与自己对战');
  }

  const season = getCurrentSeason();

  // 获取或创建双方排行榜记录
  const [playerRanking, opponentRanking] = await Promise.all([
    prisma.game1PvpRanking.upsert({
      where: { playerId },
      create: { playerId, rating: 1000, rank: 'Bronze', season, wins: 0, losses: 0 },
      update: {},
    }),
    prisma.game1PvpRanking.upsert({
      where: { playerId: opponentId },
      create: { playerId: opponentId, rating: 1000, rank: 'Bronze', season, wins: 0, losses: 0 },
      update: {},
    }),
  ]);

  // 计算 ELO
  const eloResult = calculateElo(playerRanking.rating, opponentRanking.rating, result);

  // 计算段位
  const playerRank = getRankFromRating(eloResult.playerNewRating);
  const opponentRank = getRankFromRating(eloResult.opponentNewRating);

  // 计算胜负场次增量（玩家视角 vs 对手视角）
  const playerWinsInc = result === 'victory' ? 1 : 0;
  const playerLossesInc = result === 'defeat' ? 1 : 0;
  const opponentWinsInc = result === 'defeat' ? 1 : 0;
  const opponentLossesInc = result === 'victory' ? 1 : 0;

  // 事务：创建对战记录 + 更新双方排行榜
  const [match] = await prisma.$transaction([
    prisma.game1PvpMatch.create({
      data: {
        playerId,
        opponentId,
        result,
        ratingChange: eloResult.playerChange,
        playerRating: eloResult.playerNewRating,
        opponentRating: eloResult.opponentNewRating,
        season,
        battleLog: (battleLog ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      select: {
        id: true,
        playerId: true,
        opponentId: true,
        result: true,
        ratingChange: true,
        playerRating: true,
        opponentRating: true,
        season: true,
        createdAt: true,
      },
    }),
    prisma.game1PvpRanking.update({
      where: { playerId },
      data: {
        rating: eloResult.playerNewRating,
        rank: playerRank,
        season,
        wins: { increment: playerWinsInc },
        losses: { increment: playerLossesInc },
      },
    }),
    prisma.game1PvpRanking.update({
      where: { playerId: opponentId },
      data: {
        rating: eloResult.opponentNewRating,
        rank: opponentRank,
        season,
        wins: { increment: opponentWinsInc },
        losses: { increment: opponentLossesInc },
      },
    }),
  ]);

  return {
    match,
    ratingChange: eloResult.playerChange,
    newRating: eloResult.playerNewRating,
    opponentRatingChange: eloResult.opponentChange,
    opponentNewRating: eloResult.opponentNewRating,
  };
}

export interface LeaderboardEntry {
  rank: number;
  playerId: number;
  nickname: string | null;
  avatarUrl: string | null;
  level: number;
  rating: number;
  tier: string;
  wins: number;
  losses: number;
}

export interface LeaderboardResult {
  items: LeaderboardEntry[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * 获取 PVP 排行榜（按评分降序）
 */
export async function getLeaderboard(limit = 50, offset = 0): Promise<LeaderboardResult> {
  const [rankings, total] = await Promise.all([
    prisma.game1PvpRanking.findMany({
      orderBy: { rating: 'desc' },
      take: limit,
      skip: offset,
      include: {
        player: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            level: true,
          },
        },
      },
    }),
    prisma.game1PvpRanking.count(),
  ]);

  return {
    items: rankings.map((entry, index) => ({
      rank: offset + index + 1,
      playerId: entry.playerId,
      nickname: entry.player.nickname,
      avatarUrl: entry.player.avatarUrl,
      level: entry.player.level,
      rating: entry.rating,
      tier: entry.rank,
      wins: entry.wins,
      losses: entry.losses,
    })),
    total,
    limit,
    offset,
  };
}

export interface PlayerRankResult {
  rank: number;
  playerId: number;
  nickname: string | null;
  avatarUrl: string | null;
  level: number;
  rating: number;
  tier: string;
  wins: number;
  losses: number;
}

/**
 * 获取单个玩家排行信息
 */
export async function getPlayerRank(playerId: number): Promise<PlayerRankResult | null> {
  const ranking = await prisma.game1PvpRanking.findUnique({
    where: { playerId },
    include: {
      player: {
        select: {
          nickname: true,
          avatarUrl: true,
          level: true,
        },
      },
    },
  });

  if (!ranking) return null;

  const position = await prisma.game1PvpRanking.count({
    where: { rating: { gt: ranking.rating } },
  });

  return {
    rank: position + 1,
    playerId: ranking.playerId,
    nickname: ranking.player.nickname,
    avatarUrl: ranking.player.avatarUrl,
    level: ranking.player.level,
    rating: ranking.rating,
    tier: ranking.rank,
    wins: ranking.wins,
    losses: ranking.losses,
  };
}

export interface MatchHistoryItem {
  id: number;
  opponent: {
    id: number;
    nickname: string | null;
    avatarUrl: string | null;
  };
  result: string;
  ratingChange: number;
  playerRating: number;
  season: number;
  createdAt: Date;
}

export interface MatchHistoryResult {
  items: MatchHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * 获取玩家的对战历史
 */
export async function getMatchHistory(
  playerId: number,
  limit = 20,
  offset = 0,
): Promise<MatchHistoryResult> {
  const [matches, total] = await Promise.all([
    prisma.game1PvpMatch.findMany({
      where: {
        OR: [{ playerId }, { opponentId: playerId }],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        player: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        opponent: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
    }),
    prisma.game1PvpMatch.count({
      where: {
        OR: [{ playerId }, { opponentId: playerId }],
      },
    }),
  ]);

  return {
    items: matches.map((match) => {
      const isPlayer = match.playerId === playerId;
      return {
        id: match.id,
        opponent: isPlayer
          ? match.opponent
          : match.player,
        result: isPlayer
          ? match.result
          : invertResult(match.result),
        ratingChange: isPlayer ? match.ratingChange : -match.ratingChange,
        playerRating: isPlayer ? match.playerRating : match.opponentRating,
        season: match.season,
        createdAt: match.createdAt,
      };
    }),
    total,
    limit,
    offset,
  };
}

/**
 * 反转对战结果（对手视角）
 */
function invertResult(result: string): string {
  switch (result) {
    case 'victory': return 'defeat';
    case 'defeat': return 'victory';
    default: return result;
  }
}

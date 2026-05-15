// ─── ELO 计算结果 ───
export interface EloResult {
  playerNewRating: number;
  opponentNewRating: number;
  playerChange: number;
  opponentChange: number;
}

const K_FACTOR = 32;

/**
 * 计算 ELO 评分变化
 * @param playerRating 玩家当前评分
 * @param opponentRating 对手当前评分
 * @param result 对战结果（玩家视角）
 */
export function calculateElo(
  playerRating: number,
  opponentRating: number,
  result: 'victory' | 'defeat' | 'draw',
): EloResult {
  // 期望得分
  const expectedPlayer = 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
  const expectedOpponent = 1 - expectedPlayer;

  // 实际得分
  let playerScore: number;
  let opponentScore: number;

  switch (result) {
    case 'victory':
      playerScore = 1.0;
      opponentScore = 0.0;
      break;
    case 'defeat':
      playerScore = 0.0;
      opponentScore = 1.0;
      break;
    case 'draw':
      playerScore = 0.5;
      opponentScore = 0.5;
      break;
  }

  const playerChange = Math.round(K_FACTOR * (playerScore - expectedPlayer));
  const opponentChange = Math.round(K_FACTOR * (opponentScore - expectedOpponent));

  return {
    playerNewRating: playerRating + playerChange,
    opponentNewRating: opponentRating + opponentChange,
    playerChange,
    opponentChange,
  };
}

/**
 * 根据评分获取段位名称
 */
export function getRankFromRating(rating: number): string {
  if (rating >= 2000) return 'Diamond';
  if (rating >= 1700) return 'Platinum';
  if (rating >= 1400) return 'Gold';
  if (rating >= 1100) return 'Silver';
  return 'Bronze';
}

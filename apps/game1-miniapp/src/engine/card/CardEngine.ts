/**
 * CardEngine — 卡牌收集与抽卡系统引擎
 *
 * 单例，实现 IModule 接口，管理卡牌收集、抽卡（含保底系统）、图鉴完成度。
 * 事件：'card:drawn' | 'card:collectionComplete'
 */

import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';

/* ==================== 枚举 ==================== */

export enum CardRarity {
  N = 'N',
  R = 'R',
  SR = 'SR',
  SSR = 'SSR',
  UR = 'UR',
  GR = 'GR',
}

/** 稀有度排序（用于比较） */
const RARITY_ORDER: Record<CardRarity, number> = {
  [CardRarity.N]: 0,
  [CardRarity.R]: 1,
  [CardRarity.SR]: 2,
  [CardRarity.SSR]: 3,
  [CardRarity.UR]: 4,
  [CardRarity.GR]: 5,
};

/** 稀有度掉落权重（百分比） */
const RARITY_WEIGHTS: Record<CardRarity, number> = {
  [CardRarity.N]: 50,
  [CardRarity.R]: 30,
  [CardRarity.SR]: 13,
  [CardRarity.SSR]: 5,
  [CardRarity.UR]: 1.5,
  [CardRarity.GR]: 0.5,
};

/** 保底阈值 */
const PITY_LIMITS = {
  /** 每 10 抽保底 SR+ */
  SR: 10,
  /** 每 50 抽保底 SSR+ */
  SSR: 50,
  /** 每 300 抽保底 UR+ */
  UR: 300,
} as const;

/* ==================== 接口 ==================== */

/** 卡牌属性加成 */
export interface CardStatsBonus {
  attack: number;
  defense: number;
  hp: number;
  speed: number;
}

/** 卡牌定义 */
export interface Card {
  /** 唯一标识 */
  id: string;
  /** 卡牌名称 */
  name: string;
  /** 稀有度 */
  rarity: CardRarity;
  /** 说明文本（含世界观背景） */
  description: string;
  /** 基础属性加成 */
  baseStatsBonus: CardStatsBonus;
  /** 卡面 CSS 类名 */
  cardArt: string;
}

/** 抽卡结果事件数据 */
export interface CardDrawnEvent {
  cards: Card[];
  isNew: boolean[];
}

/** 图鉴完成事件数据 */
export interface CollectionCompleteEvent {
  completionPercentage: number;
}

/** 卡牌引擎存档格式 */
export interface CardEngineSaveData extends SaveData {
  ownedCardIds: string[];
  drawnCounts: Record<string, number>;
  totalPulls: number;
  pullsSinceSR: number;
  pullsSinceSSR: number;
  pullsSinceUR: number;
}

/* ==================== 24 张预定义卡牌 ==================== */

const CARD_DEFINITIONS: Card[] = [
  // ---- N ----
  {
    id: 'goblin',
    name: '哥布林',
    rarity: CardRarity.N,
    description: '洞穴中常见的小型魔物，虽然弱小但数量众多。',
    baseStatsBonus: { attack: 2, defense: 0, hp: 0, speed: 0 },
    cardArt: 'card-goblin',
  },
  {
    id: 'slime',
    name: '史莱姆',
    rarity: CardRarity.N,
    description: '果冻状的柔软生物，冒险者们的最初对手。',
    baseStatsBonus: { attack: 0, defense: 1, hp: 5, speed: 0 },
    cardArt: 'card-slime',
  },
  {
    id: 'skeleton_bat',
    name: '骸骨蝙蝠',
    rarity: CardRarity.N,
    description: '栖息在遗迹中的蝙蝠，翅膀上附有亡灵之力。',
    baseStatsBonus: { attack: 0, defense: 0, hp: 0, speed: 2 },
    cardArt: 'card-skeleton-bat',
  },
  {
    id: 'rat_king',
    name: '鼠王',
    rarity: CardRarity.N,
    description: '下水道中的鼠群领袖，比普通老鼠略大一圈。',
    baseStatsBonus: { attack: 1, defense: 0, hp: 3, speed: 0 },
    cardArt: 'card-rat-king',
  },
  // ---- R ----
  {
    id: 'orc_warrior',
    name: '兽人战士',
    rarity: CardRarity.R,
    description: '来自北方的绿皮战士，以力量和勇猛闻名。',
    baseStatsBonus: { attack: 5, defense: 2, hp: 0, speed: 0 },
    cardArt: 'card-orc-warrior',
  },
  {
    id: 'forest_wolf',
    name: '森林狼',
    rarity: CardRarity.R,
    description: '暗影森林中的狼群首领，行动迅捷如风。',
    baseStatsBonus: { attack: 2, defense: 0, hp: 0, speed: 4 },
    cardArt: 'card-forest-wolf',
  },
  {
    id: 'swamp_ghost',
    name: '沼泽幽魂',
    rarity: CardRarity.R,
    description: '徘徊在迷雾沼泽中的亡灵，散发冰冷气息。',
    baseStatsBonus: { attack: 0, defense: 0, hp: 15, speed: 0 },
    cardArt: 'card-swamp-ghost',
  },
  {
    id: 'cave_spider',
    name: '洞穴蜘蛛',
    rarity: CardRarity.R,
    description: '盘踞在矿洞深处的巨型蜘蛛，织网捕猎。',
    baseStatsBonus: { attack: 1, defense: 4, hp: 0, speed: 1 },
    cardArt: 'card-cave-spider',
  },
  // ---- SR ----
  {
    id: 'shadow_knight',
    name: '暗影骑士',
    rarity: CardRarity.SR,
    description: '被诅咒的骑士，在黑暗中守护着古老的秘密。',
    baseStatsBonus: { attack: 10, defense: 5, hp: 0, speed: 0 },
    cardArt: 'card-shadow-knight',
  },
  {
    id: 'storm_mage',
    name: '风暴法师',
    rarity: CardRarity.SR,
    description: '掌控雷电之力的魔法师，举手投足间风起云涌。',
    baseStatsBonus: { attack: 12, defense: 0, hp: 0, speed: 2 },
    cardArt: 'card-storm-mage',
  },
  {
    id: 'blade_assassin',
    name: '利刃刺客',
    rarity: CardRarity.SR,
    description: '来无影去无踪的暗杀者，刀刃上从不留情。',
    baseStatsBonus: { attack: 6, defense: 0, hp: 0, speed: 8 },
    cardArt: 'card-blade-assassin',
  },
  {
    id: 'light_paladin',
    name: '光明圣骑',
    rarity: CardRarity.SR,
    description: '圣光笼罩的守护者，以坚定的信仰抵御邪恶。',
    baseStatsBonus: { attack: 0, defense: 8, hp: 30, speed: 0 },
    cardArt: 'card-light-paladin',
  },
  // ---- SSR ----
  {
    id: 'flame_dragon',
    name: '烈焰巨龙',
    rarity: CardRarity.SSR,
    description: '火山深处苏醒的古龙，吐息可融化钢铁。',
    baseStatsBonus: { attack: 20, defense: 10, hp: 50, speed: 0 },
    cardArt: 'card-flame-dragon',
  },
  {
    id: 'frost_phoenix',
    name: '冰霜凤凰',
    rarity: CardRarity.SSR,
    description: '极寒之巅的不死鸟，每一次重生都更加寒冷。',
    baseStatsBonus: { attack: 0, defense: 6, hp: 80, speed: 6 },
    cardArt: 'card-frost-phoenix',
  },
  {
    id: 'thunder_griffin',
    name: '雷霆狮鹫',
    rarity: CardRarity.SSR,
    description: '翱翔于雷云之上的圣兽，双翼拍打间电闪雷鸣。',
    baseStatsBonus: { attack: 12, defense: 0, hp: 0, speed: 15 },
    cardArt: 'card-thunder-griffin',
  },
  {
    id: 'abyss_hydra',
    name: '深渊九头蛇',
    rarity: CardRarity.SSR,
    description: '深海中多头蛇怪，每个头颅都拥有独立的意志。',
    baseStatsBonus: { attack: 15, defense: 15, hp: 40, speed: 0 },
    cardArt: 'card-abyss-hydra',
  },
  // ---- UR ----
  {
    id: 'archangel',
    name: '大天使',
    rarity: CardRarity.UR,
    description: '神之使者，六翼展开时圣光普照大地。',
    baseStatsBonus: { attack: 30, defense: 20, hp: 100, speed: 0 },
    cardArt: 'card-archangel',
  },
  {
    id: 'nether_demon',
    name: '地狱恶魔',
    rarity: CardRarity.UR,
    description: '来自深渊的恶魔领主，以毁灭为乐。',
    baseStatsBonus: { attack: 40, defense: 0, hp: 0, speed: 10 },
    cardArt: 'card-nether-demon',
  },
  {
    id: 'titan_guardian',
    name: '泰坦守护者',
    rarity: CardRarity.UR,
    description: '远古时代的巨人后裔，坚不可摧的移动堡垒。',
    baseStatsBonus: { attack: 0, defense: 30, hp: 150, speed: 0 },
    cardArt: 'card-titan-guardian',
  },
  {
    id: 'leviathan_lord',
    name: '利维坦领主',
    rarity: CardRarity.UR,
    description: '海洋的霸主，其身躯足以掀起滔天巨浪。',
    baseStatsBonus: { attack: 25, defense: 25, hp: 80, speed: 5 },
    cardArt: 'card-leviathan-lord',
  },
  // ---- GR ----
  {
    id: 'creator_god',
    name: '创世神',
    rarity: CardRarity.GR,
    description: '传说中创造世界的神明，其力量超越一切。',
    baseStatsBonus: { attack: 50, defense: 30, hp: 200, speed: 10 },
    cardArt: 'card-creator-god',
  },
  {
    id: 'world_destroyer',
    name: '灭世者',
    rarity: CardRarity.GR,
    description: '来自虚空的存在，其存在即是对世界的威胁。',
    baseStatsBonus: { attack: 80, defense: 0, hp: 0, speed: 5 },
    cardArt: 'card-world-destroyer',
  },
  {
    id: 'void_walker',
    name: '虚空行者',
    rarity: CardRarity.GR,
    description: '穿梭于次元之间的神秘生灵，没有人见过它的真面目。',
    baseStatsBonus: { attack: 0, defense: 20, hp: 300, speed: 0 },
    cardArt: 'card-void-walker',
  },
  {
    id: 'cosmic_serpent',
    name: '宇宙巨蛇',
    rarity: CardRarity.GR,
    description: '盘绕在世界树根部的时空之蛇，见证了一切的开端与终结。',
    baseStatsBonus: { attack: 40, defense: 40, hp: 150, speed: 8 },
    cardArt: 'card-cosmic-serpent',
  },
];

/* ==================== CardEngine ==================== */

export class CardEngine implements IModule {
  readonly moduleId = 'card';

  private static _instance: CardEngine;
  static get instance(): CardEngine {
    if (!CardEngine._instance) {
      CardEngine._instance = new CardEngine();
    }
    return CardEngine._instance;
  }

  /** 已拥有的卡牌 <id, Card> */
  readonly collection: Map<string, Card> = new Map();

  /** 各卡牌被抽中的次数 <id, count> */
  readonly drawnCounts: Map<string, number> = new Map();

  /** 总抽卡次数 */
  totalPulls = 0;

  /** 自上次 SR+ 以来的抽数 */
  private pullsSinceSR = 0;

  /** 自上次 SSR+ 以来的抽数 */
  private pullsSinceSSR = 0;

  /** 自上次 UR+ 以来的抽数 */
  private pullsSinceUR = 0;

  private constructor() {
    // 无需初始化
  }

  /* ==================== 卡牌定义查询 ==================== */

  /** 获取所有卡牌定义 */
  getAllCardDefinitions(): Card[] {
    return CARD_DEFINITIONS;
  }

  /** 按稀有度获取所有卡牌定义 */
  getCardsByRarity(rarity: CardRarity): Card[] {
    return CARD_DEFINITIONS.filter((c) => c.rarity === rarity);
  }

  /** 按 ID 获取卡牌定义 */
  getCardDefinition(id: string): Card | undefined {
    return CARD_DEFINITIONS.find((c) => c.id === id);
  }

  /* ==================== 抽卡系统 ==================== */

  /**
   * 执行抽卡
   * @param count 抽数（1 或 10）
   * @returns 抽到的卡牌列表
   */
  gachaPull(count: 1 | 10): Card[] {
    const drawnCards: Card[] = [];
    const isNewFlags: boolean[] = [];

    for (let i = 0; i < count; i++) {
      const card = this.singlePull();
      drawnCards.push(card);

      // 更新抽卡统计
      this.totalPulls++;
      const prevCount = this.drawnCounts.get(card.id) ?? 0;
      this.drawnCounts.set(card.id, prevCount + 1);

      // 如果是新卡，加入收藏
      const isNew = !this.collection.has(card.id);
      isNewFlags.push(isNew);
      if (isNew) {
        this.collection.set(card.id, card);

        // 检查图鉴是否完成
        if (this.getCompletionPercentage() >= 100) {
          globalEventBus.emit('card:collectionComplete', {
            completionPercentage: 100,
          } as CollectionCompleteEvent);
        }
      }

      // 更新保底计数器
      this.updatePityCounters(card.rarity);
    }

    globalEventBus.emit('card:drawn', { cards: drawnCards, isNew: isNewFlags } as CardDrawnEvent);
    return drawnCards;
  }

  /** 单次抽卡核心逻辑 */
  private singlePull(): Card {
    const rarity = this.determineRarity();
    const cardsOfRarity = this.getCardsByRarity(rarity);
    // 随机选一张该稀有度的卡牌
    const index = Math.floor(Math.random() * cardsOfRarity.length);
    return cardsOfRarity[index]!;
  }

  /** 确定本次抽卡的稀有度（含保底逻辑） */
  private determineRarity(): CardRarity {
    // 检查三级保底
    if (this.pullsSinceUR >= PITY_LIMITS.UR) {
      return this.weightedRarityPick([CardRarity.UR, CardRarity.GR]);
    }
    if (this.pullsSinceSSR >= PITY_LIMITS.SSR) {
      return this.weightedRarityPick([CardRarity.SSR, CardRarity.UR, CardRarity.GR]);
    }
    if (this.pullsSinceSR >= PITY_LIMITS.SR) {
      return this.weightedRarityPick([CardRarity.SR, CardRarity.SSR, CardRarity.UR, CardRarity.GR]);
    }
    // 正常概率
    return this.weightedRarityPick([CardRarity.N, CardRarity.R, CardRarity.SR, CardRarity.SSR, CardRarity.UR, CardRarity.GR]);
  }

  /** 从指定的稀有度列表中按原权重随机选取 */
  private weightedRarityPick(rarities: CardRarity[]): CardRarity {
    const totalWeight = rarities.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0);
    let roll = Math.random() * totalWeight;

    for (const rarity of rarities) {
      roll -= RARITY_WEIGHTS[rarity];
      if (roll <= 0) return rarity;
    }

    // 兜底返回最后一个
    return rarities[rarities.length - 1]!;
  }

  /** 根据抽到的稀有度更新保底计数器 */
  private updatePityCounters(drawnRarity: CardRarity): void {
    const order = RARITY_ORDER[drawnRarity];

    this.pullsSinceSR++;
    this.pullsSinceSSR++;
    this.pullsSinceUR++;

    // SR+：SR 及以上重置 SR 保底
    if (order >= RARITY_ORDER[CardRarity.SR]) {
      this.pullsSinceSR = 0;
    }
    // SSR+：SSR 及以上重置 SSR 保底
    if (order >= RARITY_ORDER[CardRarity.SSR]) {
      this.pullsSinceSSR = 0;
    }
    // UR+：UR 及以上重置 UR 保底
    if (order >= RARITY_ORDER[CardRarity.UR]) {
      this.pullsSinceUR = 0;
    }
  }

  /* ==================== 图鉴查询 ==================== */

  /** 获取已拥有的卡牌列表 */
  getCollection(): Card[] {
    return Array.from(this.collection.values());
  }

  /** 获取指定 ID 的已拥有卡牌 */
  getCard(id: string): Card | undefined {
    return this.collection.get(id);
  }

  /** 图鉴收集数量 */
  getCollectionCount(): number {
    return this.collection.size;
  }

  /** 图鉴总数量 */
  getTotalCardCount(): number {
    return CARD_DEFINITIONS.length;
  }

  /** 获取指定稀有度的已收集数量 */
  getRarityCollectionCount(rarity: CardRarity): number {
    let count = 0;
    for (const card of this.collection.values()) {
      if (card.rarity === rarity) count++;
    }
    return count;
  }

  /** 指定稀有度的卡牌总数 */
  getRarityTotalCount(rarity: CardRarity): number {
    return CARD_DEFINITIONS.filter((c) => c.rarity === rarity).length;
  }

  /** 图鉴完成度（百分比，0-100） */
  getCompletionPercentage(): number {
    if (CARD_DEFINITIONS.length === 0) return 0;
    return Math.round((this.collection.size / CARD_DEFINITIONS.length) * 100);
  }

  /** 获取卡牌的抽取次数 */
  getDrawnCount(cardId: string): number {
    return this.drawnCounts.get(cardId) ?? 0;
  }

  /** 获取保底状态 */
  getPityStatus(): { pullsSinceSR: number; pullsSinceSSR: number; pullsSinceUR: number } {
    return {
      pullsSinceSR: this.pullsSinceSR,
      pullsSinceSSR: this.pullsSinceSSR,
      pullsSinceUR: this.pullsSinceUR,
    };
  }

  /** 计算已拥有卡牌的总属性加成 */
  getTotalStatsBonus(): CardStatsBonus {
    const total: CardStatsBonus = { attack: 0, defense: 0, hp: 0, speed: 0 };
    for (const card of this.collection.values()) {
      total.attack += card.baseStatsBonus.attack;
      total.defense += card.baseStatsBonus.defense;
      total.hp += card.baseStatsBonus.hp;
      total.speed += card.baseStatsBonus.speed;
    }
    return total;
  }

  /* ==================== IModule 接口 ==================== */

  tick(_deltaSeconds: number): void {
    // 卡牌引擎不需要 tick 逻辑
  }

  onSave(): CardEngineSaveData {
    const drawnCounts: Record<string, number> = {};
    this.drawnCounts.forEach((count, id) => {
      drawnCounts[id] = count;
    });

    return {
      ownedCardIds: Array.from(this.collection.keys()),
      drawnCounts,
      totalPulls: this.totalPulls,
      pullsSinceSR: this.pullsSinceSR,
      pullsSinceSSR: this.pullsSinceSSR,
      pullsSinceUR: this.pullsSinceUR,
    };
  }

  onLoad(data: CardEngineSaveData): void {
    this.reset();

    this.totalPulls = data.totalPulls;
    this.pullsSinceSR = data.pullsSinceSR;
    this.pullsSinceSSR = data.pullsSinceSSR;
    this.pullsSinceUR = data.pullsSinceUR;

    // 恢复抽卡次数
    for (const [id, count] of Object.entries(data.drawnCounts)) {
      const numCount = typeof count === 'number' ? count : 0;
      this.drawnCounts.set(id, numCount);
    }

    // 恢复已拥有卡牌
    for (const cardId of data.ownedCardIds) {
      const card = this.getCardDefinition(cardId);
      if (card) {
        this.collection.set(cardId, card);
      }
    }
  }

  reset(): void {
    this.collection.clear();
    this.drawnCounts.clear();
    this.totalPulls = 0;
    this.pullsSinceSR = 0;
    this.pullsSinceSSR = 0;
    this.pullsSinceUR = 0;
  }
}

/** 全局单例 */
export const cardEngine = CardEngine.instance;

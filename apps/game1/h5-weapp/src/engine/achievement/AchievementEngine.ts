/**
 * AchievementEngine — 成就系统核心引擎
 *
 * 单例，实现 IModule 接口，管理成就解锁/进度追踪/存档。
 * 监听游戏事件自动检查成就进度：
 *   'combat:end' | 'mileage:updated' | 'mileage:chest' | 'skill:learned' |
 *   'skill:used' | 'team:memberJoined' | 'equipment:changed' | 'card:drawn' |
 *   'travel:choiceResolved' | 'prestige:activated'
 * 发出事件：'achievement:unlocked'
 */

import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';

// ---------------------------------------------------------------------------
// 事件载荷类型
// ---------------------------------------------------------------------------

export interface AchievementUnlockedEvent {
  achievementId: string;
  achievement: Achievement;
}

// ---------------------------------------------------------------------------
// 核心类型
// ---------------------------------------------------------------------------

export interface AchievementCondition {
  /** 监听的事件名 */
  type: string;
  /** 达成目标值 */
  target: number;
  /** 当前进度值 */
  current: number;
}

export interface AchievementReward {
  gold?: number;
  exp?: number;
  gems?: number;
  card?: string;
}

export type AchievementCategory = 'travel' | 'combat' | 'collection' | 'prestige' | 'misc';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  condition: AchievementCondition;
  reward: AchievementReward;
  isUnlocked: boolean;
  unlockedAt: number;
}

// ---------------------------------------------------------------------------
// 存档接口
// ---------------------------------------------------------------------------

interface AchievementSaveEntry {
  id: string;
  condition: { current: number };
  isUnlocked: boolean;
  unlockedAt: number;
}

interface AchievementSaveData {
  entries: AchievementSaveEntry[];
}

// ---------------------------------------------------------------------------
// 成就定义
// ---------------------------------------------------------------------------

interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  conditionType: string;
  conditionTarget: number;
  reward: AchievementReward;
}

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // ========== 旅行 ==========
  {
    id: 'world_traveler',
    name: '世界旅行者',
    description: '旅行累计 100 km',
    icon: '🌍',
    category: 'travel',
    conditionType: 'mileage:updated',
    conditionTarget: 100,
    reward: { gold: 100 },
  },
  {
    id: 'explorer',
    name: '探险家',
    description: '旅行累计 500 km',
    icon: '🧭',
    category: 'travel',
    conditionType: 'mileage:updated',
    conditionTarget: 500,
    reward: { gold: 300, exp: 200 },
  },
  {
    id: 'globetrotter',
    name: '环球旅行者',
    description: '旅行累计 2000 km',
    icon: '🌏',
    category: 'travel',
    conditionType: 'mileage:updated',
    conditionTarget: 2000,
    reward: { gold: 1000, gems: 50 },
  },
  {
    id: 'chest_hunter',
    name: '宝箱猎人',
    description: '开启 30 个宝箱',
    icon: '📦',
    category: 'travel',
    conditionType: 'mileage:chest',
    conditionTarget: 30,
    reward: { gems: 30 },
  },
  {
    id: 'eventful_journey',
    name: '奇遇连连',
    description: '触发 20 次路线事件',
    icon: '🎲',
    category: 'travel',
    conditionType: 'travel:choiceResolved',
    conditionTarget: 20,
    reward: { gold: 500, exp: 300 },
  },

  // ========== 战斗 ==========
  {
    id: 'first_blood',
    name: '初露锋芒',
    description: '赢得 1 场战斗胜利',
    icon: '⚔️',
    category: 'combat',
    conditionType: 'combat:end',
    conditionTarget: 1,
    reward: { gold: 50 },
  },
  {
    id: 'warrior',
    name: '战士',
    description: '赢得 10 场战斗胜利',
    icon: '🛡️',
    category: 'combat',
    conditionType: 'combat:end',
    conditionTarget: 10,
    reward: { gold: 200, exp: 150 },
  },
  {
    id: 'veteran',
    name: '老兵',
    description: '赢得 50 场战斗胜利',
    icon: '🎖️',
    category: 'combat',
    conditionType: 'combat:end',
    conditionTarget: 50,
    reward: { gold: 800, gems: 30 },
  },
  {
    id: 'legend',
    name: '传奇',
    description: '赢得 200 场战斗胜利',
    icon: '🏆',
    category: 'combat',
    conditionType: 'combat:end',
    conditionTarget: 200,
    reward: { gold: 3000, gems: 100 },
  },

  // ========== 收集 ==========
  {
    id: 'skill_learner',
    name: '学徒',
    description: '学会 5 个技能',
    icon: '📖',
    category: 'collection',
    conditionType: 'skill:learned',
    conditionTarget: 5,
    reward: { gold: 100, exp: 100 },
  },
  {
    id: 'skill_master',
    name: '技能大师',
    description: '学会 15 个技能',
    icon: '✨',
    category: 'collection',
    conditionType: 'skill:learned',
    conditionTarget: 15,
    reward: { gems: 50, exp: 500 },
  },
  {
    id: 'equipment_collector',
    name: '装备收集者',
    description: '装备 8 件装备',
    icon: '🎒',
    category: 'collection',
    conditionType: 'equipment:changed',
    conditionTarget: 8,
    reward: { gold: 300 },
  },
  {
    id: 'team_builder',
    name: '组建队伍',
    description: '招募 4 名队友',
    icon: '👥',
    category: 'collection',
    conditionType: 'team:memberJoined',
    conditionTarget: 4,
    reward: { gold: 200, exp: 200 },
  },
  {
    id: 'card_collector',
    name: '卡牌收集者',
    description: '抽取 10 张卡牌',
    icon: '🃏',
    category: 'collection',
    conditionType: 'card:drawn',
    conditionTarget: 10,
    reward: { gems: 30 },
  },

  // ========== 轮回 ==========
  {
    id: 'first_prestige',
    name: '初次轮回',
    description: '完成首次轮回',
    icon: '🔄',
    category: 'prestige',
    conditionType: 'prestige:activated',
    conditionTarget: 1,
    reward: { gems: 100 },
  },
  {
    id: 'prestige_master',
    name: '轮回大师',
    description: '完成 5 次轮回',
    icon: '♾️',
    category: 'prestige',
    conditionType: 'prestige:activated',
    conditionTarget: 5,
    reward: { gems: 500 },
  },

  // ========== 杂项 ==========
  {
    id: 'skill_user',
    name: '技能熟手',
    description: '累计使用 100 次技能',
    icon: '🔮',
    category: 'misc',
    conditionType: 'skill:used',
    conditionTarget: 100,
    reward: { gold: 500, exp: 300 },
  },
  {
    id: 'dedicated',
    name: '持之以恒',
    description: '累计在线 24 小时',
    icon: '⏰',
    category: 'misc',
    conditionType: 'game:tick',
    conditionTarget: 86400, // 24h = 86400 ticks of 1s
    reward: { gems: 80 },
  },
  {
    id: 'lucky',
    name: '幸运星',
    description: '开启 100 个宝箱',
    icon: '🍀',
    category: 'misc',
    conditionType: 'mileage:chest',
    conditionTarget: 100,
    reward: { gems: 150 },
  },
  {
    id: 'route_explorer',
    name: '路线探索者',
    description: '触发 50 次路线事件',
    icon: '🗺️',
    category: 'misc',
    conditionType: 'travel:choiceResolved',
    conditionTarget: 50,
    reward: { gold: 1000, exp: 500 },
  },
];

// ---------------------------------------------------------------------------
// AchievementEngine
// ---------------------------------------------------------------------------

export class AchievementEngine implements IModule {
  readonly moduleId = 'achievement';

  // ---- 单例 ----
  private static _instance: AchievementEngine;
  static get instance(): AchievementEngine {
    if (!AchievementEngine._instance) {
      AchievementEngine._instance = new AchievementEngine();
    }
    return AchievementEngine._instance;
  }

  // ---- 状态 ----
  private achievements: Map<string, Achievement> = new Map();
  private initialized = false;

  // ---- 已注册的事件绑定（用于清理） ----
  private boundHandlers: Array<{ event: string; handler: (data: unknown) => void }> = [];

  // ---- 累积在线秒数（dedicated 成就用） ----
  private onlineSeconds = 0;

  // ---- 私有构造 ----
  private constructor() {}

  // ========================================================================
  //  初始化
  // ========================================================================

  /** 初始化成就列表并注册事件监听 */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // 从定义创建成就实例
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      if (!this.achievements.has(def.id)) {
        this.achievements.set(def.id, {
          id: def.id,
          name: def.name,
          description: def.description,
          icon: def.icon,
          category: def.category,
          condition: { type: def.conditionType, target: def.conditionTarget, current: 0 },
          reward: def.reward,
          isUnlocked: false,
          unlockedAt: 0,
        });
      }
    }

    this.registerEventListeners();
  }

  /** 注册 EventBus 监听 */
  private registerEventListeners(): void {
    const events = [
      'combat:end',
      'mileage:updated',
      'mileage:chest',
      'skill:learned',
      'skill:used',
      'team:memberJoined',
      'equipment:changed',
      'card:drawn',
      'travel:choiceResolved',
      'prestige:activated',
    ] as const;

    for (const event of events) {
      const handler = (data: unknown): void => {
        this.checkProgress(event, data);
      };
      globalEventBus.on(event, handler);
      this.boundHandlers.push({ event, handler });
    }
  }

  // ========================================================================
  //  进度检查
  // ========================================================================

  /**
   * 检查所有匹配事件的未解锁成就的进度
   * @param event 事件名
   * @param data 事件载荷
   */
  checkProgress(event: string, data: unknown): void {
    const matching = this.getLockedAchievements().filter(
      (a) => a.condition.type === event,
    );
    if (matching.length === 0) return;

    switch (event) {
      case 'combat:end': {
        const payload = data as { status: string };
        if (payload.status !== 'Victory') return;
        for (const achievement of matching) {
          achievement.condition.current += 1;
          this.tryUnlock(achievement);
        }
        break;
      }

      case 'mileage:updated': {
        const payload = data as { totalMileage: number };
        for (const achievement of matching) {
          achievement.condition.current = Math.floor(payload.totalMileage);
          this.tryUnlock(achievement);
        }
        break;
      }

      case 'mileage:chest': {
        for (const achievement of matching) {
          achievement.condition.current += 1;
          this.tryUnlock(achievement);
        }
        break;
      }

      case 'skill:learned':
      case 'team:memberJoined':
      case 'card:drawn':
      case 'travel:choiceResolved':
      case 'prestige:activated': {
        for (const achievement of matching) {
          achievement.condition.current += 1;
          this.tryUnlock(achievement);
        }
        break;
      }

      case 'equipment:changed': {
        // 每次装备变更都计数（可能多次装备/卸下）
        // 实际装备件数由外部逻辑保证，这里简单计数
        for (const achievement of matching) {
          achievement.condition.current += 1;
          this.tryUnlock(achievement);
        }
        break;
      }

      case 'skill:used': {
        const payload = data as { success: boolean };
        if (payload.success === false) return;
        for (const achievement of matching) {
          achievement.condition.current += 1;
          this.tryUnlock(achievement);
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * 尝试解锁成就
   * @param achievement 要检查的成就实例
   */
  private tryUnlock(achievement: Achievement): void {
    if (achievement.isUnlocked) return;
    if (achievement.condition.current < achievement.condition.target) return;

    achievement.isUnlocked = true;
    achievement.unlockedAt = Date.now();

    globalEventBus.emit<AchievementUnlockedEvent>('achievement:unlocked', {
      achievementId: achievement.id,
      achievement: { ...achievement },
    });

    console.log(`[AchievementEngine] 成就解锁: ${achievement.name}`);
  }

  // ========================================================================
  //  公开查询
  // ========================================================================

  /** 手动解锁指定成就（供外部调用，如调试或特殊奖励） */
  unlockAchievement(id: string): boolean {
    const achievement = this.achievements.get(id);
    if (!achievement || achievement.isUnlocked) return false;
    achievement.isUnlocked = true;
    achievement.unlockedAt = Date.now();

    globalEventBus.emit<AchievementUnlockedEvent>('achievement:unlocked', {
      achievementId: achievement.id,
      achievement: { ...achievement },
    });
    return true;
  }

  /** 获取所有成就 */
  getAllAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  /** 获取指定成就 */
  getAchievement(id: string): Achievement | undefined {
    return this.achievements.get(id);
  }

  /** 获取已解锁成就 */
  getUnlockedAchievements(): Achievement[] {
    return this.getAllAchievements().filter((a) => a.isUnlocked);
  }

  /** 获取未解锁成就 */
  getLockedAchievements(): Achievement[] {
    return this.getAllAchievements().filter((a) => !a.isUnlocked);
  }

  /** 获取指定成就的完成百分比 0-100 */
  getProgress(id: string): number {
    const achievement = this.achievements.get(id);
    if (!achievement) return 0;
    if (achievement.condition.target === 0) return 100;
    return Math.min(100, Math.floor(
      (achievement.condition.current / achievement.condition.target) * 100,
    ));
  }

  /** 获取总体进度 */
  getTotalProgress(): { unlocked: number; total: number; percent: number } {
    const all = this.getAllAchievements();
    const unlocked = this.getUnlockedAchievements().length;
    const total = all.length;
    return {
      unlocked,
      total,
      percent: total > 0 ? Math.floor((unlocked / total) * 100) : 0,
    };
  }

  /** 获取指定分类的进度 */
  getCategoryProgress(category: AchievementCategory): {
    unlocked: number;
    total: number;
    percent: number;
  } {
    const all = this.getAllAchievements().filter((a) => a.category === category);
    const unlocked = all.filter((a) => a.isUnlocked).length;
    const total = all.length;
    return {
      unlocked,
      total,
      percent: total > 0 ? Math.floor((unlocked / total) * 100) : 0,
    };
  }

  /** 获取指定分类的所有成就 */
  getAchievementsByCategory(category: AchievementCategory): Achievement[] {
    return this.getAllAchievements().filter((a) => a.category === category);
  }

  // ========================================================================
  //  成就奖励领取
  // ========================================================================

  /** 获取成就的奖励配置（供外部 UI 展示或领取用） */
  getReward(id: string): AchievementReward | undefined {
    const achievement = this.achievements.get(id);
    if (!achievement || !achievement.isUnlocked) return undefined;
    return { ...achievement.reward };
  }

  // ========================================================================
  //  IModule
  // ========================================================================

  tick(deltaSeconds: number): void {
    if (!this.initialized) return;

    // 累积在线时间（用于 dedicated 成就）
    this.onlineSeconds += deltaSeconds;

    // 检查 dedicated 成就进度
    const dedicated = this.achievements.get('dedicated');
    if (dedicated && !dedicated.isUnlocked) {
      dedicated.condition.current = Math.floor(this.onlineSeconds);
      this.tryUnlock(dedicated);
    }
  }

  onSave(): SaveData {
    const entries: AchievementSaveEntry[] = [];
    this.achievements.forEach((achievement) => {
      entries.push({
        id: achievement.id,
        condition: { current: achievement.condition.current },
        isUnlocked: achievement.isUnlocked,
        unlockedAt: achievement.unlockedAt,
      });
    });

    const data: AchievementSaveData = {
      entries,
    };
    return data as unknown as SaveData;
  }

  onLoad(data: SaveData): void {
    const save = data as unknown as AchievementSaveData;
    if (!save.entries) return;

    // 重建 achievements 映射
    this.achievements.clear();

    for (const entry of save.entries) {
      const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === entry.id);
      if (!def) continue;

      this.achievements.set(entry.id, {
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        category: def.category,
        condition: {
          type: def.conditionType,
          target: def.conditionTarget,
          current: entry.condition.current,
        },
        reward: def.reward,
        isUnlocked: entry.isUnlocked,
        unlockedAt: entry.unlockedAt,
      });
    }

    // 确保所有定义都存在（新增的成就默认未解锁）
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      if (!this.achievements.has(def.id)) {
        this.achievements.set(def.id, {
          id: def.id,
          name: def.name,
          description: def.description,
          icon: def.icon,
          category: def.category,
          condition: { type: def.conditionType, target: def.conditionTarget, current: 0 },
          reward: def.reward,
          isUnlocked: false,
          unlockedAt: 0,
        });
      }
    }

    // 从在线时间恢复
    const dedicated = this.achievements.get('dedicated');
    if (dedicated) {
      this.onlineSeconds = dedicated.condition.current;
    }

    // 注册事件监听（如果尚未注册）
    if (!this.initialized) {
      this.initialized = true;
      this.registerEventListeners();
    }
  }

  reset(): void {
    this.achievements.clear();
    this.onlineSeconds = 0;
    this.initialized = false;

    // 移除事件监听
    for (const { event, handler } of this.boundHandlers) {
      globalEventBus.off(event, handler);
    }
    this.boundHandlers = [];
  }
}

/** 全局单例 */
export const achievementEngine = AchievementEngine.instance;

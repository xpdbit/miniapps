/**
 * CombatEngine — 战斗引擎（单例）
 *
 * 核心职责:
 *   - 管理战斗生命周期（开始 → 自动进行 → 结束）
 *   - 委托 CombatStateMachine 控制阶段流转
 *   - 通过 DamageCalculator 进行伤害计算
 *   - 通过 EventBus 发出战斗事件
 *   - 实现 IModule 接口以支持存档/读档/重置
 */

import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';
import { CombatStateMachine, CombatPhase, CombatCallbacks, CombatPhaseResult } from './CombatStateMachine';
import {
  calculateDamage,
  calculateCrit,
  calculateDodge,
  DamageResult,
} from './DamageCalculator';
import constants from '../../config/constants.json';
import { itemRegistry } from '../inventory/ItemRegistry';

// ─── 常量 ─────────────────────────────────────────────────

const { expRewardMultiplier, goldRewardMultiplier } = constants.combat;

/** 战斗日志最大条目数 */
const MAX_COMBAT_LOG = 200;

/** 基础攻击技能（每个战斗者默认可用） */
const BASIC_ATTACK_SKILL: ICombatSkill = {
  id: 'basic_attack',
  name: '普通攻击',
  damageMultiplier: 1.0,
  cooldown: 0,
  currentCooldown: 0,
};

// ─── 枚举 ─────────────────────────────────────────────────

/** 战斗状态 */
export enum CombatStatus {
  /** 无战斗 */
  None = 'None',
  /** 准备阶段 */
  Preparing = 'Preparing',
  /** 战斗中 */
  InProgress = 'InProgress',
  /** 胜利 */
  Victory = 'Victory',
  /** 失败 */
  Defeat = 'Defeat',
}

// ─── 接口 ─────────────────────────────────────────────────

/** 战斗技能 */
export interface ICombatSkill {
  /** 技能唯一标识 */
  id: string;
  /** 技能显示名称 */
  name: string;
  /** 伤害倍率（相对于基础攻击力） */
  damageMultiplier: number;
  /** 冷却回合数（0 表示无冷却） */
  cooldown: number;
  /** 当前剩余冷却回合数 */
  currentCooldown: number;
  /** 技能描述 */
  description?: string;
}

/** 战斗者（敌人或玩家队伍成员） */
export interface ICombatant {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 等级 */
  level: number;
  /** 当前生命值 */
  hp: number;
  /** 最大生命值 */
  maxHp: number;
  /** 攻击力 */
  attack: number;
  /** 防御力 */
  defense: number;
  /** 速度 */
  speed: number;
  /** 智慧/灵巧（影响暴击率） */
  wisdom: number;
  /** 技能列表 */
  skills: ICombatSkill[];
}

/** 战斗日志条目 */
export interface CombatLogEntry {
  /** 战斗内时间戳（秒） */
  timestamp: number;
  /** 日志消息文本 */
  message: string;
  /** 日志类型 */
  type: 'damage' | 'heal' | 'crit' | 'dodge' | 'skill' | 'system' | 'status' | 'reward';
}

/** 战斗奖励 */
export interface CombatReward {
  /** 金币奖励 */
  gold: number;
  /** 经验奖励 */
  exp: number;
  /** 掉落物品 ID 列表 */
  items: string[];
}

/** 战斗完整状态 */
export interface CombatState {
  /** 敌人列表 */
  enemies: ICombatant[];
  /** 玩家队伍成员 */
  partyMembers: ICombatant[];
  /** 战斗日志 */
  combatLog: CombatLogEntry[];
  /** 当前战斗状态 */
  status: CombatStatus;
  /** 战斗已耗时（秒） */
  elapsedTime: number;
  /** 战斗奖励 */
  reward: CombatReward;
}

/** combat:start 事件荷载 */
export interface CombatStartEvent {
  enemies: ICombatant[];
  partyMembers: ICombatant[];
}

/** combat:action 事件荷载 */
export interface CombatActionEvent {
  user: {
    id: string;
    name: string;
    team: 'party' | 'enemy';
  };
  target: {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
  };
  skill: {
    id: string;
    name: string;
  };
  result: DamageResult;
}

/** combat:end 事件荷载 */
export interface CombatEndEvent {
  status: CombatStatus;
  reward: CombatReward;
  elapsedTime: number;
}

/** combat:tick 事件荷载 */
export interface CombatTickEvent {
  phase: CombatPhase;
  elapsedTime: number;
}

/** 存档数据结构 */
export interface CombatEngineSaveData {
  status: CombatStatus;
  enemies: ICombatant[];
  partyMembers: ICombatant[];
  elapsedTime: number;
  combatLog: CombatLogEntry[];
}

// ─── 战斗引擎 ─────────────────────────────────────────────

export class CombatEngine implements IModule {
  /** 模块标识 */
  readonly moduleId: string = 'combat';

  // ─── 单例 ───────────────────────────────────────────────
  private static _instance: CombatEngine;

  static get instance(): CombatEngine {
    if (CombatEngine._instance === undefined) {
      CombatEngine._instance = new CombatEngine();
    }
    return CombatEngine._instance;
  }

  // ─── 状态 ───────────────────────────────────────────────
  private state: CombatState;
  private stateMachine: CombatStateMachine;

  private constructor() {
    this.state = this.createInitialState();
    this.stateMachine = new CombatStateMachine();
  }

  // ─── 公开方法 — 战斗控制 ──────────────────────────────

  /**
   * 开始战斗
   * @param enemies      敌方战斗者列表
   * @param partyMembers 玩家队伍（可选；默认使用已注册的队员）
   */
  startCombat(enemies: ICombatant[], partyMembers?: ICombatant[]): void {
    // 深拷贝敌人数据，防止外部篡改
    const clonedEnemies = this.deepCloneCombatants(enemies);
    const clonedParty = partyMembers !== undefined
      ? this.deepCloneCombatants(partyMembers)
      : this.deepCloneCombatants(this.state.partyMembers);

    this.state = {
      enemies: clonedEnemies,
      partyMembers: clonedParty,
      combatLog: [],
      status: CombatStatus.Preparing,
      elapsedTime: 0,
      reward: { gold: 0, exp: 0, items: [] },
    };

    this.stateMachine.initialize(clonedParty, clonedEnemies);

    globalEventBus.emit<CombatStartEvent>('combat:start', {
      enemies: clonedEnemies,
      partyMembers: clonedParty,
    });

    this.addSystemLog(`战斗开始！敌方 ${clonedEnemies.length} 人`);
  }

  /**
   * 每帧驱动战斗
   * @param deltaSeconds 帧间隔（秒）
   */
  processCombatTick(deltaSeconds: number): void {
    if (this.state.status !== CombatStatus.Preparing && this.state.status !== CombatStatus.InProgress) {
      return;
    }

    // 准备阶段结束后正式进入战斗
    if (this.state.status === CombatStatus.Preparing) {
      this.state.status = CombatStatus.InProgress;
    }

    const callbacks: CombatCallbacks = {
      onRoundStart: () => this.handleRoundStart(),
      onPlayerAction: (c) => this.handlePlayerAction(c),
      onEnemyAction: (c) => this.handleEnemyAction(c),
      onCheckEnd: () => this.handleCheckEnd(),
      onBattleEnd: () => this.handleBattleEndInternal(),
    };

    this.stateMachine.handleState(deltaSeconds, callbacks);

    this.state.elapsedTime += deltaSeconds;

    globalEventBus.emit<CombatTickEvent>('combat:tick', {
      phase: this.stateMachine.getPhase(),
      elapsedTime: this.state.elapsedTime,
    });
  }

  /**
   * 执行技能
   * @param user    施法者
   * @param target  目标
   * @param skillId 技能 ID
   */
  executeSkill(user: ICombatant, target: ICombatant, skillId: string): void {
    const skill = user.skills.find((s) => s.id === skillId) ?? BASIC_ATTACK_SKILL;

    // 闪避判定
    const isDodged = calculateDodge(target.speed);

    // 暴击判定
    const critResult = calculateCrit(user.wisdom);

    // 伤害计算
    const result = calculateDamage(
      user.attack,
      target.defense,
      skill.damageMultiplier,
      critResult.isCrit,
      critResult.critMultiplier,
      isDodged,
    );

    // 应用伤害
    target.hp = Math.max(0, target.hp - result.damage);

    // 设置技能冷却
    if (skill.cooldown > 0) {
      skill.currentCooldown = skill.cooldown;
    }

    // 记录日志
    this.addCombatLog(user, target, skill, result);

    // 发出行动事件
    const team = this.getTeam(user);
    globalEventBus.emit<CombatActionEvent>('combat:action', {
      user: { id: user.id, name: user.name, team },
      target: {
        id: target.id,
        name: target.name,
        hp: target.hp,
        maxHp: target.maxHp,
      },
      skill: { id: skill.id, name: skill.name },
      result,
    });
  }

  /**
   * 判定战斗是否结束
   * @returns Victory | Defeat | null（继续战斗）
   */
  checkBattleEnd(): CombatPhaseResult {
    const allEnemiesDead = this.state.enemies.every((e) => e.hp <= 0);
    if (allEnemiesDead) {
      return 'Victory';
    }

    const allPartyDead = this.state.partyMembers.every((m) => m.hp <= 0);
    if (allPartyDead) {
      return 'Defeat';
    }

    return null;
  }

  /**
   * 结束战斗
   * @param status 战斗结果
   */
  endCombat(status: CombatStatus): void {
    this.state.status = status;
    this.state.reward = this.calculateReward();

    this.stateMachine.reset();

    const statusText = status === CombatStatus.Victory ? '胜利' : '失败';
    this.addSystemLog(`战斗结束 — ${statusText}`);

    globalEventBus.emit<CombatEndEvent>('combat:end', {
      status,
      reward: this.state.reward,
      elapsedTime: this.state.elapsedTime,
    });
  }

  // ─── 公开方法 — 查询 ──────────────────────────────────

  /** 获取当前战斗状态 */
  getState(): Readonly<CombatState> {
    return this.state;
  }

  /** 获取当前战斗阶段 */
  getPhase(): CombatPhase {
    return this.stateMachine.getPhase();
  }

  /** 获取战斗日志 */
  getCombatLog(): ReadonlyArray<CombatLogEntry> {
    return this.state.combatLog;
  }

  /** 获取未读的最近日志（自上次调用后新增） */
  getRecentLogs(): CombatLogEntry[] {
    // 留空——可由外部监听 combat:log 事件获取实时日志
    return [];
  }

  /** 战斗是否正在运行 */
  isInCombat(): boolean {
    return (
      this.state.status === CombatStatus.Preparing ||
      this.state.status === CombatStatus.InProgress
    );
  }

  // ─── IModule 实现 ──────────────────────────────────────

  tick(_deltaSeconds: number): void {
    this.processCombatTick(_deltaSeconds);
  }

  onSave(): SaveData {
    const data: CombatEngineSaveData = {
      status: this.state.status,
      enemies: this.state.enemies,
      partyMembers: this.state.partyMembers,
      elapsedTime: this.state.elapsedTime,
      combatLog: this.state.combatLog.slice(-50), // 仅保留最近 50 条
    };
    return data as unknown as SaveData;
  }

  onLoad(data: SaveData): void {
    const saveData = data as unknown as CombatEngineSaveData;
    this.state = {
      enemies: saveData.enemies ?? [],
      partyMembers: saveData.partyMembers ?? [],
      combatLog: saveData.combatLog ?? [],
      status: saveData.status ?? CombatStatus.None,
      elapsedTime: saveData.elapsedTime ?? 0,
      reward: { gold: 0, exp: 0, items: [] },
    };

    // 如果读档时战斗正在进行，恢复状态机
    if (this.state.status === CombatStatus.Preparing || this.state.status === CombatStatus.InProgress) {
      this.stateMachine.initialize(this.state.partyMembers, this.state.enemies);
      this.state.status = CombatStatus.InProgress;
    }
  }

  reset(): void {
    this.state = this.createInitialState();
    this.stateMachine.reset();
  }

  // ─── 内部方法 — 状态机回调 ────────────────────────────

  /** 回合开始：刷新冷却 */
  private handleRoundStart(): void {
    for (const member of this.state.partyMembers) {
      for (const skill of member.skills) {
        skill.currentCooldown = Math.max(0, skill.currentCooldown - 1);
      }
    }
    for (const enemy of this.state.enemies) {
      for (const skill of enemy.skills) {
        skill.currentCooldown = Math.max(0, skill.currentCooldown - 1);
      }
    }
  }

  /** 玩家角色行动（自动战斗 AI） */
  private handlePlayerAction(combatant: ICombatant): void {
    const skill = this.selectBestSkill(combatant);
    const target = this.selectTarget(combatant, false);
    if (target !== null) {
      this.executeSkill(combatant, target, skill.id);
    }
  }

  /** 敌人行动（简单 AI） */
  private handleEnemyAction(enemy: ICombatant): void {
    const skill = this.selectBestSkill(enemy);
    const target = this.selectTarget(enemy, true);
    if (target !== null) {
      this.executeSkill(enemy, target, skill.id);
    }
  }

  /** 回合结束判定回调 */
  private handleCheckEnd(): CombatPhaseResult {
    return this.checkBattleEnd();
  }

  /** 战斗结束内部回调 */
  private handleBattleEndInternal(): void {
    const result = this.checkBattleEnd();
    if (result === 'Victory') {
      this.endCombat(CombatStatus.Victory);
    } else if (result === 'Defeat') {
      this.endCombat(CombatStatus.Defeat);
    }
  }

  // ─── 内部方法 — 辅助 ──────────────────────────────────

  /** 创建初始空状态 */
  private createInitialState(): CombatState {
    return {
      enemies: [],
      partyMembers: [],
      combatLog: [],
      status: CombatStatus.None,
      elapsedTime: 0,
      reward: { gold: 0, exp: 0, items: [] },
    };
  }

  /** 获取战斗者队伍归属 */
  private getTeam(combatant: ICombatant): 'party' | 'enemy' {
    return this.state.partyMembers.includes(combatant) ? 'party' : 'enemy';
  }

  /** 自动选择最佳技能（最高伤害倍率优先，考虑冷却） */
  private selectBestSkill(combatant: ICombatant): ICombatSkill {
    const available = combatant.skills.filter((s) => s.currentCooldown <= 0);
    if (available.length > 0) {
      // 按伤害倍率降序排列
      const sorted = [...available].sort((a, b) => b.damageMultiplier - a.damageMultiplier);
      return sorted[0]!;
    }
    return BASIC_ATTACK_SKILL;
  }

  /**
   * 自动选择目标
   * @param user    施法者
   * @param isEnemy 施法者是否为敌人
   */
  private selectTarget(user: ICombatant, isEnemy: boolean): ICombatant | null {
    if (isEnemy) {
      // 敌人：随机攻击一个存活的玩家角色
      const alive = this.state.partyMembers.filter((m) => m.hp > 0);
      if (alive.length === 0) return null;
      const index = Math.floor(Math.random() * alive.length);
      return alive[index]!;
    }
    // 玩家：集火最低血量敌人
    const alive = this.state.enemies.filter((e) => e.hp > 0);
    if (alive.length === 0) return null;
    const sorted = [...alive].sort((a, b) => a.hp - b.hp);
    return sorted[0]!;
  }

  /** 计算战斗奖励（含物品掉落） */
  private calculateReward(): CombatReward {
    let totalExp = 0;
    let totalGold = 0;
    const items: string[] = [];

    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0) {
        totalExp += Math.floor(enemy.level * 10 * expRewardMultiplier);
        totalGold += Math.floor(enemy.level * 5 * goldRewardMultiplier);

        // 每个被击败的敌人有 30% 概率掉落物品
        if (Math.random() < 0.3) {
          const droppable = itemRegistry.getDroppableItems();
          if (droppable.length > 0) {
            const totalWeight = droppable.reduce((sum, i) => sum + i.dropWeight, 0);
            let roll = Math.random() * totalWeight;
            let selected = droppable[droppable.length - 1]!;
            for (const d of droppable) {
              roll -= d.dropWeight;
              if (roll <= 0) {
                selected = d;
                break;
              }
            }
            items.push(selected.id);
          }
        }
      }
    }

    return { gold: totalGold, exp: totalExp, items };
  }

  /** 添加战斗日志 */
  private addCombatLog(
    user: ICombatant,
    target: ICombatant,
    skill: ICombatSkill,
    result: DamageResult,
  ): void {
    let message: string;
    let type: CombatLogEntry['type'];

    if (result.isDodged) {
      message = `${target.name} 闪避了 ${user.name} 的${skill.name}！`;
      type = 'dodge';
    } else if (result.isCrit) {
      message = `${user.name} 对 ${target.name} 造成暴击 ${result.damage} 点伤害！`;
      type = 'crit';
    } else {
      message = `${user.name} 对 ${target.name} 造成 ${result.damage} 点伤害`;
      type = 'damage';
    }

    const entry: CombatLogEntry = {
      timestamp: this.state.elapsedTime,
      message,
      type,
    };

    this.state.combatLog.push(entry);

    // 限制日志数量
    if (this.state.combatLog.length > MAX_COMBAT_LOG) {
      this.state.combatLog.splice(0, this.state.combatLog.length - MAX_COMBAT_LOG);
    }

    globalEventBus.emit<CombatLogEntry>('combat:log', entry);
  }

  /** 添加系统日志 */
  private addSystemLog(message: string): void {
    const entry: CombatLogEntry = {
      timestamp: this.state.elapsedTime,
      message,
      type: 'system',
    };
    this.state.combatLog.push(entry);

    if (this.state.combatLog.length > MAX_COMBAT_LOG) {
      this.state.combatLog.splice(0, this.state.combatLog.length - MAX_COMBAT_LOG);
    }

    globalEventBus.emit<CombatLogEntry>('combat:log', entry);
  }

  /** 深拷贝战斗者列表 */
  private deepCloneCombatants(combatants: ICombatant[]): ICombatant[] {
    return combatants.map((c) => ({
      ...c,
      skills: c.skills.map((s) => ({ ...s })),
    }));
  }
}

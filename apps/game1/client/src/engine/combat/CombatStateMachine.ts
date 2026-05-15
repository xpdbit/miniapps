/**
 * CombatStateMachine — 战斗状态机
 *
 * 状态流转:
 *   Preparation → PlayerTurn → EnemyTurn → CheckEnd ──→ PlayerTurn (新回合)
 *                                                     └──→ BattleEnd (战斗结束)
 *
 * 每次 tick 处理一个角色的行动，由外部（CombatEngine）通过回调驱动。
 */

import type { ICombatant } from './CombatEngine';

/** 战斗阶段枚举 */
export enum CombatPhase {
  /** 准备阶段 — 战斗开始前短暂停顿 */
  Preparation = 'Preparation',
  /** 玩家回合 — 玩家队伍逐个行动 */
  PlayerTurn = 'PlayerTurn',
  /** 敌人回合 — 敌方逐个行动 */
  EnemyTurn = 'EnemyTurn',
  /** 回合结束判定 — 检查胜负条件 */
  CheckEnd = 'CheckEnd',
}

/** 状态机回调接口 */
export interface CombatCallbacks {
  /** 回合开始（每轮仅触发一次，用于冷却刷新等） */
  onRoundStart?(): void;
  /** 玩家角色行动 */
  onPlayerAction(combatant: ICombatant): void;
  /** 敌人行动 */
  onEnemyAction(combatant: ICombatant): void;
  /**
   * 回合结束判定
   * @returns Victory | Defeat — 战斗结束；null — 继续下一回合
   */
  onCheckEnd(): CombatPhaseResult;
  /** 战斗结束 */
  onBattleEnd(): void;
}

/** 战斗结束状态类型 */
export type CombatPhaseResult = 'Victory' | 'Defeat' | null;

/** 默认准备阶段持续时间（秒） */
const DEFAULT_PREP_DURATION = 1.5;

/**
 * CombatStateMachine
 *
 * 状态机本身不持有战斗数据引用，通过回调与 CombatEngine 交互。
 * 每个 handleState() 调用至多处理一个角色的行动。
 */
export class CombatStateMachine {
  private phase: CombatPhase = CombatPhase.Preparation;
  private actorIndex: number = 0;
  private phaseTimer: number = 0;
  private readonly prepDuration: number;
  private roundStarted: boolean = false;

  // 当前回合有效的战斗者列表（仅存活，每轮刷新）
  private playerList: ICombatant[] = [];
  private enemyList: ICombatant[] = [];

  constructor(prepDuration: number = DEFAULT_PREP_DURATION) {
    this.prepDuration = prepDuration;
  }

  // ─── 公开方法 ─────────────────────────────────────────

  /** 初始化状态机（战斗开始时调用） */
  initialize(players: ICombatant[], enemies: ICombatant[]): void {
    this.phase = CombatPhase.Preparation;
    this.actorIndex = 0;
    this.phaseTimer = 0;
    this.roundStarted = false;
    this.playerList = players.filter((p) => p.hp > 0);
    this.enemyList = enemies.filter((e) => e.hp > 0);
  }

  /**
   * 每帧驱动状态机
   * @param deltaSeconds 帧间隔（秒）
   * @param callbacks    状态转换回调
   * @returns true — 战斗进行中；false — 战斗已结束
   */
  handleState(deltaSeconds: number, callbacks: CombatCallbacks): boolean {
    switch (this.phase) {
      case CombatPhase.Preparation:
        return this.handlePreparation(deltaSeconds);

      case CombatPhase.PlayerTurn:
        return this.handleTurn(this.playerList, callbacks.onPlayerAction, CombatPhase.EnemyTurn, callbacks);

      case CombatPhase.EnemyTurn:
        return this.handleTurn(this.enemyList, callbacks.onEnemyAction, CombatPhase.CheckEnd, callbacks);

      case CombatPhase.CheckEnd:
        return this.handleCheckEnd(callbacks);
    }
  }

  /** 获取当前阶段 */
  getPhase(): CombatPhase {
    return this.phase;
  }

  /** 重置状态机 */
  reset(): void {
    this.phase = CombatPhase.Preparation;
    this.actorIndex = 0;
    this.phaseTimer = 0;
    this.roundStarted = false;
    this.playerList = [];
    this.enemyList = [];
  }

  // ─── 内部方法 ─────────────────────────────────────────

  private handlePreparation(_deltaSeconds: number): boolean {
    this.phaseTimer += _deltaSeconds;
    if (this.phaseTimer >= this.prepDuration) {
      this.transitionTo(CombatPhase.PlayerTurn);
    }
    return true;
  }

  /**
   * 处理一个回合阶段（PlayerTurn / EnemyTurn）
   * 每调用一次处理一个角色的行动，直到该阶段所有角色行动完毕。
   */
  private handleTurn(
    actors: ICombatant[],
    actionCallback: (c: ICombatant) => void,
    nextPhase: CombatPhase,
    callbacks: CombatCallbacks,
  ): boolean {
    // 首次进入阶段时触发 onRoundStart
    if (this.actorIndex === 0 && !this.roundStarted) {
      this.roundStarted = true;
      callbacks.onRoundStart?.();
    }

    // 找到下一个存活的角色并执行行动
    while (this.actorIndex < actors.length) {
      const actor = actors[this.actorIndex];
      if (actor === undefined) {
        this.actorIndex++;
        continue;
      }
      this.actorIndex++;
      if (actor.hp > 0) {
        actionCallback(actor);
        return true; // 一个 tick 处理一个行动
      }
    }

    // 所有角色行动完毕，进入下一阶段
    this.transitionTo(nextPhase);
    return true;
  }

  /** 回合结束判定 */
  private handleCheckEnd(callbacks: CombatCallbacks): boolean {
    const result = callbacks.onCheckEnd();
    if (result === 'Victory' || result === 'Defeat') {
      callbacks.onBattleEnd();
      return false; // 战斗结束
    }
    // 继续下一回合
    this.transitionTo(CombatPhase.PlayerTurn);
    return true;
  }

  /** 阶段切换 */
  private transitionTo(newPhase: CombatPhase): void {
    this.phase = newPhase;
    this.actorIndex = 0;
    this.phaseTimer = 0;
    this.roundStarted = false;

    // 新回合开始时刷新存活列表
    if (newPhase === CombatPhase.PlayerTurn || newPhase === CombatPhase.EnemyTurn) {
      this.playerList = this.playerList.filter((p) => p.hp > 0);
      this.enemyList = this.enemyList.filter((e) => e.hp > 0);
    }
  }
}

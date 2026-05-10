import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';

/** 活跃度指标 */
export interface ActivityMetrics {
  keypressCount: number;
  mouseMoveCount: number;
  sessionDuration: number;
  actionsPerMinute: number;
  activityScore: number;
}

/** 活跃度等级 */
export type ActivityLevel = 'active' | 'normal' | 'idle';

/** 活跃度等级变更事件载荷 */
export interface LevelChangedPayload {
  previous: ActivityLevel;
  current: ActivityLevel;
}

/** 行为记录事件载荷 */
export interface ActionRecordedPayload {
  type: string;
  timestamp: number;
}

/**
 * 活跃度引擎
 * - 追踪玩家操作频率与行为模式
 * - active: 更多步数、更多交互事件
 * - idle: +50% 自动战斗效率、+100% 离线收益
 */
export class ActivityEngine implements IModule {
  readonly moduleId = 'activity';

  private static _instance: ActivityEngine;
  static get instance(): ActivityEngine {
    if (!ActivityEngine._instance) {
      ActivityEngine._instance = new ActivityEngine();
    }
    return ActivityEngine._instance;
  }

  private metrics: ActivityMetrics = {
    keypressCount: 0,
    mouseMoveCount: 0,
    sessionDuration: 0,
    actionsPerMinute: 0,
    activityScore: 50,
  };

  /** 最近一次已知等级，用于检测变更 */
  private lastLevel: ActivityLevel = 'normal';
  /** 近期行为时间戳（用于计算 APM） */
  private recentActions: number[] = [];
  /** 每秒衰减分数 */
  private readonly decayRate = 2;
  /** 活跃评分计算所需的最低 APM 阈值 */
  private readonly activeThreshold = 6;
  /** 空闲评分上限 */
  private readonly idleThreshold = 20;

  /**
   * 基于近期行为频率计算活跃度评分
   * @param deltaSeconds 距上次 tick 的秒数
   */
  calculateActivityScore(deltaSeconds: number): void {
    const now = Date.now();
    this.recentActions = this.recentActions.filter(t => now - t < 60000);

    const apm = deltaSeconds > 0
      ? this.recentActions.length / (deltaSeconds / 60)
      : 0;
    this.metrics.actionsPerMinute = Math.round(apm * 100) / 100;

    // 目标活跃度：每分钟 6 次操作 = 活跃线
    const targetScore = Math.min(100, (apm / this.activeThreshold) * 100);
    this.metrics.activityScore += (targetScore - this.metrics.activityScore) * 0.1;
    this.metrics.activityScore = Math.max(0, Math.min(100, this.metrics.activityScore));

    this.checkLevelChange();
  }

  /**
   * 记录一次玩家操作
   * @param actionType 操作类型（keyboard / click / mousemove 等）
   */
  recordAction(actionType: string): void {
    const now = Date.now();
    this.recentActions.push(now);

    if (actionType === 'keyboard' || actionType === 'click') {
      this.metrics.keypressCount++;
    } else if (actionType === 'mousemove') {
      this.metrics.mouseMoveCount++;
    }

    const payload: ActionRecordedPayload = { type: actionType, timestamp: now };
    globalEventBus.emit('activity:action', payload);
  }

  /**
   * 获取当前活跃度等级
   * - active: score >= 60
   * - normal: 20 <= score < 60
   * - idle: score < 20
   */
  getActivityLevel(): ActivityLevel {
    const score = this.metrics.activityScore;
    if (score >= 60) return 'active';
    if (score >= this.idleThreshold) return 'normal';
    return 'idle';
  }

  /**
   * 获取当前活跃度分数
   */
  getScore(): number {
    return this.metrics.activityScore;
  }

  /**
   * 获取 APM
   */
  getActionsPerMinute(): number {
    return this.metrics.actionsPerMinute;
  }

  /**
   * 获取会话持续时间（秒）
   */
  getSessionDuration(): number {
    return this.metrics.sessionDuration;
  }

  /** 检测等级变化并发射事件 */
  private checkLevelChange(): void {
    const currentLevel = this.getActivityLevel();
    if (currentLevel !== this.lastLevel) {
      const previous = this.lastLevel;
      this.lastLevel = currentLevel;
      const payload: LevelChangedPayload = { previous, current: currentLevel };
      globalEventBus.emit('activity:levelChanged', payload);
    }
  }

  /** IModule: tick */
  tick(deltaSeconds: number): void {
    this.metrics.sessionDuration += deltaSeconds;

    // 当活跃度高于 50 时自然衰减
    if (this.metrics.activityScore > 50) {
      this.metrics.activityScore -= this.decayRate * deltaSeconds;
      this.metrics.activityScore = Math.max(50, this.metrics.activityScore);
    }

    this.calculateActivityScore(deltaSeconds);
  }

  /** IModule: onSave */
  onSave(): SaveData {
    return {
      metrics: { ...this.metrics },
    };
  }

  /** IModule: onLoad */
  onLoad(data: SaveData): void {
    const saved = data as { metrics?: ActivityMetrics };
    if (saved.metrics) {
      this.metrics = { ...saved.metrics };
      this.lastLevel = this.getActivityLevel();
    }
  }

  /** IModule: reset */
  reset(): void {
    this.metrics = {
      keypressCount: 0,
      mouseMoveCount: 0,
      sessionDuration: 0,
      actionsPerMinute: 0,
      activityScore: 50,
    };
    this.recentActions = [];
    this.lastLevel = 'normal';
  }
}

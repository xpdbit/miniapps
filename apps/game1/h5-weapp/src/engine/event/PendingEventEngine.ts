/**
 * PendingEventEngine — 待处理事件引擎（单例）
 *
 * 核心职责:
 *   - 管理待处理事件队列（最多 20 条）
 *   - 支持按类型/难度筛选和批量处理
 *   - 挂机时自动处理（batchProcess）
 *   - 可过期事件自动清理
 *   - 实现 IModule 接口以支持存档/读档/重置
 */

import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';

// ─── 事件载荷类型 ─────────────────────────────────────────

export interface PendingEventAddedEvent {
  event: PendingEvent;
}

export interface PendingEventProcessedEvent {
  eventId: string;
  choiceIndex: number;
}

export interface PendingEventExpiredEvent {
  eventId: string;
}

// ─── 核心类型 ─────────────────────────────────────────────

/** 待处理事件类型 */
export type PendingEventType = 'combat' | 'exploration' | 'trade' | 'reward';

/** 待处理事件难度 */
export type PendingEventDifficulty = 'normal' | 'rare' | 'legendary';

/** 待处理事件选项（简化版，仅用于玩家决策） */
export interface PendingEventChoice {
  /** 选项显示文本 */
  text: string;
}

/** 待处理事件 */
export interface PendingEvent {
  /** 事件唯一标识 */
  id: string;
  /** 事件类型 */
  type: PendingEventType;
  /** 事件标题 */
  title: string;
  /** 事件描述 */
  description: string;
  /** 难度 */
  difficulty: PendingEventDifficulty;
  /** 是否已处理 */
  isProcessed: boolean;
  /** 获取时间戳（秒） */
  acquiredAt: number;
  /** 过期时间戳（秒），null 表示永不过期 */
  expiresAt: number | null;
  /** 可用选项 */
  choices: PendingEventChoice[];
}

// ─── 常量 ─────────────────────────────────────────────────

/** 待处理事件最大数量 */
const MAX_PENDING_EVENTS = 20;

/** 过期检查间隔（秒） */
const EXPIRY_CHECK_INTERVAL = 5;

// ─── 存档接口 ─────────────────────────────────────────────

interface PendingEventSaveData {
  events: PendingEvent[];
}

// ─── 待处理事件引擎 ───────────────────────────────────────

export class PendingEventEngine implements IModule {
  readonly moduleId = 'PendingEventEngine';

  // ─── 单例 ───────────────────────────────────────────────
  private static _instance: PendingEventEngine;

  static get instance(): PendingEventEngine {
    if (PendingEventEngine._instance === undefined) {
      PendingEventEngine._instance = new PendingEventEngine();
    }
    return PendingEventEngine._instance;
  }

  // ─── 状态 ───────────────────────────────────────────────
  private pendingEvents: PendingEvent[] = [];
  private timeSinceLastExpiryCheck: number = 0;

  private constructor() {}

  // ─── 事件管理 ───────────────────────────────────────────

  /**
   * 添加待处理事件
   * @param event 事件对象
   * @returns 是否成功添加
   */
  addEvent(event: PendingEvent): boolean {
    if (this.pendingEvents.length >= MAX_PENDING_EVENTS) {
      console.warn(`[PendingEventEngine] 待处理事件已满，无法添加: ${event.id}`);
      return false;
    }

    this.pendingEvents.push({ ...event, isProcessed: false });

    globalEventBus.emit<PendingEventAddedEvent>('pendingEvent:added', {
      event: this.pendingEvents[this.pendingEvents.length - 1]!,
    });

    return true;
  }

  /**
   * 处理一个待处理事件
   * @param id 事件 ID
   * @param choiceIndex 选择的选项索引
   */
  processEvent(id: string, choiceIndex: number): void {
    const event = this.pendingEvents.find((e) => e.id === id);
    if (event === undefined) {
      console.warn(`[PendingEventEngine] 未找到事件: ${id}`);
      return;
    }
    if (event.isProcessed) {
      console.warn(`[PendingEventEngine] 事件已处理: ${id}`);
      return;
    }

    // 校验选项索引
    if (choiceIndex < 0 || choiceIndex >= event.choices.length) {
      return;
    }

    event.isProcessed = true;

    globalEventBus.emit<PendingEventProcessedEvent>('pendingEvent:processed', {
      eventId: id,
      choiceIndex,
    });
  }

  // ─── 查询方法 ─────────────────────────────────────────

  /**
   * 获取待处理事件列表（可选按类型/难度筛选）
   * @param type 事件类型筛选（可选）
   * @param difficulty 难度筛选（可选）
   * @returns 匹配的未处理事件列表
   */
  getPendingEvents(type?: PendingEventType, difficulty?: PendingEventDifficulty): PendingEvent[] {
    let result = this.pendingEvents;
    if (type !== undefined) {
      result = result.filter((e) => e.type === type);
    }
    if (difficulty !== undefined) {
      result = result.filter((e) => e.difficulty === difficulty);
    }
    return result.map((e) => ({ ...e }));
  }

  /**
   * 根据 ID 获取待处理事件
   * @param id 事件 ID
   * @returns 事件对象，未找到时返回 undefined
   */
  getEvent(id: string): PendingEvent | undefined {
    const event = this.pendingEvents.find((e) => e.id === id);
    return event !== undefined ? { ...event } : undefined;
  }

  /**
   * 批量处理所有指定类型的未处理事件（挂机时自动处理）
   * @param type 事件类型
   */
  batchProcess(type: PendingEventType): void {
    const candidates = this.pendingEvents.filter(
      (e) => e.type === type && !e.isProcessed,
    );
    for (const event of candidates) {
      // 自动选择第一个选项
      event.isProcessed = true;
      globalEventBus.emit<PendingEventProcessedEvent>('pendingEvent:processed', {
        eventId: event.id,
        choiceIndex: 0,
      });
    }
  }

  /**
   * 移除所有已处理的事件
   */
  removeProcessed(): void {
    const before = this.pendingEvents.length;
    this.pendingEvents = this.pendingEvents.filter((e) => !e.isProcessed);
    const removed = before - this.pendingEvents.length;
    if (removed > 0) {
      console.log(`[PendingEventEngine] 清理了 ${removed} 个已处理事件`);
    }
  }

  /** 获取当前待处理事件数量 */
  getCount(): number {
    return this.pendingEvents.length;
  }

  /** 待处理事件队列是否已满 */
  isFull(): boolean {
    return this.pendingEvents.length >= MAX_PENDING_EVENTS;
  }

  /** 获取最大容量 */
  getMaxPending(): number {
    return MAX_PENDING_EVENTS;
  }

  // ─── IModule 实现 ──────────────────────────────────────

  tick(deltaSeconds: number): void {
    this.timeSinceLastExpiryCheck += deltaSeconds;
    if (this.timeSinceLastExpiryCheck < EXPIRY_CHECK_INTERVAL) {
      return;
    }
    this.timeSinceLastExpiryCheck = 0;

    const now = Math.floor(Date.now() / 1000);
    const expiredIds: string[] = [];

    for (const event of this.pendingEvents) {
      if (
        !event.isProcessed &&
        event.expiresAt !== null &&
        now >= event.expiresAt
      ) {
        expiredIds.push(event.id);
      }
    }

    for (const id of expiredIds) {
      const index = this.pendingEvents.findIndex((e) => e.id === id);
      if (index !== -1) {
        this.pendingEvents.splice(index, 1);
        globalEventBus.emit<PendingEventExpiredEvent>('pendingEvent:expired', {
          eventId: id,
        });
      }
    }
  }

  onSave(): SaveData {
    const data: PendingEventSaveData = {
      events: this.pendingEvents.map((e) => ({ ...e })),
    };
    return data as unknown as SaveData;
  }

  onLoad(data: SaveData): void {
    const save = data as unknown as PendingEventSaveData;
    this.pendingEvents = save.events ?? [];
    this.timeSinceLastExpiryCheck = 0;
  }

  reset(): void {
    this.pendingEvents = [];
    this.timeSinceLastExpiryCheck = 0;
  }
}

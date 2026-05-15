/**
 * EventChainEngine — 顺序事件链引擎（单例）
 *
 * 核心职责:
 *   - 管理预定义的顺序事件链（线性推进）
 *   - 每条链按固定顺序包含多个事件节点
 *   - 通过 EventBus 发出链推进事件
 *   - 不实现 IModule（纯事件驱动）
 */

import { globalEventBus } from '../core/EventBus';

// ─── 事件载荷类型 ─────────────────────────────────────────

export interface EventChainStartedEvent {
  chainId: string;
  currentEvent: EventNode;
}

export interface EventChainAdvancedEvent {
  chainId: string;
  previousEvent: EventNode;
  currentEvent: EventNode | null;
  isCompleted: boolean;
}

export interface EventChainCompletedEvent {
  chainId: string;
}

// ─── 核心类型 ─────────────────────────────────────────────

/** 事件链中的单个节点 */
export interface EventNode {
  /** 节点唯一标识 */
  id: string;
  /** 节点标题 */
  title: string;
  /** 节点描述 */
  description: string;
}

/** 一条事件链的运行状态 */
export interface EventChain {
  /** 链标识 */
  chainId: string;
  /** 事件节点有序列表 */
  events: EventNode[];
  /** 当前所在节点索引 */
  currentIndex: number;
  /** 是否处于激活状态 */
  isActive: boolean;
  /** 是否已完成 */
  isCompleted: boolean;
}

// ─── 预定义事件链 ─────────────────────────────────────────

const PREDEFINED_CHAINS: Record<string, EventNode[]> = {
  'The Lost Caravan': [
    {
      id: 'caravan_rescue',
      title: '救援商队',
      description: '你在路边发现一支遭到袭击的商队，伤员们正在呼救。',
    },
    {
      id: 'caravan_negotiate',
      title: '协商报酬',
      description: '商队首领感谢你的帮助，愿意用货物作为报酬，但希望你护送他们到下一个城镇。',
    },
    {
      id: 'caravan_reward',
      title: '获得报酬',
      description: '安全抵达城镇后，商队首领慷慨地与你分享了货物和情报。',
    },
  ],
  'Ancient Ruins': [
    {
      id: 'ruins_explore',
      title: '探索遗迹',
      description: '一座被藤蔓覆盖的古老遗迹出现在眼前，石门半掩，幽深莫测。',
    },
    {
      id: 'ruins_puzzle',
      title: '解谜机关',
      description: '遗迹深处有一道刻满符文的石门，需要解开古老的谜题才能通过。',
    },
    {
      id: 'ruins_treasure',
      title: '宝藏/战斗',
      description: '石门开启后，你发现了堆积如山的财宝，但也惊醒了沉睡的守卫。',
    },
  ],
  'Mountain Pass': [
    {
      id: 'pass_climb',
      title: '攀登山路',
      description: '险峻的山路蜿蜒而上，寒风刺骨，每一步都需格外小心。',
    },
    {
      id: 'pass_rest',
      title: '山间休整',
      description: '半山腰有一处避风的山洞，可以生火休息，恢复体力。',
    },
    {
      id: 'pass_storm',
      title: '暴风雪来袭',
      description: '天气骤变，暴风雪呼啸而来，能见度急剧下降，必须寻找庇护所。',
    },
    {
      id: 'pass_shelter',
      title: '抵达庇护所',
      description: '在暴风雪中找到了一座废弃的猎人小屋，里面有柴火和食物。',
    },
  ],
};

// ─── 事件链引擎 ───────────────────────────────────────────

export class EventChainEngine {
  // ─── 单例 ───────────────────────────────────────────────
  private static _instance: EventChainEngine;

  static get instance(): EventChainEngine {
    if (EventChainEngine._instance === undefined) {
      EventChainEngine._instance = new EventChainEngine();
    }
    return EventChainEngine._instance;
  }

  // ─── 状态 ───────────────────────────────────────────────
  /** 活跃的事件链（chainId → EventChain） */
  private activeChains: Map<string, EventChain> = new Map();
  /** 所有历史事件链（包括已完成的） */
  private allChains: Map<string, EventChain> = new Map();

  private constructor() {}

  // ─── 事件链控制 ─────────────────────────────────────────

  /**
   * 启动一条预定义事件链
   * @param chainId 事件链标识（必须是预定义链之一）
   */
  startChain(chainId: string): void {
    const template = PREDEFINED_CHAINS[chainId];
    if (template === undefined) {
      console.error(`[EventChainEngine] 未找到事件链定义: ${chainId}`);
      return;
    }

    // 深拷贝事件节点，防止外部篡改
    const events = template.map((node) => ({ ...node }));

    const chain: EventChain = {
      chainId,
      events,
      currentIndex: 0,
      isActive: true,
      isCompleted: false,
    };

    this.activeChains.set(chainId, chain);
    this.allChains.set(chainId, chain);

    const currentEvent = chain.events[0]!;

    globalEventBus.emit<EventChainStartedEvent>('eventChain:started', {
      chainId,
      currentEvent,
    });
  }

  /**
   * 获取指定链的当前事件节点
   * @param chainId 事件链标识
   * @returns 当前事件节点，链不存在或已完成时返回 undefined
   */
  getCurrentEvent(chainId: string): EventNode | undefined {
    const chain = this.activeChains.get(chainId);
    if (chain === undefined || !chain.isActive || chain.isCompleted) {
      return undefined;
    }
    return chain.events[chain.currentIndex];
  }

  /**
   * 推进事件链到下一个事件
   * @param chainId 事件链标识
   */
  advanceChain(chainId: string): void {
    const chain = this.activeChains.get(chainId);
    if (chain === undefined || !chain.isActive || chain.isCompleted) {
      return;
    }

    const previousEvent = chain.events[chain.currentIndex]!;
    const nextIndex = chain.currentIndex + 1;

    if (nextIndex >= chain.events.length) {
      // 已到达末尾，自动完成
      this.completeChain(chainId);
      return;
    }

    chain.currentIndex = nextIndex;
    const currentEvent = chain.events[nextIndex]!;

    globalEventBus.emit<EventChainAdvancedEvent>('eventChain:advanced', {
      chainId,
      previousEvent,
      currentEvent,
      isCompleted: false,
    });
  }

  /**
   * 标记事件链为已完成
   * @param chainId 事件链标识
   */
  completeChain(chainId: string): void {
    const chain = this.activeChains.get(chainId);
    if (chain === undefined || !chain.isActive || chain.isCompleted) {
      return;
    }

    chain.isActive = false;
    chain.isCompleted = true;
    this.activeChains.delete(chainId);

    globalEventBus.emit<EventChainCompletedEvent>('eventChain:completed', {
      chainId,
    });
  }

  // ─── 查询方法 ─────────────────────────────────────────

  /** 获取所有活跃的事件链 */
  getActiveChains(): EventChain[] {
    return Array.from(this.activeChains.values());
  }

  /** 获取所有事件链（包括已完成的） */
  getAllChains(): EventChain[] {
    return Array.from(this.allChains.values());
  }

  /** 获取指定事件链 */
  getChain(chainId: string): EventChain | undefined {
    return this.allChains.get(chainId);
  }

  /** 获取所有预定义事件链的 ID 列表 */
  getAvailableChains(): string[] {
    return Object.keys(PREDEFINED_CHAINS);
  }

  // ─── 重置 ─────────────────────────────────────────────

  /** 清除所有运行状态（仅保留预定义数据） */
  reset(): void {
    this.activeChains.clear();
    this.allChains.clear();
  }
}

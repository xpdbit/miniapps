import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';
import { clamp } from '../../utils/math';
import { TravelResource } from './TravelResource';
import { MileageManager } from './MileageManager';
import {
  RouteEventController,
  RouteDefinition,
  RouteNode,
  RouteNodeType,
  TravelEvent,
  EventTriggeredPayload,
  NodeReachedPayload,
  type EventOutcome,
} from './RouteEventController';
import { DropEngine } from '../inventory/DropEngine';

// ==================== 状态枚举 ====================

export enum TravelStatus {
  Idle = 'Idle',
  Traveling = 'Traveling',
  Paused = 'Paused',
  Arrived = 'Arrived',
  InSettlement = 'InSettlement',
  Crossroad = 'Crossroad',
  EventActive = 'EventActive',
}

// ==================== 事件载荷 ====================

export interface StatusChangedPayload {
  previousStatus: TravelStatus;
  currentStatus: TravelStatus;
  routeId: string | null;
}

export interface TravelProgressPayload {
  progress: number;
  routeId: string | null;
  speedMultiplier: number;
  nodesVisited: number;
  totalNodes: number;
}

export interface TravelCompletedPayload {
  routeId: string;
  rewards: TravelRewards;
  totalMileage: number;
  sessionMileage: number;
}

export interface TravelAutoPausedPayload {
  reason: string;
  progress: number;
  routeId: string | null;
}

// ==================== 奖励系统 ====================

export interface TravelRewards {
  gold: number;
  exp: number;
  gems: number;
}

// ==================== 存档 ====================

export interface TravelSaveData {
  currentStatus: TravelStatus;
  progress: number;
  currentRouteId: string | null;
  nodesVisited: number;
  isPaused: boolean;
}

// ==================== 常量 ====================

/** 基础旅行速度倍率 */
const TRAVEL_BASE_SPEED: number = 1.0;

/** 基础里程速率（公里/秒） */
const BASE_MILEAGE_RATE: number = 0.1;

/** 士气速度修正阈值 */
const MORALE_HIGH_THRESHOLD: number = 80;
const MORALE_MID_THRESHOLD: number = 50;
const MORALE_LOW_THRESHOLD: number = 20;

const MORALE_HIGH_MULTIPLIER: number = 1.2;
const MORALE_NORMAL_MULTIPLIER: number = 1.0;
const MORALE_LOW_MULTIPLIER: number = 0.8;
const MORALE_CRITICAL_MULTIPLIER: number = 0.5;

/** 里程碑奖励倍率 */
const MORALE_REWARD_HIGH: number = 1.5;
const MORALE_REWARD_MID: number = 1.2;
const MORALE_REWARD_LOW: number = 1.0;
const MORALE_REWARD_CRITICAL: number = 0.5;

/** 完成奖励基础值 */
const COMPLETION_GOLD_PER_KM: number = 2;
const COMPLETION_EXP_PER_KM: number = 3;
const COMPLETION_GEMS_FIXED: number = 5;

// ==================== 默认路线 ====================

const DEFAULT_ROUTES: RouteDefinition[] = [
  {
    routeId: 'novice_path',
    name: 'Novice Path',
    description: 'A gentle journey through peaceful countryside, perfect for new travelers.',
    totalLength: 10,
    levelRequirement: 1,
    nodeCount: 5,
    speedMultiplier: 1.0,
  },
  {
    routeId: 'emerald_fields',
    name: 'Emerald Fields',
    description: 'Rolling green hills and scattered woodlands await the eager explorer.',
    totalLength: 30,
    levelRequirement: 5,
    nodeCount: 8,
    speedMultiplier: 1.0,
  },
  {
    routeId: 'misty_mountains',
    name: 'Misty Mountains',
    description: 'Treacherous mountain passes shrouded in mist. Only the prepared should attempt this route.',
    totalLength: 60,
    levelRequirement: 10,
    nodeCount: 10,
    speedMultiplier: 0.9,
  },
  {
    routeId: 'shadow_swamp',
    name: 'Shadow Swamp',
    description: 'Dark and fetid wetlands teeming with danger. Great rewards await those who dare.',
    totalLength: 100,
    levelRequirement: 20,
    nodeCount: 12,
    speedMultiplier: 0.8,
  },
  {
    routeId: 'dragon_domain',
    name: 'Dragon Domain',
    description: 'The ultimate challenge — traverse the ancient lands where dragons still rule the skies.',
    totalLength: 200,
    levelRequirement: 50,
    nodeCount: 15,
    speedMultiplier: 0.7,
  },
];

// ==================== 主类 ====================

export class TravelEngine implements IModule {
  readonly moduleId = 'TravelEngine';

  private static _instance: TravelEngine;
  static get instance(): TravelEngine {
    if (!TravelEngine._instance) {
      TravelEngine._instance = new TravelEngine();
    }
    return TravelEngine._instance;
  }

  // 状态
  private currentStatus: TravelStatus = TravelStatus.Idle;
  private previousStatus: TravelStatus = TravelStatus.Idle;
  private _progress: number = 0;
  private currentRouteId: string | null = null;
  private nodesVisited: number = 0;
  private isPaused: boolean = false;

  // 路线注册表
  private routeRegistry: Map<string, RouteDefinition> = new Map();

  // 引用的子模块
  private travelResource: TravelResource = TravelResource.instance;
  private mileageManager: MileageManager = MileageManager.instance;
  private routeEventController: RouteEventController = RouteEventController.instance;
  private dropEngine: DropEngine = DropEngine.instance;

  private constructor() {
    this.registerDefaultRoutes();
  }

  // ==================== 公共访问器 ====================

  get status(): TravelStatus {
    return this.currentStatus;
  }

  get progress(): number {
    return this._progress;
  }

  get routeId(): string | null {
    return this.currentRouteId;
  }

  get isTravelActive(): boolean {
    return (
      this.currentStatus === TravelStatus.Traveling ||
      this.currentStatus === TravelStatus.Paused
    );
  }

  get isRouteActive(): boolean {
    return this.currentRouteId !== null && this.currentStatus !== TravelStatus.Idle;
  }

  get nodesVisitedCount(): number {
    return this.nodesVisited;
  }

  get currentRoute(): RouteDefinition | null {
    if (!this.currentRouteId) return null;
    return this.routeRegistry.get(this.currentRouteId) ?? null;
  }

  // ==================== 路线管理 ====================

  /** 注册一条路线 */
  registerRoute(route: RouteDefinition): void {
    this.routeRegistry.set(route.routeId, route);
  }

  /** 批量注册路线 */
  registerRoutes(routes: RouteDefinition[]): void {
    for (const route of routes) {
      this.registerRoute(route);
    }
  }

  /** 获取玩家当前可用的路线（按等级筛选） */
  getAvailableRoutes(playerLevel: number): RouteDefinition[] {
    const available: RouteDefinition[] = [];
    this.routeRegistry.forEach((route) => {
      if (playerLevel >= route.levelRequirement) {
        available.push({ ...route });
      }
    });
    return available.sort((a, b) => a.levelRequirement - b.levelRequirement);
  }

  /** 获取所有已注册路线 */
  getAllRoutes(): RouteDefinition[] {
    const routes: RouteDefinition[] = [];
    this.routeRegistry.forEach((route) => {
      routes.push({ ...route });
    });
    return routes;
  }

  // ==================== 状态机操作 ====================

  /**
   * 开始旅行
   * @param routeId 路线 ID
   * @param playerLevel 玩家等级（用于校验）
   * @returns 是否成功开始
   */
  startTravel(routeId: string, playerLevel: number): boolean {
    // 只能在 Idle 或 Arrived 状态下开始新旅行
    if (
      this.currentStatus !== TravelStatus.Idle &&
      this.currentStatus !== TravelStatus.Arrived
    ) {
      return false;
    }

    const route = this.routeRegistry.get(routeId);
    if (!route) return false;

    // 等级校验
    if (playerLevel < route.levelRequirement) return false;

    // 资源校验
    if (!this.travelResource.canTravel()) {
      globalEventBus.emit<TravelAutoPausedPayload>('travel:autoPaused', {
        reason: 'resources_exhausted',
        progress: 0,
        routeId: null,
      });
      return false;
    }

    // 生成路线节点
    this.routeEventController.generateRoute(route);

    // 重置状态
    this._progress = 0;
    this.currentRouteId = routeId;
    this.nodesVisited = 0;
    this.isPaused = false;
    this.previousStatus = this.currentStatus;
    this.currentStatus = TravelStatus.Traveling;

    // 重置会话里程
    this.mileageManager.resetSessionMileage();

    // 标记开始节点已访问
    const startNode = this.routeEventController.currentNode;
    if (startNode && startNode.type === RouteNodeType.Start) {
      this.nodesVisited = 1;
    }

    globalEventBus.emit<StatusChangedPayload>('travel:statusChanged', {
      previousStatus: this.previousStatus,
      currentStatus: this.currentStatus,
      routeId: this.currentRouteId,
    });

    return true;
  }

  /** 暂停旅行 */
  pauseTravel(): void {
    if (this.currentStatus !== TravelStatus.Traveling) return;

    this.previousStatus = this.currentStatus;
    this.currentStatus = TravelStatus.Paused;
    this.isPaused = true;

    globalEventBus.emit<StatusChangedPayload>('travel:statusChanged', {
      previousStatus: this.previousStatus,
      currentStatus: this.currentStatus,
      routeId: this.currentRouteId,
    });
  }

  /** 恢复旅行 */
  resumeTravel(): void {
    if (this.currentStatus !== TravelStatus.Paused) return;
    if (!this.travelResource.canTravel()) {
      globalEventBus.emit<TravelAutoPausedPayload>('travel:autoPaused', {
        reason: 'resources_still_exhausted',
        progress: this._progress,
        routeId: this.currentRouteId,
      });
      return;
    }

    this.previousStatus = this.currentStatus;
    this.currentStatus = TravelStatus.Traveling;
    this.isPaused = false;

    globalEventBus.emit<StatusChangedPayload>('travel:statusChanged', {
      previousStatus: this.previousStatus,
      currentStatus: this.currentStatus,
      routeId: this.currentRouteId,
    });
  }

  /** 完成旅行（抵达终点） */
  completeTravel(): void {
    if (this.currentStatus !== TravelStatus.Traveling) return;

    this._progress = 1;
    this.previousStatus = this.currentStatus;
    this.currentStatus = TravelStatus.Arrived;

    const rewards = this.calculateRewards();
    const totalMileage = this.mileageManager.totalMileageValue;
    const sessionMileage = this.mileageManager.sessionMileageValue;

    globalEventBus.emit<TravelCompletedPayload>('travel:completed', {
      routeId: this.currentRouteId ?? '',
      rewards,
      totalMileage,
      sessionMileage,
    });

    globalEventBus.emit<StatusChangedPayload>('travel:statusChanged', {
      previousStatus: this.previousStatus,
      currentStatus: this.currentStatus,
      routeId: this.currentRouteId,
    });
  }

  /** 结算旅行（领取奖励，回到 Idle） */
  settleTravel(rewards: TravelRewards): boolean {
    if (this.currentStatus !== TravelStatus.Arrived) return false;

    // 此处仅做状态切换；实际发放奖励由外部系统处理
    this.clearTravelState();

    globalEventBus.emit<StatusChangedPayload>('travel:statusChanged', {
      previousStatus: TravelStatus.Arrived,
      currentStatus: TravelStatus.Idle,
      routeId: null,
    });

    return true;
  }

  /** 中止旅行（放弃行程） */
  abortTravel(): void {
    if (
      this.currentStatus !== TravelStatus.Traveling &&
      this.currentStatus !== TravelStatus.Paused
    ) {
      return;
    }

    const wasStatus = this.currentStatus;
    this.clearTravelState();

    globalEventBus.emit<StatusChangedPayload>('travel:statusChanged', {
      previousStatus: wasStatus,
      currentStatus: TravelStatus.Idle,
      routeId: null,
    });
  }

  /** 进入聚落节点（城市/市场） */
  enterSettlement(): void {
    if (this.currentStatus !== TravelStatus.Traveling) return;

    this.previousStatus = this.currentStatus;
    this.currentStatus = TravelStatus.InSettlement;

    globalEventBus.emit<StatusChangedPayload>('travel:statusChanged', {
      previousStatus: this.previousStatus,
      currentStatus: this.currentStatus,
      routeId: this.currentRouteId,
    });
  }

  /** 离开聚落，继续旅行 */
  leaveSettlement(): void {
    if (this.currentStatus !== TravelStatus.InSettlement) return;

    this.previousStatus = this.currentStatus;
    this.currentStatus = TravelStatus.Traveling;

    globalEventBus.emit<StatusChangedPayload>('travel:statusChanged', {
      previousStatus: this.previousStatus,
      currentStatus: this.currentStatus,
      routeId: this.currentRouteId,
    });
  }

  /** 激活事件 */
  private enterEventActive(): void {
    this.previousStatus = this.currentStatus;
    this.currentStatus = TravelStatus.EventActive;

    globalEventBus.emit<StatusChangedPayload>('travel:statusChanged', {
      previousStatus: this.previousStatus,
      currentStatus: this.currentStatus,
      routeId: this.currentRouteId,
    });
  }

  /** 解决一个事件（玩家做出选择后调用） */
  resolveEvent(event: TravelEvent, choiceIndex: number): EventOutcome {
    if (this.currentStatus !== TravelStatus.EventActive) return {};

    const outcomes = this.routeEventController.resolveChoice(event, choiceIndex);

    // 应用事件结果到资源
    this.applyEventOutcomes(outcomes);

    this.previousStatus = this.currentStatus;
    this.currentStatus = TravelStatus.Traveling;

    globalEventBus.emit<StatusChangedPayload>('travel:statusChanged', {
      previousStatus: this.previousStatus,
      currentStatus: this.currentStatus,
      routeId: this.currentRouteId,
    });

    return { ...outcomes };
  }

  // ==================== Tick ====================

  tick(deltaSeconds: number): void {
    // 始终 tick 资源（旅行中消耗，空闲中恢复）
    const resource = this.travelResource;
    const isActivelyTraveling = this.currentStatus === TravelStatus.Traveling;
    resource.setTraveling(isActivelyTraveling);
    resource.tick(deltaSeconds);

    // 非旅行/暂停状态不继续处理
    if (this.currentStatus !== TravelStatus.Traveling) return;

    // 检查是否资源耗尽 → 自动暂停
    if (!resource.canTravel()) {
      this.pauseTravel();
      globalEventBus.emit<TravelAutoPausedPayload>('travel:autoPaused', {
        reason: resource.isExhausted() ? 'exhausted' : 'no_food',
        progress: this._progress,
        routeId: this.currentRouteId,
      });
      return;
    }

    const route = this.currentRoute;
    if (!route) return;

    // 计算速度倍率
    const morale = resource.morale;
    let moraleSpeedMultiplier = MORALE_NORMAL_MULTIPLIER;
    if (morale > MORALE_HIGH_THRESHOLD) {
      moraleSpeedMultiplier = MORALE_HIGH_MULTIPLIER;
    } else if (morale >= MORALE_MID_THRESHOLD) {
      moraleSpeedMultiplier = MORALE_NORMAL_MULTIPLIER;
    } else if (morale >= MORALE_LOW_THRESHOLD) {
      moraleSpeedMultiplier = MORALE_LOW_MULTIPLIER;
    } else {
      moraleSpeedMultiplier = MORALE_CRITICAL_MULTIPLIER;
    }

    const totalSpeedMultiplier = TRAVEL_BASE_SPEED * route.speedMultiplier * moraleSpeedMultiplier;

    // 计算里程增益和进度
    const mileageGain = deltaSeconds * totalSpeedMultiplier * BASE_MILEAGE_RATE;
    this._progress = clamp(
      this._progress + mileageGain / route.totalLength,
      0,
      1,
    );

    // 追踪里程
    this.mileageManager.trackMileage(deltaSeconds, totalSpeedMultiplier);

    // 里程宝箱掉落检查
    this.dropEngine.checkChestReward(
      this.mileageManager.totalMileageValue,
      this.mileageManager.sessionMileageValue,
    );

    // 检查节点到达（可能一次 tick 到达多个节点）
    this.checkAndHandleNodes();

    // 旅途物品掉落检查（每 30 秒 / 按进度概率）
    const routeDifficulty = this.getRouteDifficulty(route);
    this.dropEngine.tickTravelDrop(deltaSeconds, this._progress, routeDifficulty);

    // 发送进度事件
    globalEventBus.emit<TravelProgressPayload>('travel:progress', {
      progress: this._progress,
      routeId: this.currentRouteId,
      speedMultiplier: totalSpeedMultiplier,
      nodesVisited: this.nodesVisited,
      totalNodes: this.routeEventController.nodes.length,
    });

    // 检查是否完成
    if (this._progress >= 1) {
      this.completeTravel();
    }
  }

  // ==================== 节点处理 ====================

  private checkAndHandleNodes(): void {
    // 持续检查，直到没有更多未到达的节点
    for (;;) {
      const node = this.routeEventController.checkNodeReached(this._progress);
      if (!node) break;
      this.handleNodeArrival(node);
    }
  }

  private handleNodeArrival(node: RouteNode): void {
    this.nodesVisited++;

    // 发送节点到达事件
    globalEventBus.emit<NodeReachedPayload>('travel:nodeReached', {
      node,
      routeId: this.currentRouteId ?? '',
      progress: this._progress,
    });

    // 根据节点类型处理
    switch (node.type) {
      case RouteNodeType.Start:
        // 起点——不需要额外处理
        break;

      case RouteNodeType.City:
      case RouteNodeType.Market:
        this.enterSettlement();
        break;

      case RouteNodeType.Wilderness:
      case RouteNodeType.Dungeon:
      case RouteNodeType.Boss:
      case RouteNodeType.EventPoint: {
        const event = this.routeEventController.generateEventForNode(node);
        this.enterEventActive();
        globalEventBus.emit<EventTriggeredPayload>('travel:eventTriggered', {
          event,
          node,
          routeId: this.currentRouteId ?? '',
        });
        break;
      }

      case RouteNodeType.End:
        // 终点由 completeTravel 处理
        break;
    }
  }

  // ==================== 奖励计算 ====================

  private calculateRewards(): TravelRewards {
    const route = this.currentRoute;
    if (!route) return { gold: 0, exp: 0, gems: 0 };

    const morale = this.travelResource.morale;
    let moraleRewardMultiplier = MORALE_REWARD_LOW;
    if (morale > MORALE_HIGH_THRESHOLD) {
      moraleRewardMultiplier = MORALE_REWARD_HIGH;
    } else if (morale >= MORALE_MID_THRESHOLD) {
      moraleRewardMultiplier = MORALE_REWARD_MID;
    } else if (morale >= MORALE_LOW_THRESHOLD) {
      moraleRewardMultiplier = MORALE_REWARD_LOW;
    } else {
      moraleRewardMultiplier = MORALE_REWARD_CRITICAL;
    }

    return {
      gold: Math.floor(route.totalLength * COMPLETION_GOLD_PER_KM * moraleRewardMultiplier),
      exp: Math.floor(route.totalLength * COMPLETION_EXP_PER_KM * moraleRewardMultiplier),
      gems: Math.floor(COMPLETION_GEMS_FIXED * moraleRewardMultiplier),
    };
  }

  // ==================== 工具方法 ====================

  /** 获取路线难度等级（1~5，用于掉落概率计算） */
  private getRouteDifficulty(route: RouteDefinition): number {
    if (route.levelRequirement <= 1) return 1;
    if (route.levelRequirement <= 5) return 2;
    if (route.levelRequirement <= 10) return 3;
    if (route.levelRequirement <= 20) return 4;
    return 5;
  }

  private applyEventOutcomes(outcomes: EventOutcome): void {
    const resource = this.travelResource;

    if (outcomes.stamina !== undefined) {
      if (outcomes.stamina >= 0) {
        resource.addStamina(outcomes.stamina);
      } else {
        resource.consumeStamina(-outcomes.stamina);
      }
    }

    if (outcomes.food !== undefined) {
      if (outcomes.food >= 0) {
        resource.addFood(outcomes.food);
      } else {
        resource.consumeFood(-outcomes.food);
      }
    }

    if (outcomes.morale !== undefined) {
      resource.changeMorale(outcomes.morale);
    }

    // 事件中带物品奖励：触发物品掉落
    if (outcomes.itemId) {
      this.dropEngine.addEventItemReward(outcomes.itemId);
    }

    // gold/exp/item 结果由外部监听 travel:choiceResolved 处理
  }

  private clearTravelState(): void {
    this.currentStatus = TravelStatus.Idle;
    this._progress = 0;
    this.currentRouteId = null;
    this.nodesVisited = 0;
    this.isPaused = false;
    this.routeEventController.clearRoute();
  }

  private registerDefaultRoutes(): void {
    for (const route of DEFAULT_ROUTES) {
      this.routeRegistry.set(route.routeId, route);
    }
  }

  // ==================== IModule 接口 ====================

  onSave(): SaveData {
    return {
      currentStatus: this.currentStatus,
      progress: this._progress,
      currentRouteId: this.currentRouteId,
      nodesVisited: this.nodesVisited,
      isPaused: this.isPaused,
    };
  }

  onLoad(data: SaveData): void {
    const d = data as unknown as TravelSaveData;
    this.currentStatus = d.currentStatus ?? TravelStatus.Idle;
    this._progress = d.progress ?? 0;
    this.currentRouteId = d.currentRouteId ?? null;
    this.nodesVisited = d.nodesVisited ?? 0;
    this.isPaused = d.isPaused ?? false;
  }

  reset(): void {
    this.clearTravelState();
  }
}

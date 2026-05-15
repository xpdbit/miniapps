/**
 * TaskEngine — 每日/每周任务系统引擎
 *
 * 单例，实现 IModule 接口，管理日常任务生成/进度追踪/奖励领取。
 * - 每日任务：从 7 个预定义中随机选 3 个
 * - 每周任务：从 7 个预定义中随机选 5 个
 * - 自动跨日/跨周刷新
 *
 * 监听游戏事件自动检查任务进度：
 *   'combat:end' | 'mileage:updated' | 'mileage:chest' | 'skill:learned' |
 *   'skill:used' | 'team:memberJoined' | 'equipment:changed' | 'card:drawn'
 *
 * 发出事件：'task:progress' | 'task:completed' | 'task:claimed'
 */

import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';

// ---------------------------------------------------------------------------
// 事件载荷类型
// ---------------------------------------------------------------------------

export interface TaskProgressEvent {
  taskId: string;
  current: number;
  target: number;
}

export interface TaskCompletedEvent {
  taskId: string;
  task: GameTask;
}

export interface TaskClaimedEvent {
  taskId: string;
  reward: TaskReward;
}

// ---------------------------------------------------------------------------
// 核心类型
// ---------------------------------------------------------------------------

export enum TaskType {
  Daily = 'Daily',
  Weekly = 'Weekly',
}

export interface TaskObjective {
  /** 监听的事件名 */
  event: string;
  /** 达成目标值 */
  target: number;
  /** 当前进度值 */
  current: number;
}

export interface TaskReward {
  gold?: number;
  exp?: number;
  gems?: number;
}

export interface GameTask {
  id: string;
  type: TaskType;
  name: string;
  description: string;
  icon: string;
  objective: TaskObjective;
  reward: TaskReward;
  expiresAt: number;
  isCompleted: boolean;
  isClaimed: boolean;
}

// ---------------------------------------------------------------------------
// 存档接口
// ---------------------------------------------------------------------------

interface TaskSaveEntry {
  id: string;
  type: TaskType;
  name: string;
  description: string;
  icon: string;
  objective: { event: string; target: number; current: number };
  reward: TaskReward;
  expiresAt: number;
  isCompleted: boolean;
  isClaimed: boolean;
}

interface TaskEngineSaveData {
  dailyTasks: TaskSaveEntry[];
  weeklyTasks: TaskSaveEntry[];
  lastDailyRefresh: number;
  lastWeeklyRefresh: number;
}

// ---------------------------------------------------------------------------
// 任务定义
// ---------------------------------------------------------------------------

interface TaskDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  objectiveEvent: string;
  objectiveTarget: number;
  reward: TaskReward;
}

const DAILY_DEFINITIONS: TaskDefinition[] = [
  {
    id: 'daily_combat_3wins',
    name: '战斗训练',
    description: '赢得 3 场战斗',
    icon: '⚔️',
    objectiveEvent: 'combat:end',
    objectiveTarget: 3,
    reward: { gold: 100, exp: 50 },
  },
  {
    id: 'daily_gold_500',
    name: '小小财富',
    description: '收集 500 金币',
    icon: '🪙',
    objectiveEvent: 'collect_gold',
    objectiveTarget: 500,
    reward: { gold: 200 },
  },
  {
    id: 'daily_skill_10',
    name: '技能练习',
    description: '使用 10 次技能',
    icon: '✨',
    objectiveEvent: 'skill:used',
    objectiveTarget: 10,
    reward: { exp: 100 },
  },
  {
    id: 'daily_chest_3',
    name: '宝箱开启',
    description: '开启 3 个宝箱',
    icon: '📦',
    objectiveEvent: 'mileage:chest',
    objectiveTarget: 3,
    reward: { gems: 10 },
  },
  {
    id: 'daily_equip_2',
    name: '装备管理',
    description: '装备 2 件装备',
    icon: '🛡️',
    objectiveEvent: 'equipment:changed',
    objectiveTarget: 2,
    reward: { gold: 80 },
  },
  {
    id: 'daily_recruit_1',
    name: '招募队友',
    description: '招募 1 名队友',
    icon: '👥',
    objectiveEvent: 'team:memberJoined',
    objectiveTarget: 1,
    reward: { gold: 150 },
  },
  {
    id: 'daily_learn_2',
    name: '学习技能',
    description: '学会 2 个技能',
    icon: '📖',
    objectiveEvent: 'skill:learned',
    objectiveTarget: 2,
    reward: { exp: 80 },
  },
];

const WEEKLY_DEFINITIONS: TaskDefinition[] = [
  {
    id: 'weekly_combat_20',
    name: '征战四方',
    description: '赢得 20 场战斗',
    icon: '⚔️',
    objectiveEvent: 'combat:end',
    objectiveTarget: 20,
    reward: { gold: 500, exp: 300 },
  },
  {
    id: 'weekly_gold_5000',
    name: '财富积累',
    description: '收集 5000 金币',
    icon: '💰',
    objectiveEvent: 'collect_gold',
    objectiveTarget: 5000,
    reward: { gems: 50 },
  },
  {
    id: 'weekly_chest_10',
    name: '宝箱收集',
    description: '开启 10 个宝箱',
    icon: '📦',
    objectiveEvent: 'mileage:chest',
    objectiveTarget: 10,
    reward: { gold: 300, gems: 30 },
  },
  {
    id: 'weekly_skill_50',
    name: '技能大师',
    description: '使用 50 次技能',
    icon: '🔮',
    objectiveEvent: 'skill:used',
    objectiveTarget: 50,
    reward: { exp: 500 },
  },
  {
    id: 'weekly_travel_500',
    name: '长途旅行',
    description: '旅行累计 500 km',
    icon: '🧭',
    objectiveEvent: 'mileage:updated',
    objectiveTarget: 500,
    reward: { gold: 800, exp: 400 },
  },
  {
    id: 'weekly_learn_5',
    name: '博学多才',
    description: '学会 5 个技能',
    icon: '📚',
    objectiveEvent: 'skill:learned',
    objectiveTarget: 5,
    reward: { gems: 40 },
  },
  {
    id: 'weekly_card_10',
    name: '卡牌收集',
    description: '抽取 10 张卡牌',
    icon: '🃏',
    objectiveEvent: 'card:drawn',
    objectiveTarget: 10,
    reward: { gems: 60 },
  },
];

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

const DAILY_PICK_COUNT = 3;
const WEEKLY_PICK_COUNT = 5;

/** 获取当天 0 时时间戳 */
function getDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** 获取本周一 0 时时间戳 */
function getWeekStart(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? 6 : day - 1; // Monday = 0 offset
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** 从数组中随机选取 n 个不重复元素（Fisher-Yates 部分洗牌） */
function pickRandom<T>(arr: readonly T[], n: number): T[] {
  const pool = [...arr];
  const result: T[] = [];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * (pool.length - i)) + i;
    // 交换选中的元素到当前 i 位置
    [pool[i], pool[idx]] = [pool[idx]!, pool[i]!];
    result.push(pool[i]!);
  }
  return result;
}

/** 从 TaskDefinition 创建 GameTask 实例 */
function createTaskFromDefinition(
  def: TaskDefinition,
  type: TaskType,
  expiresAt: number,
): GameTask {
  return {
    id: def.id,
    type,
    name: def.name,
    description: def.description,
    icon: def.icon,
    objective: { event: def.objectiveEvent, target: def.objectiveTarget, current: 0 },
    reward: { ...def.reward },
    expiresAt,
    isCompleted: false,
    isClaimed: false,
  };
}

// ---------------------------------------------------------------------------
// TaskEngine
// ---------------------------------------------------------------------------

export class TaskEngine implements IModule {
  readonly moduleId = 'task';

  // ---- 单例 ----
  private static _instance: TaskEngine;
  static get instance(): TaskEngine {
    if (!TaskEngine._instance) {
      TaskEngine._instance = new TaskEngine();
    }
    return TaskEngine._instance;
  }

  // ---- 状态 ----
  private dailyTasks: GameTask[] = [];
  private weeklyTasks: GameTask[] = [];
  private lastDailyRefresh = 0;
  private lastWeeklyRefresh = 0;
  private initialized = false;

  // ---- 已注册的事件绑定（用于清理） ----
  private boundHandlers: Array<{ event: string; handler: (data: unknown) => void }> = [];

  // ---- 私有构造 ----
  private constructor() {}

  // ========================================================================
  //  初始化
  // ========================================================================

  /** 初始化任务引擎：生成首次任务并注册事件监听 */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    const now = Date.now();

    // 首次生成
    if (this.dailyTasks.length === 0) {
      this.generateDailyTasks(now);
      this.lastDailyRefresh = getDayStart(now);
    }

    if (this.weeklyTasks.length === 0) {
      this.generateWeeklyTasks(now);
      this.lastWeeklyRefresh = getWeekStart(now);
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
  //  任务生成 / 刷新
  // ========================================================================

  /** 生成 3 个随机每日任务 */
  generateDailyTasks(now: number): void {
    const picked = pickRandom(DAILY_DEFINITIONS, DAILY_PICK_COUNT);
    const endOfDay = getDayStart(now) + 24 * 60 * 60 * 1000 - 1;
    this.dailyTasks = picked.map((def) =>
      createTaskFromDefinition(def, TaskType.Daily, endOfDay),
    );
  }

  /** 生成 5 个随机每周任务 */
  generateWeeklyTasks(now: number): void {
    const picked = pickRandom(WEEKLY_DEFINITIONS, WEEKLY_PICK_COUNT);
    const endOfWeek = getWeekStart(now) + 7 * 24 * 60 * 60 * 1000 - 1;
    this.weeklyTasks = picked.map((def) =>
      createTaskFromDefinition(def, TaskType.Weekly, endOfWeek),
    );
  }

  /** 检查并刷新每日任务（跨日时自动刷新） */
  refreshDaily(): void {
    const now = Date.now();
    const todayStart = getDayStart(now);

    if (todayStart > this.lastDailyRefresh) {
      this.generateDailyTasks(now);
      this.lastDailyRefresh = todayStart;
    }
  }

  /** 检查并刷新每周任务（跨周时自动刷新） */
  refreshWeekly(): void {
    const now = Date.now();
    const weekStart = getWeekStart(now);

    if (weekStart > this.lastWeeklyRefresh) {
      this.generateWeeklyTasks(now);
      this.lastWeeklyRefresh = weekStart;
    }
  }

  // ========================================================================
  //  进度检查
  // ========================================================================

  /**
   * 检查所有活跃任务的进度
   * @param event 事件名
   * @param data 事件载荷
   */
  checkProgress(event: string, data: unknown): void {
    this.refreshDaily();
    this.refreshWeekly();

    // 收集该事件贡献的金币/宝石量（用于 collect_gold / collect_gems 合成事件）
    let goldEarned = 0;
    let gemsEarned = 0;

    switch (event) {
      case 'combat:end': {
        const payload = data as { status: string; reward: { gold: number; exp: number } };
        if (payload.status !== 'Victory') return;
        goldEarned = payload.reward.gold;
        this.advanceTasks('combat:end', 1);
        break;
      }

      case 'mileage:chest': {
        // 宝箱不携带 gems，但携带 gold
        const payload = data as { rewards: { gold: number } };
        goldEarned = payload.rewards.gold;
        this.advanceTasks('mileage:chest', 1);
        break;
      }

      case 'mileage:updated': {
        // mileage 是绝对值，设置为 current
        const payload = data as { totalMileage: number };
        const mileage = Math.floor(payload.totalMileage);
        this.setTasksValue('mileage:updated', mileage);
        break;
      }

      case 'skill:used': {
        const payload = data as { success: boolean };
        if (payload.success === false) return;
        this.advanceTasks('skill:used', 1);
        break;
      }

      case 'skill:learned':
        this.advanceTasks('skill:learned', 1);
        break;

      case 'team:memberJoined':
        this.advanceTasks('team:memberJoined', 1);
        break;

      case 'equipment:changed':
        this.advanceTasks('equipment:changed', 1);
        break;

      case 'card:drawn':
        this.advanceTasks('card:drawn', 1);
        break;

      default:
        break;
    }

    // 更新 collect_gold 任务
    if (goldEarned > 0) {
      this.advanceTasks('collect_gold', goldEarned);
    }

    if (gemsEarned > 0) {
      this.advanceTasks('collect_gems', gemsEarned);
    }
  }

  /**
   * 推进匹配事件的所有未完成任务进度
   * @param objectiveEvent 目标事件名
   * @param amount 推进量
   */
  private advanceTasks(objectiveEvent: string, amount: number): void {
    const tasks = this.getActiveTasks().filter(
      (t) => !t.isCompleted && !t.isClaimed && t.objective.event === objectiveEvent,
    );

    for (const task of tasks) {
      task.objective.current += amount;
      this.checkTaskCompletion(task);
    }
  }

  /**
   * 设置匹配事件的所有未完成任务为指定值（用于绝对值事件）
   * @param objectiveEvent 目标事件名
   * @param value 设定值
   */
  private setTasksValue(objectiveEvent: string, value: number): void {
    const tasks = this.getActiveTasks().filter(
      (t) => !t.isCompleted && !t.isClaimed && t.objective.event === objectiveEvent,
    );

    for (const task of tasks) {
      task.objective.current = Math.min(value, task.objective.target);
      this.checkTaskCompletion(task);
    }
  }

  /** 检查单个任务是否完成 */
  private checkTaskCompletion(task: GameTask): void {
    if (task.isCompleted) return;

    globalEventBus.emit<TaskProgressEvent>('task:progress', {
      taskId: task.id,
      current: task.objective.current,
      target: task.objective.target,
    });

    if (task.objective.current >= task.objective.target) {
      task.isCompleted = true;

      globalEventBus.emit<TaskCompletedEvent>('task:completed', {
        taskId: task.id,
        task: { ...task },
      });
    }
  }

  // ========================================================================
  //  奖励领取
  // ========================================================================

  /**
   * 领取任务奖励
   * @param taskId 任务 ID
   * @returns 是否领取成功
   */
  claimReward(taskId: string): boolean {
    const task = this.findTaskById(taskId);
    if (!task) return false;
    if (!task.isCompleted || task.isClaimed) return false;

    task.isClaimed = true;

    globalEventBus.emit<TaskClaimedEvent>('task:claimed', {
      taskId: task.id,
      reward: { ...task.reward },
    });

    return true;
  }

  // ========================================================================
  //  查询
  // ========================================================================

  /** 获取指定任务 */
  getTask(taskId: string): GameTask | undefined {
    return this.findTaskById(taskId);
  }

  /** 获取活跃任务（可选按类型筛选） */
  getActiveTasks(type?: TaskType): GameTask[] {
    let tasks: GameTask[];
    if (type === TaskType.Daily) {
      tasks = this.dailyTasks;
    } else if (type === TaskType.Weekly) {
      tasks = this.weeklyTasks;
    } else {
      tasks = [...this.dailyTasks, ...this.weeklyTasks];
    }
    return tasks.map((t) => ({ ...t }));
  }

  /** 获取指定类型中已完成但未领取的任务 */
  getCompletedTasks(type?: TaskType): GameTask[] {
    return this.getActiveTasks(type).filter((t) => t.isCompleted && !t.isClaimed);
  }

  /** 获取已领取的任务 */
  getClaimedTasks(type?: TaskType): GameTask[] {
    return this.getActiveTasks(type).filter((t) => t.isClaimed);
  }

  /** 获取每日任务的总体进度信息 */
  getDailyProgress(): { completed: number; total: number; percent: number } {
    const total = this.dailyTasks.length;
    const completed = this.dailyTasks.filter((t) => t.isCompleted).length;
    return {
      completed,
      total,
      percent: total > 0 ? Math.floor((completed / total) * 100) : 0,
    };
  }

  /** 获取每周任务的总体进度信息 */
  getWeeklyProgress(): { completed: number; total: number; percent: number } {
    const total = this.weeklyTasks.length;
    const completed = this.weeklyTasks.filter((t) => t.isCompleted).length;
    return {
      completed,
      total,
      percent: total > 0 ? Math.floor((completed / total) * 100) : 0,
    };
  }

  // ========================================================================
  //  内部工具
  // ========================================================================

  /** 按 ID 查找任务（不返回副本，直接引用内部数组） */
  private findTaskById(taskId: string): GameTask | undefined {
    return (
      this.dailyTasks.find((t) => t.id === taskId) ??
      this.weeklyTasks.find((t) => t.id === taskId)
    );
  }

  /** 序列化任务到存档格式 */
  private serializeTasks(tasks: GameTask[]): TaskSaveEntry[] {
    return tasks.map((t) => ({
      id: t.id,
      type: t.type,
      name: t.name,
      description: t.description,
      icon: t.icon,
      objective: { ...t.objective },
      reward: { ...t.reward },
      expiresAt: t.expiresAt,
      isCompleted: t.isCompleted,
      isClaimed: t.isClaimed,
    }));
  }

  /** 从存档格式反序列化 */
  private deserializeTasks(entries: TaskSaveEntry[]): GameTask[] {
    return entries.map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      description: e.description,
      icon: e.icon,
      objective: { ...e.objective },
      reward: { ...e.reward },
      expiresAt: e.expiresAt,
      isCompleted: e.isCompleted,
      isClaimed: e.isClaimed,
    }));
  }

  // ========================================================================
  //  IModule
  // ========================================================================

  tick(_deltaSeconds: number): void {
    // 任务引擎每 tick 检查是否需要跨日/跨周刷新
    this.refreshDaily();
    this.refreshWeekly();
  }

  onSave(): SaveData {
    const data: TaskEngineSaveData = {
      dailyTasks: this.serializeTasks(this.dailyTasks),
      weeklyTasks: this.serializeTasks(this.weeklyTasks),
      lastDailyRefresh: this.lastDailyRefresh,
      lastWeeklyRefresh: this.lastWeeklyRefresh,
    };
    return data as unknown as SaveData;
  }

  onLoad(data: SaveData): void {
    const save = data as unknown as TaskEngineSaveData;

    this.dailyTasks = save.dailyTasks ? this.deserializeTasks(save.dailyTasks) : [];
    this.weeklyTasks = save.weeklyTasks ? this.deserializeTasks(save.weeklyTasks) : [];
    this.lastDailyRefresh = save.lastDailyRefresh ?? 0;
    this.lastWeeklyRefresh = save.lastWeeklyRefresh ?? 0;

    // 注册事件监听
    if (!this.initialized) {
      this.initialized = true;
      this.registerEventListeners();
    }

    // 检查是否需要刷新
    this.refreshDaily();
    this.refreshWeekly();
  }

  reset(): void {
    this.dailyTasks = [];
    this.weeklyTasks = [];
    this.lastDailyRefresh = 0;
    this.lastWeeklyRefresh = 0;
    this.initialized = false;

    // 移除事件监听
    for (const { event, handler } of this.boundHandlers) {
      globalEventBus.off(event, handler);
    }
    this.boundHandlers = [];
  }
}

/** 全局单例 */
export const taskEngine = TaskEngine.instance;

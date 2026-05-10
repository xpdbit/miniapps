/**
 * achievement — 成就 & 任务系统
 *
 * 包含 AchievementEngine（成就追踪/解锁）和 TaskEngine（每日/每周任务）。
 * 两者均实现 IModule 接口，作为单例运行，通过 EventBus 监听游戏事件。
 */

export { AchievementEngine, achievementEngine } from './AchievementEngine';
export type {
  Achievement,
  AchievementCategory,
  AchievementCondition,
  AchievementReward,
  AchievementUnlockedEvent,
} from './AchievementEngine';

export { TaskEngine, taskEngine, TaskType } from './TaskEngine';
export type {
  GameTask,
  TaskObjective,
  TaskReward,
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskClaimedEvent,
} from './TaskEngine';

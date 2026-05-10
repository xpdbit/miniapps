// Core
export { GameLoop, type ITickable } from './core/GameLoop';
export { EventBus, globalEventBus } from './core/EventBus';
export { SaveManager, saveManager, type SaveData, SAVE_KEYS } from './core/SaveManager';
export { TimeManager } from './core/TimeManager';
export { TextManager, textManager } from './core/TextManager';

// Actor
export type { IModule } from './actor/IModule';
export type { SaveData as ModuleSaveData } from './actor/IModule';
export { PlayerActor, type PlayerSaveData } from './actor/PlayerActor';
export { ActorTemplateManager, actorTemplateManager } from './actor/ActorTemplate';
export type { ActorTemplate } from './actor/ActorTemplate';

// Travel
export { TravelEngine } from './travel/TravelEngine';
export { TravelResource } from './travel/TravelResource';
export { MileageManager } from './travel/MileageManager';
export { RouteEventController } from './travel/RouteEventController';

// Combat
export { CombatEngine } from './combat/CombatEngine';
export { CombatStateMachine } from './combat/CombatStateMachine';
export { DamageCalculator } from './combat/DamageCalculator';

// Team
export { TeamEngine } from './team/TeamEngine';
export { JobSystem } from './team/JobSystem';

// Inventory
export { InventoryEngine } from './inventory/InventoryEngine';
export { EquipmentSystem } from './inventory/EquipmentSystem';
export { itemRegistry, type ItemTemplate, type ItemType, type ItemRarity } from './inventory/ItemRegistry';
export { DropEngine, dropEngine, type ItemDroppedPayload, type ChestRewardPayload } from './inventory/DropEngine';

// Skill
export { SkillEngine } from './skill/SkillEngine';
export type { Skill, SkillEffect, SkillResult, EquipSlot } from './skill/SkillData';
export { SkillType, SkillTarget } from './skill/SkillData';

// Card
export { CardEngine } from './card/CardEngine';

// Achievement
export { AchievementEngine, achievementEngine } from './achievement/AchievementEngine';
export { TaskEngine, taskEngine, TaskType } from './achievement/TaskEngine';
export type {
  Achievement,
  AchievementCategory,
  AchievementCondition,
  AchievementReward,
  AchievementUnlockedEvent,
  GameTask,
  TaskObjective,
  TaskReward,
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskClaimedEvent,
} from './achievement';

// Event
export { EventChainEngine } from './event/EventChainEngine';
export { EventTreeEngine } from './event/EventTreeEngine';
export { PendingEventEngine } from './event/PendingEventEngine';

// Prestige
export { PrestigeEngine, prestigeEngine } from './prestige/PrestigeEngine';

// Idle
export { IdleRewardEngine, idleRewardEngine } from './idle/IdleRewardEngine';

// Pet
export { PetEngine } from './pet/PetEngine';

// Activity
export { ActivityEngine } from './activity/ActivityEngine';

// Race
export { RaceEngine } from './race/RaceEngine';

// PVP
export { PvpEngine } from './pvp/PvpEngine';

// Map
export { RegionGenerator } from './map/RegionGenerator';

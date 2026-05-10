/**
 * combat — 战斗系统入口
 *
 * 统一导出 combat 模块的所有公开类型和类。
 */

// CombatEngine
export { CombatEngine } from './CombatEngine';
export { CombatStatus } from './CombatEngine';
export type {
  ICombatant,
  ICombatSkill,
  CombatLogEntry,
  CombatReward,
  CombatState,
  CombatStartEvent,
  CombatActionEvent,
  CombatEndEvent,
  CombatTickEvent,
  CombatEngineSaveData,
} from './CombatEngine';

// CombatStateMachine
export { CombatStateMachine } from './CombatStateMachine';
export { CombatPhase } from './CombatStateMachine';
export type { CombatCallbacks, CombatPhaseResult } from './CombatStateMachine';

// DamageCalculator
export {
  DamageCalculator,
  calculateDamage,
  calculateCrit,
  calculateDodge,
  calculateDefenseReduction,
  linearDefenseReduction,
} from './DamageCalculator';
export type { DamageResult, CritResult } from './DamageCalculator';

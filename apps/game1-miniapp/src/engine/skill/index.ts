/**
 * skill — 技能系统模块入口
 */

export {
  SkillEngine,
  skillEngine,
  MAX_EQUIP,
} from './SkillEngine';

export {
  SkillType,
  SkillTarget,
  CardRarity,
  EQUIP_SLOTS,
  slotToSkillType,
  slotIndex,
  getAllSkillDefinitions,
  getSkillDefinition,
  skillPowerAtLevel,
  effectValueAtLevel,
} from './SkillData';

export type {
  Skill,
  SkillEffect,
  SkillEffectType,
  SkillStat,
  CombatStats,
  SkillEffectResult,
  SkillResult,
  EquipSlot,
  SkillEngineSaveData,
} from './SkillData';

export type { SaveData } from '../actor/IModule';

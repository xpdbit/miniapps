import { clamp } from '../../utils/math';

/**
 * 职业枚举
 * - Merchant: 商贾 — 精于贸易，获得更好的交易价格
 * - Guard: 镖师 — 擅长战斗，攻防兼备
 * - Scholar: 学者 — 博学多识，更容易触发事件
 * - Healer: 医者 — 救死扶伤，提升队伍恢复能力
 */
export enum Job {
  Merchant = 'merchant',
  Guard = 'guard',
  Scholar = 'scholar',
  Healer = 'healer',
}

/** 职业的中文显示名 */
export const JOB_NAMES: Record<Job, string> = {
  [Job.Merchant]: '商贾',
  [Job.Guard]: '镖师',
  [Job.Scholar]: '学者',
  [Job.Healer]: '医者',
};

/** 基础属性接口，用于 applyJobStats 输入 */
export interface BaseStats {
  attack: number;
  defense: number;
  speed: number;
}

/** 职业配置 */
export interface JobConfig {
  id: Job;
  name: string;
  description: string;
  /** 属性倍率 — 作用于基础属性 */
  statModifiers: {
    attack: number;
    defense: number;
    speed: number;
  };
  /** 特殊能力标识 */
  specialAbility: string;
  /** 该职业可学习的技能池 */
  skillPool: string[];
}

const JOB_CONFIGS: Record<Job, JobConfig> = {
  [Job.Merchant]: {
    id: Job.Merchant,
    name: '商贾',
    description: '精于贸易，能获得更好的交易价格',
    statModifiers: { attack: 0.8, defense: 0.8, speed: 1.0 },
    specialAbility: 'merchant_trade_bonus',
    skillPool: ['merchant_gift', 'bargain'],
  },
  [Job.Guard]: {
    id: Job.Guard,
    name: '镖师',
    description: '擅长战斗，攻防兼备',
    statModifiers: { attack: 1.15, defense: 1.15, speed: 0.9 },
    specialAbility: 'guard_damage_bonus',
    skillPool: ['shield_wall', 'tough_skin'],
  },
  [Job.Scholar]: {
    id: Job.Scholar,
    name: '学者',
    description: '博学多识，更容易触发事件',
    statModifiers: { attack: 0.7, defense: 0.7, speed: 1.1 },
    specialAbility: 'scholar_event_boost',
    skillPool: ['scholar_wisdom', 'precision'],
  },
  [Job.Healer]: {
    id: Job.Healer,
    name: '医者',
    description: '救死扶伤，提升队伍恢复能力',
    statModifiers: { attack: 0.6, defense: 0.9, speed: 1.0 },
    specialAbility: 'healer_regen_boost',
    skillPool: ['heal', 'vitality_boost'],
  },
};

/**
 * 获取指定职业的配置
 * @throws 如果职业 ID 无效
 */
export function getJobConfig(jobId: Job): JobConfig {
  const config = JOB_CONFIGS[jobId];
  if (!config) {
    throw new Error(`职业配置不存在: ${jobId}`);
  }
  return config;
}

/** 获取所有可用职业 */
export function getAvailableJobs(): JobConfig[] {
  return Object.values(JOB_CONFIGS);
}

/**
 * 将职业属性倍率应用到基础属性上
 * 返回 clamp 后的最终属性（最小值为 1）
 */
export function applyJobStats(baseStats: BaseStats, jobId: Job): Required<BaseStats> {
  const config = getJobConfig(jobId);
  return {
    attack: clamp(Math.floor(baseStats.attack * config.statModifiers.attack), 1, Infinity),
    defense: clamp(Math.floor(baseStats.defense * config.statModifiers.defense), 1, Infinity),
    speed: clamp(Math.floor(baseStats.speed * config.statModifiers.speed), 1, Infinity),
  };
}

/**
 * 兼容旧引用：Engine index.ts 期望的命名导出
 * 本质与模块级函数相同
 */
export const JobSystem = {
  getJobConfig,
  getAvailableJobs,
  applyJobStats,
  getConfigs: (): JobConfig[] => Object.values(JOB_CONFIGS),
};

import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';
import { clamp } from '../../utils/math';
import { Job, applyJobStats } from './JobSystem';
import constants from '../../config/constants.json';

// ---------------------------------------------------------------------------
// 事件载荷类型
// ---------------------------------------------------------------------------

export interface TeamMemberJoinedEvent {
  member: TeamMember;
}

export interface TeamMemberRemovedEvent {
  memberId: string;
}

export interface TeamMemberLevelUpEvent {
  memberId: string;
  newLevel: number;
  newAttack: number;
  newDefense: number;
  newSpeed: number;
}

export interface TeamMemberDiedEvent {
  memberId: string;
}

// ---------------------------------------------------------------------------
// 核心类型
// ---------------------------------------------------------------------------

export interface TeamMember {
  id: string;
  name: string;
  actorTemplateId: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  jobId: Job | null;
  skills: string[];
  /** slot → itemId，由 EquipmentSystem 管理 */
  equipment: Record<string, string | null>;
  exp: number;
}

export interface TeamState {
  members: TeamMember[];
  formation: string;
  /** 当前活跃队员在 members 数组中的索引，-1 表示无选中 */
  activeMemberIndex: number;
}

// ---------------------------------------------------------------------------
// 存档接口
// ---------------------------------------------------------------------------

interface TeamSaveData {
  members: TeamMember[];
  formation: string;
  activeMemberIndex: number;
  nextMemberId: number;
}

// ---------------------------------------------------------------------------
// TeamEngine
// ---------------------------------------------------------------------------

const TEAM_MAX_MEMBERS = constants.team.maxMembers ?? 4;
const PASSIVE_REGEN_RATIO = 0.001; // 每 tick 回复 0.1% maxHp（≈1%/10s）

export class TeamEngine implements IModule {
  readonly moduleId = 'TeamEngine';

  // ---- 单例 ----
  private static _instance: TeamEngine;
  static get instance(): TeamEngine {
    if (!TeamEngine._instance) {
      TeamEngine._instance = new TeamEngine();
    }
    return TeamEngine._instance;
  }

  // ---- 状态 ----
  /** 完整队员池（含阵亡） */
  private members: TeamMember[] = [];
  private formation = 'standard';
  private activeMemberIndex = -1;
  private nextMemberId = 1;

  // ---- 私有构造 ----
  private constructor() {}

  // ========================================================================
  //  公开只读访问
  // ========================================================================

  /** 当前队伍状态（浅拷贝快照） */
  getState(): TeamState {
    return {
      members: [...this.members],
      formation: this.formation,
      activeMemberIndex: this.activeMemberIndex,
    };
  }

  // ========================================================================
  //  队员 CRUD
  // ========================================================================

  /**
   * 招募新队员
   * @param templateId 角色模板 ID
   * @param name 可选自定义名称，缺省时从模板衍生
   * @param baseStats 基础属性（attack/defense/speed）
   * @returns 新增的队员
   * @throws 队伍已满
   */
  addMember(
    templateId: string,
    name: string,
    baseStats: { maxHp: number; attack: number; defense: number; speed: number },
  ): TeamMember {
    if (this.members.length >= TEAM_MAX_MEMBERS) {
      throw new Error(`队伍已满（上限 ${TEAM_MAX_MEMBERS}）`);
    }

    const memberId = `team_${this.nextMemberId++}`;
    const member: TeamMember = {
      id: memberId,
      name,
      actorTemplateId: templateId,
      level: 1,
      hp: baseStats.maxHp,
      maxHp: baseStats.maxHp,
      attack: baseStats.attack,
      defense: baseStats.defense,
      speed: baseStats.speed,
      jobId: null,
      skills: [],
      equipment: {},
      exp: 0,
    };

    this.members.push(member);
    globalEventBus.emit<TeamMemberJoinedEvent>('team:memberJoined', { member });

    return member;
  }

  /**
   * 移除队员
   * @param id 队员 ID
   * @throws 队员不存在
   */
  removeMember(id: string): void {
    const index = this.members.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error(`队员不存在: ${id}`);
    }

    this.members.splice(index, 1);

    // 调整 activeMemberIndex
    if (this.activeMemberIndex >= this.members.length) {
      this.activeMemberIndex = this.members.length - 1;
    } else if (index < this.activeMemberIndex) {
      this.activeMemberIndex -= 1;
    }

    globalEventBus.emit<TeamMemberRemovedEvent>('team:memberRemoved', { memberId: id });
  }

  /**
   * 获取指定队员（浅拷贝）
   */
  getMember(id: string): TeamMember | undefined {
    return this.members.find((m) => m.id === id);
  }

  /** 获取所有队员 */
  getAllMembers(): TeamMember[] {
    return [...this.members];
  }

  /** 获取存活的队员 */
  getActiveMembers(): TeamMember[] {
    return this.members.filter((m) => m.hp > 0);
  }

  /**
   * 队员升级
   * 提升等级并增长属性，满血
   */
  levelUpMember(
    id: string,
    growth: { hpPerLevel: number; attackPerLevel: number; defensePerLevel: number; speedPerLevel: number },
  ): void {
    const member = this.members.find((m) => m.id === id);
    if (!member) {
      throw new Error(`队员不存在: ${id}`);
    }

    member.level += 1;
    member.maxHp = Math.floor(member.maxHp + growth.hpPerLevel);
    member.hp = member.maxHp; // 升级满血
    member.attack = Math.floor(member.attack + growth.attackPerLevel);
    member.defense = Math.floor(member.defense + growth.defensePerLevel);
    member.speed = Math.floor(member.speed + growth.speedPerLevel);

    // 如果有职业，重新应用职业倍率
    if (member.jobId !== null) {
      const jobStats = applyJobStats(
        { attack: member.attack, defense: member.defense, speed: member.speed },
        member.jobId,
      );
      member.attack = jobStats.attack;
      member.defense = jobStats.defense;
      member.speed = jobStats.speed;
    }

    globalEventBus.emit<TeamMemberLevelUpEvent>('team:memberLevelUp', {
      memberId: id,
      newLevel: member.level,
      newAttack: member.attack,
      newDefense: member.defense,
      newSpeed: member.speed,
    });
  }

  /**
   * 为队员分配职业
   * 职业属性倍率会覆盖当前基础属性
   */
  assignJob(memberId: string, jobId: Job): void {
    const member = this.members.find((m) => m.id === memberId);
    if (!member) {
      throw new Error(`队员不存在: ${memberId}`);
    }

    member.jobId = jobId;

    const jobStats = applyJobStats(
      { attack: member.attack, defense: member.defense, speed: member.speed },
      jobId,
    );
    member.attack = jobStats.attack;
    member.defense = jobStats.defense;
    member.speed = jobStats.speed;
  }

  /** 治疗队员，不超过 maxHp */
  healMember(id: string, amount: number): void {
    const member = this.members.find((m) => m.id === id);
    if (!member) return;
    if (member.hp <= 0) return; // 阵亡不可治疗

    member.hp = clamp(member.hp + Math.floor(amount), 0, member.maxHp);
  }

  /** 伤害队员，最低为 0 */
  damageMember(id: string, amount: number): void {
    const member = this.members.find((m) => m.id === id);
    if (!member) return;
    if (member.hp <= 0) return;

    member.hp = clamp(member.hp - Math.floor(amount), 0, member.maxHp);

    if (member.hp <= 0) {
      globalEventBus.emit<TeamMemberDiedEvent>('team:memberDied', { memberId: id });
    }
  }

  /** 设置当前活跃队员索引 */
  setActiveMemberIndex(index: number): void {
    if (index < -1 || index >= this.members.length) {
      throw new Error(`无效的队员索引: ${index}`);
    }
    this.activeMemberIndex = index;
  }

  /** 设置阵型 */
  setFormation(formation: string): void {
    this.formation = formation;
  }

  // ========================================================================
  //  IModule
  // ========================================================================

  /**
   * tick 逻辑：存活队员被动回复 HP
   * 每 tick 回复 0.1% maxHp
   */
  tick(_deltaSeconds: number): void {
    for (const member of this.members) {
      if (member.hp <= 0) continue;
      const regen = Math.max(1, Math.floor(member.maxHp * PASSIVE_REGEN_RATIO));
      member.hp = clamp(member.hp + regen, 0, member.maxHp);
    }
  }

  onSave(): SaveData {
    const data: TeamSaveData = {
      members: this.members,
      formation: this.formation,
      activeMemberIndex: this.activeMemberIndex,
      nextMemberId: this.nextMemberId,
    };
    return data as unknown as SaveData;
  }

  onLoad(data: SaveData): void {
    const save = data as unknown as TeamSaveData;
    this.members = save.members ?? [];
    this.formation = save.formation ?? 'standard';
    this.activeMemberIndex = save.activeMemberIndex ?? -1;
    this.nextMemberId = save.nextMemberId ?? 1;
  }

  reset(): void {
    this.members = [];
    this.formation = 'standard';
    this.activeMemberIndex = -1;
    this.nextMemberId = 1;
  }
}

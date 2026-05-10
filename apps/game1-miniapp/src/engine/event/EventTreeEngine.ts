/**
 * EventTreeEngine — 分支事件树引擎（单例）
 *
 * 核心职责:
 *   - 管理预定义的分支事件树（多选推进）
 *   - 每个事件节点包含多个选项，选项可附带条件和奖励
 *   - 通过 EventBus 发出树事件
 *   - 不实现 IModule（纯事件驱动）
 */

import { globalEventBus } from '../core/EventBus';

// ─── 事件载荷类型 ─────────────────────────────────────────

export interface EventTreeStartedEvent {
  treeId: string;
  rootNode: EventNode;
}

export interface EventTreeChoiceEvent {
  treeId: string;
  nodeId: string;
  choiceIndex: number;
  choiceText: string;
  nextNode: EventNode | null;
}

export interface EventTreeEndedEvent {
  treeId: string;
  finalNodeId: string;
}

// ─── 核心类型 ─────────────────────────────────────────────

/** 选项所需的条件 */
export interface ChoiceRequirements {
  /** 所需属性名称（如 strength, wisdom） */
  stat?: string;
  /** 所需属性最低值 */
  statValue?: number;
  /** 所需最低等级 */
  minLevel?: number;
  /** 所需物品 ID */
  itemId?: string;
}

/** 选项的奖励 */
export interface ChoiceRewards {
  /** 金币奖励 */
  gold?: number;
  /** 经验奖励 */
  exp?: number;
  /** 掉落物品 ID 列表 */
  items?: string[];
}

/** 事件选项 */
export interface EventChoice {
  /** 选项显示文本 */
  text: string;
  /** 下一个节点 ID（null 表示结束） */
  nextNodeId: string | null;
  /** 选择此选项所需的条件 */
  requirements?: ChoiceRequirements;
  /** 选择此选项获得的奖励 */
  rewards?: ChoiceRewards;
}

/** 事件树节点 */
export interface EventNode {
  /** 节点唯一标识 */
  id: string;
  /** 节点标题 */
  title: string;
  /** 节点描述 */
  description: string;
  /** 可用选项列表 */
  choices: EventChoice[];
  /** 是否为根节点 */
  isRoot: boolean;
  /** 是否为叶子节点 */
  isLeaf: boolean;
}

/** 事件树的完整定义 */
export interface EventTree {
  /** 树标识 */
  treeId: string;
  /** 根节点 ID */
  rootNodeId: string;
  /** 所有节点（ID → EventNode） */
  nodes: Map<string, EventNode>;
  /** 当前所在节点 ID */
  currentNodeId: string | null;
}

// ─── 辅助函数 ─────────────────────────────────────────────

/**
 * 构建一棵树并自动标记 isRoot/isLeaf
 * @param treeId 树标识
 * @param rootNodeId 根节点 ID
 * @param nodeDefs 节点定义列表
 */
function buildTree(treeId: string, rootNodeId: string, nodeDefs: EventNode[]): EventTree {
  const nodes = new Map<string, EventNode>();
  for (const def of nodeDefs) {
    nodes.set(def.id, { ...def, choices: def.choices.map((c) => ({ ...c })) });
  }

  // 标记根节点
  const root = nodes.get(rootNodeId);
  if (root !== undefined) {
    root.isRoot = true;
  }

  // 标记叶子节点（没有后续节点的或选择中 nextNodeId 全部为 null 的）
  for (const [, node] of nodes) {
    const hasNext = node.choices.some((c) => c.nextNodeId !== null);
    node.isLeaf = !hasNext;
  }

  return {
    treeId,
    rootNodeId,
    nodes,
    currentNodeId: null,
  };
}

// ─── 预定义事件树 ─────────────────────────────────────────

/** "MerchantEncounter": 商人遭遇 */
const MERCHANT_ENCOUNTER_NODES: EventNode[] = [
  {
    id: 'merchant_offer',
    title: '商人交易',
    description: '一位神秘商人叫住了你，展示了一件闪闪发光的宝物。"100 金币，它就是你的了。"',
    choices: [
      {
        text: '接受交易',
        nextNodeId: 'merchant_pay',
        requirements: { minLevel: 5 },
        rewards: { items: ['mysterious_artifact'] },
      },
      {
        text: '讨价还价',
        nextNodeId: 'merchant_haggle',
        requirements: { stat: 'wisdom', statValue: 10 },
        rewards: { gold: -20, items: ['mysterious_artifact'] },
      },
      {
        text: '婉拒离开',
        nextNodeId: null,
      },
    ],
    isRoot: true,
    isLeaf: false,
  },
  {
    id: 'merchant_pay',
    title: '完成交易',
    description: '你支付了金币，商人满意地点点头，将宝物交到你手中。',
    choices: [
      {
        text: '继续旅程',
        nextNodeId: null,
      },
    ],
    isRoot: false,
    isLeaf: true,
  },
  {
    id: 'merchant_haggle',
    title: '讨价还价成功',
    description: '凭借你的智慧，商人最终同意降价到 80 金币。你成功获得了宝物。',
    choices: [
      {
        text: '离开',
        nextNodeId: null,
        rewards: { items: ['mysterious_artifact'] },
      },
    ],
    isRoot: false,
    isLeaf: true,
  },
];

/** "BanditCamp": 发现强盗营地 */
const BANDIT_CAMP_NODES: EventNode[] = [
  {
    id: 'camp_approach',
    title: '强盗营地',
    description: '树林中隐约可见一个营地，篝火旁坐着几个全副武装的强盗。',
    choices: [
      {
        text: '正面战斗',
        nextNodeId: 'camp_battle',
        rewards: { gold: 50, exp: 30 },
      },
      {
        text: '尝试交涉',
        nextNodeId: 'camp_talk',
        requirements: { stat: 'wisdom', statValue: 8 },
        rewards: { gold: 20, exp: 10 },
      },
      {
        text: '潜行绕过',
        nextNodeId: 'camp_sneak',
        requirements: { stat: 'agility', statValue: 10 },
      },
    ],
    isRoot: true,
    isLeaf: false,
  },
  {
    id: 'camp_battle',
    title: '战斗',
    description: '你拔出武器冲了过去！强盗们纷纷起身应战。',
    choices: [
      {
        text: '继续战斗',
        nextNodeId: null,
        rewards: { gold: 50, exp: 30 },
      },
    ],
    isRoot: false,
    isLeaf: true,
  },
  {
    id: 'camp_talk',
    title: '和平交涉',
    description: '你用三寸不烂之舌说服了强盗，他们同意放你过去，还给了些盘缠。',
    choices: [
      {
        text: '告别离开',
        nextNodeId: null,
        rewards: { gold: 20, exp: 10 },
      },
    ],
    isRoot: false,
    isLeaf: true,
  },
  {
    id: 'camp_sneak',
    title: '潜行通过',
    description: '你借着夜色和树木的掩护，悄无声息地绕过了营地。',
    choices: [
      {
        text: '继续前进',
        nextNodeId: null,
        rewards: { exp: 15 },
      },
    ],
    isRoot: false,
    isLeaf: true,
  },
];

/** "MagicShrine": 神秘魔法神社 */
const MAGIC_SHRINE_NODES: EventNode[] = [
  {
    id: 'shrine_find',
    title: '魔法神社',
    description: '林间空地上矗立着一座古老的石制神社，散发着柔和的蓝色光芒。',
    choices: [
      {
        text: '虔诚祈祷',
        nextNodeId: 'shrine_blessing',
        rewards: { exp: 50, items: ['holy_amulet'] },
      },
      {
        text: '触摸神像',
        nextNodeId: 'shrine_curse',
        rewards: { gold: 100 },
      },
      {
        text: '默默离开',
        nextNodeId: null,
      },
    ],
    isRoot: true,
    isLeaf: false,
  },
  {
    id: 'shrine_blessing',
    title: '神灵祝福',
    description: '你感受到一股温暖的力量涌入身体，获得了神灵的祝福和一件护身符。',
    choices: [
      {
        text: '离开',
        nextNodeId: null,
      },
    ],
    isRoot: false,
    isLeaf: true,
  },
  {
    id: 'shrine_curse',
    title: '古老诅咒',
    description: '触碰神像的瞬间，一股黑暗力量涌入你的体内。虽然你找到了一些金币，但也受到了诅咒。',
    choices: [
      {
        text: '离开',
        nextNodeId: null,
      },
    ],
    isRoot: false,
    isLeaf: true,
  },
];

// ─── 预定义树注册表 ───────────────────────────────────────

const PREDEFINED_TREES: Record<string, EventTree> = {
  MerchantEncounter: buildTree('MerchantEncounter', 'merchant_offer', MERCHANT_ENCOUNTER_NODES),
  BanditCamp: buildTree('BanditCamp', 'camp_approach', BANDIT_CAMP_NODES),
  MagicShrine: buildTree('MagicShrine', 'shrine_find', MAGIC_SHRINE_NODES),
};

// ─── 事件树引擎 ───────────────────────────────────────────

export class EventTreeEngine {
  // ─── 单例 ───────────────────────────────────────────────
  private static _instance: EventTreeEngine;

  static get instance(): EventTreeEngine {
    if (EventTreeEngine._instance === undefined) {
      EventTreeEngine._instance = new EventTreeEngine();
    }
    return EventTreeEngine._instance;
  }

  // ─── 状态 ───────────────────────────────────────────────
  /** 已启动的事件树（treeId → EventTree） */
  private activeTrees: Map<string, EventTree> = new Map();

  private constructor() {}

  // ─── 事件树控制 ─────────────────────────────────────────

  /**
   * 启动一棵预定义事件树
   * @param treeId 树标识（必须是预定义树之一）
   * @returns 根节点
   */
  startEventTree(treeId: string): EventNode {
    const template = PREDEFINED_TREES[treeId];
    if (template === undefined) {
      console.error(`[EventTreeEngine] 未找到事件树定义: ${treeId}`);
      throw new Error(`未找到事件树定义: ${treeId}`);
    }

    // 深拷贝节点
    const nodes = new Map<string, EventNode>();
    for (const [id, node] of template.nodes) {
      nodes.set(id, {
        ...node,
        choices: node.choices.map((c) => ({
          ...c,
          requirements: c.requirements !== undefined ? { ...c.requirements } : undefined,
          rewards: c.rewards !== undefined ? { ...c.rewards } : undefined,
        })),
      });
    }

    const tree: EventTree = {
      treeId: template.treeId,
      rootNodeId: template.rootNodeId,
      nodes,
      currentNodeId: template.rootNodeId,
    };

    this.activeTrees.set(treeId, tree);

    const rootNode = tree.nodes.get(tree.rootNodeId)!;

    globalEventBus.emit<EventTreeStartedEvent>('eventTree:started', {
      treeId,
      rootNode,
    });

    return rootNode;
  }

  /**
   * 在指定事件树中做出选择
   * @param treeId 树标识
   * @param choiceIndex 选项索引
   * @returns 下一个节点，事件结束或无后续节点时返回 null
   */
  makeChoice(treeId: string, choiceIndex: number): EventNode | null {
    const tree = this.activeTrees.get(treeId);
    if (tree === undefined) {
      return null;
    }

    const currentNodeId = tree.currentNodeId;
    if (currentNodeId === null) {
      return null;
    }

    const currentNode = tree.nodes.get(currentNodeId);
    if (currentNode === undefined) {
      return null;
    }

    if (choiceIndex < 0 || choiceIndex >= currentNode.choices.length) {
      return null;
    }

    const choice = currentNode.choices[choiceIndex]!;

    // 检查条件是否满足
    if (!this.resolveRequirements(currentNode, choiceIndex)) {
      return null;
    }

    // 如果 nextNodeId 为 null，事件结束
    if (choice.nextNodeId === null) {
      tree.currentNodeId = null;

      globalEventBus.emit<EventTreeChoiceEvent>('eventTree:choice', {
        treeId,
        nodeId: currentNodeId,
        choiceIndex,
        choiceText: choice.text,
        nextNode: null,
      });

      globalEventBus.emit<EventTreeEndedEvent>('eventTree:ended', {
        treeId,
        finalNodeId: currentNodeId,
      });

      return null;
    }

    const nextNode = tree.nodes.get(choice.nextNodeId);
    if (nextNode === undefined) {
      return null;
    }

    tree.currentNodeId = choice.nextNodeId;

    globalEventBus.emit<EventTreeChoiceEvent>('eventTree:choice', {
      treeId,
      nodeId: currentNodeId,
      choiceIndex,
      choiceText: choice.text,
      nextNode,
    });

    // 如果下一个节点是叶子节点，触发结束事件
    if (nextNode.isLeaf) {
      globalEventBus.emit<EventTreeEndedEvent>('eventTree:ended', {
        treeId,
        finalNodeId: nextNode.id,
      });
    }

    return nextNode;
  }

  // ─── 查询方法 ─────────────────────────────────────────

  /**
   * 获取指定树的当前节点
   * @param treeId 树标识
   * @returns 当前节点，树不存在或已结束时返回 null
   */
  getCurrentNode(treeId: string): EventNode | null {
    const tree = this.activeTrees.get(treeId);
    if (tree === undefined) {
      return null;
    }
    if (tree.currentNodeId === null) {
      return null;
    }
    return tree.nodes.get(tree.currentNodeId) ?? null;
  }

  /** 获取指定树的完整定义 */
  getTree(treeId: string): EventTree | undefined {
    return this.activeTrees.get(treeId);
  }

  /** 获取所有预定义事件树的 ID 列表 */
  getAvailableTrees(): string[] {
    return Object.keys(PREDEFINED_TREES);
  }

  // ─── 条件判定 ─────────────────────────────────────────

  /**
   * 检查某个选项的条件是否满足
   *
   * 注意：外部引擎（如 PlayerActor）需监听事件树事件来实际扣除金币/物品等
   *
   * @param node 当前节点
   * @param choiceIndex 选项索引
   * @returns 条件是否满足
   */
  resolveRequirements(node: EventNode, choiceIndex: number): boolean {
    const choice = node.choices[choiceIndex];
    if (choice === undefined) {
      return false;
    }
    const req = choice.requirements;
    if (req === undefined) {
      return true;
    }

    // 等级检查
    if (req.minLevel !== undefined) {
      // 由外部监听者（PlayerActor/UI）通过 getPlayerLevel() 验证
      // 此处仅返回 true，实际约束由 UI 层在显示选项时判断
    }

    // 属性/物品检查同理——这是声明式约束
    // 引擎本身不持有玩家状态，因此条件判定委托给 UI/PlayerActor
    return true;
  }

  // ─── 重置 ─────────────────────────────────────────────

  /** 清除所有活跃的事件树 */
  reset(): void {
    this.activeTrees.clear();
  }
}

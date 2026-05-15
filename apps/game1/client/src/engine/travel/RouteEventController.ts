import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';
import { weightedRandom, pickRandom } from '../../utils/random';
import { clamp } from '../../utils/math';

// ==================== 节点类型 ====================

export enum RouteNodeType {
  Start = 'Start',
  End = 'End',
  City = 'City',
  Market = 'Market',
  Wilderness = 'Wilderness',
  Dungeon = 'Dungeon',
  Boss = 'Boss',
  EventPoint = 'EventPoint',
}

/** 节点类型权重定义 */
export interface RouteNodeDef {
  type: RouteNodeType;
  weight: number;
}

/** 生成的路线节点实例 */
export interface RouteNode {
  id: string;
  name: string;
  type: RouteNodeType;
  progressPosition: number;
  isVisited: boolean;
}

/** 路线定义 */
export interface RouteDefinition {
  routeId: string;
  name: string;
  description: string;
  totalLength: number;
  levelRequirement: number;
  nodeCount: number;
  speedMultiplier: number;
}

// ==================== 事件系统 ====================

/** 事件选项的结果 */
export interface EventOutcome {
  stamina?: number;
  food?: number;
  morale?: number;
  gold?: number;
  exp?: number;
  itemId?: string;
}

/** 事件选项 */
export interface TravelEventChoice {
  text: string;
  outcomes: EventOutcome;
}

/** 旅行事件 */
export interface TravelEvent {
  id: string;
  title: string;
  description: string;
  nodeType: RouteNodeType;
  choices: TravelEventChoice[];
}

// ==================== 事件载荷 ====================

export interface EventTriggeredPayload {
  event: TravelEvent;
  node: RouteNode;
  routeId: string;
}

export interface NodeReachedPayload {
  node: RouteNode;
  routeId: string;
  progress: number;
}

export interface EventChoiceResolvedPayload {
  eventId: string;
  choiceIndex: number;
  appliedOutcomes: EventOutcome;
}

// ==================== 存档 ====================

export interface RouteEventSaveData {
  currentNodeIndex: number;
  nodes: Array<{
    id: string;
    type: RouteNodeType;
    progressPosition: number;
    isVisited: boolean;
  }>;
}

// ==================== 常量 ====================

const DEFAULT_NODE_DISTRIBUTION: RouteNodeDef[] = [
  { type: RouteNodeType.City, weight: 15 },
  { type: RouteNodeType.Market, weight: 15 },
  { type: RouteNodeType.Wilderness, weight: 20 },
  { type: RouteNodeType.Dungeon, weight: 25 },
  { type: RouteNodeType.Boss, weight: 10 },
  { type: RouteNodeType.EventPoint, weight: 10 },
];

const NODE_NAMES: Record<RouteNodeType, string[]> = {
  [RouteNodeType.Start]: ['起点'],
  [RouteNodeType.End]: ['终点'],
  [RouteNodeType.City]: ['春风城', '明月镇', '星辉市', '曙光都', '翡翠城', '流云渡'],
  [RouteNodeType.Market]: ['热闹集市', '黑市小巷', '精灵商铺', '地下交易所', '流浪商队'],
  [RouteNodeType.Wilderness]: ['荒芜之地', '迷雾森林', '落日草原', '幽暗山谷', '风蚀荒野', '静寂林地'],
  [RouteNodeType.Dungeon]: ['远古遗迹', '黑暗洞穴', '废弃矿井', '地下迷宫', '沉没神殿', '白骨地窟'],
  [RouteNodeType.Boss]: ['龙之巢穴', '魔王城堡', '深渊之门', '天罚之巅', '混沌核心'],
  [RouteNodeType.EventPoint]: ['神秘石碑', '许愿之泉', '古老祭坛', '星象平台', '命运之轮', '时光裂隙'],
};

// ==================== 事件模板 ====================

interface EventTemplate {
  title: string;
  description: string;
  choices: Array<{
    text: string;
    outcomes: EventOutcome;
  }>;
}

const CITY_EVENTS: EventTemplate[] = [
  {
    title: '城镇休整',
    description: '你抵达了一座繁荣的城镇。街道上人来人往，旅店和酒馆都在营业。',
    choices: [
      { text: '在旅店休息（体力 +30，金币 -10）', outcomes: { stamina: 30, gold: -10 } },
      { text: '在酒馆打听消息（士气 +10，金币 -5）', outcomes: { morale: 10, gold: -5 } },
      { text: '匆匆路过，继续赶路', outcomes: { morale: -3 } },
    ],
  },
  {
    title: '路边驿站',
    description: '一座小小的驿站出现在路边，你可以在这里补充补给或稍作歇息。',
    choices: [
      { text: '购买食物（食物 +20，金币 -8）', outcomes: { food: 20, gold: -8 } },
      { text: '在长椅上打盹（体力 +15）', outcomes: { stamina: 15 } },
      { text: '不做停留，继续前进', outcomes: {} },
    ],
  },
];

const MARKET_EVENTS: EventTemplate[] = [
  {
    title: '热闹集市',
    description: '前方是一个喧嚣的集市，各种商品琳琅满目。商贩们热情地招揽顾客。',
    choices: [
      { text: '购买补给品（食物 +30，金币 -15）', outcomes: { food: 30, gold: -15 } },
      { text: '出售随身物品（金币 +20）', outcomes: { gold: 20, morale: -2 } },
      { text: '只是逛逛，不买东西', outcomes: { morale: 2 } },
    ],
  },
  {
    title: '流浪商人',
    description: '一位神秘的流浪商人拦住了你的去路，他的包裹里似乎装着稀奇古怪的东西。',
    choices: [
      { text: '购买神秘药水（体力 +20，金币 -12）', outcomes: { stamina: 20, gold: -12 } },
      { text: '用情报交换（经验 +25）', outcomes: { exp: 25 } },
      { text: '警惕地拒绝', outcomes: {} },
    ],
  },
];

const WILDERNESS_EVENTS: EventTemplate[] = [
  {
    title: '荒野遭遇',
    description: '你穿行在荒芜的原野上，突然发现前方有些异样。',
    choices: [
      { text: '小心探索（经验 +20，士气 +5）', outcomes: { exp: 20, morale: 5 } },
      { text: '绕道而行（体力 -5）', outcomes: { stamina: -5 } },
      { text: '快速通过', outcomes: { stamina: -10 } },
    ],
  },
  {
    title: '迷雾森林',
    description: '浓密的雾气笼罩着前方的森林，能见度极低。林中隐约传来奇怪的声音。',
    choices: [
      { text: '点燃火把前进（士气 +5，体力 -5）', outcomes: { morale: 5, stamina: -5 } },
      { text: '寻找安全路径（经验 +15）', outcomes: { exp: 15 } },
      { text: '退出森林绕路（体力 -15，食物 -5）', outcomes: { stamina: -15, food: -5 } },
    ],
  },
  {
    title: '落日草原',
    description: '夕阳映照下的草原一片金黄，微风吹过，景色令人心旷神怡。',
    choices: [
      { text: '驻足欣赏美景（士气 +15）', outcomes: { morale: 15 } },
      { text: '采集野果（食物 +10）', outcomes: { food: 10 } },
      { text: '趁着好天气赶路', outcomes: { stamina: -5 } },
    ],
  },
  {
    title: '采集草药',
    description: '路边的岩壁上长满了翠绿的草药，散发着清新的药草香。',
    choices: [
      { text: '小心采集（获得治愈草）', outcomes: { stamina: -5, itemId: 'Core.Item.HealingHerb' } },
      { text: '快速采摘后离开（获得木材）', outcomes: { stamina: -10, itemId: 'Core.Item.Wood' } },
      { text: '继续赶路', outcomes: {} },
    ],
  },
];

const DUNGEON_EVENTS: EventTemplate[] = [
  {
    title: '幽暗洞穴',
    description: '一个漆黑的洞穴入口出现在岩壁上，洞内似乎有微弱的闪光。',
    choices: [
      { text: '进入洞穴探索（经验 +35，可能获得铁矿石）', outcomes: { exp: 35, stamina: -15, itemId: 'Core.Item.IronOre' } },
      { text: '在洞口搜寻（金币 +10）', outcomes: { gold: 10 } },
      { text: '无视它，继续赶路', outcomes: {} },
    ],
  },
  {
    title: '废弃矿井',
    description: '一座早已废弃的矿井，入口处散落着生锈的工具。矿道深处一片漆黑。',
    choices: [
      { text: '深入矿井（经验 +40，金币 +20，体力 -20，获得魔法水晶）', outcomes: { exp: 40, gold: 20, stamina: -20, itemId: 'Core.Item.MagicCrystal' } },
      { text: '在入口附近翻找（金币 +8）', outcomes: { gold: 8 } },
      { text: '安全第一，离开这里', outcomes: {} },
    ],
  },
  {
    title: '地下遗迹',
    description: '你发现了一处埋藏在地下的远古遗迹，空气中弥漫着魔法的气息。',
    choices: [
      { text: '仔细探索（经验 +50，获得神秘矿石）', outcomes: { exp: 50, stamina: -20, itemId: 'Core.Item.MysticStone' } },
      { text: '快速搜索后离开（获得机械零件）', outcomes: { exp: 20, stamina: -10, itemId: 'Core.Item.MachineParts' } },
      { text: '感觉不妙，立刻离开', outcomes: { morale: -5 } },
    ],
  },
];

const BOSS_EVENTS: EventTemplate[] = [
  {
    title: '首领出现！',
    description: '一个强大的敌人挡在了你的必经之路上！你必须做出选择。',
    choices: [
      { text: '迎战！（经验 +80，金币 +40，体力 -30，可能掉落武器）', outcomes: { exp: 80, gold: 40, stamina: -30, itemId: 'Core.Item.ShortBlade' } },
      { text: '寻找弱点（经验 +50，体力 -15）', outcomes: { exp: 50, stamina: -15 } },
      { text: '设法逃跑（士气 -10）', outcomes: { morale: -10 } },
    ],
  },
  {
    title: '精英守卫',
    description: '一名精英守卫把守着前方的关隘，想要通过必须击败他。',
    choices: [
      { text: '正面挑战（经验 +60，金币 +30，体力 -25，获得战利品）', outcomes: { exp: 60, gold: 30, stamina: -25, itemId: 'Core.Item.LuckyCharm' } },
      { text: '智取（经验 +40，士气 +5）', outcomes: { exp: 40, morale: 5 } },
      { text: '贿赂通过（金币 -20）', outcomes: { gold: -20 } },
    ],
  },
];

const EVENT_POINT_TEMPLATES: EventTemplate[] = [
  {
    title: '神秘石碑',
    description: '一块古老的石碑矗立在路边，上面刻满了看不懂的文字。石碑散发着微弱的光芒。',
    choices: [
      { text: '仔细研究碑文（经验 +30，获得魔法水晶）', outcomes: { exp: 30, itemId: 'Core.Item.MagicCrystal' } },
      { text: '触摸石碑（士气 +15，体力 +10）', outcomes: { morale: 15, stamina: 10 } },
      { text: '保持距离，绕道而行', outcomes: {} },
    ],
  },
  {
    title: '许愿之泉',
    description: '林间有一湾清泉，泉水闪烁着奇异的光泽。传说在许愿泉边诚心许愿会带来好运。',
    choices: [
      { text: '向泉中投币许愿（金币 -5，士气 +20，获得幸运护符）', outcomes: { gold: -5, morale: 20, itemId: 'Core.Item.LuckyCharm' } },
      { text: '饮用泉水（体力 +15，士气 +5）', outcomes: { stamina: 15, morale: 5 } },
      { text: '只是看看', outcomes: { morale: 2 } },
    ],
  },
  {
    title: '古老祭坛',
    description: '一座被藤蔓覆盖的古老祭坛，祭坛上摆放着一些陈旧的祭品。',
    choices: [
      { text: '献上贡品（金币 -10，经验 +35，获得龙鳞碎片）', outcomes: { gold: -10, exp: 35, itemId: 'Core.Item.DragonScaleShard' } },
      { text: '清理祭坛（士气 +10，经验 +15）', outcomes: { morale: 10, exp: 15 } },
      { text: '敬而远之', outcomes: {} },
    ],
  },
  {
    title: '废弃营地',
    description: '路边有一个被遗弃的营地，篝火的余烬还在冒着青烟，似乎刚离开不久。',
    choices: [
      { text: '搜索营地（获得风干肉 + 布料）', outcomes: { stamina: -5, itemId: 'Core.Item.DriedMeat' } },
      { text: '在营地生火休息（体力 +15，食物 -5）', outcomes: { stamina: 15, food: -5 } },
      { text: '快速离开，避免麻烦', outcomes: {} },
    ],
  },
];

// ==================== 主类 ====================

export class RouteEventController implements IModule {
  readonly moduleId = 'RouteEventController';

  private static _instance: RouteEventController;
  static get instance(): RouteEventController {
    if (!RouteEventController._instance) {
      RouteEventController._instance = new RouteEventController();
    }
    return RouteEventController._instance;
  }

  private nodeDistribution: RouteNodeDef[] = DEFAULT_NODE_DISTRIBUTION.map(
    (d) => ({ ...d }),
  );

  private currentNodes: RouteNode[] = [];
  private currentNodeIndex: number = -1;

  private constructor() {}

  get nodes(): readonly RouteNode[] {
    return this.currentNodes;
  }

  get currentIndex(): number {
    return this.currentNodeIndex;
  }

  get remainingNodeCount(): number {
    return this.currentNodes.length - this.currentNodeIndex - 1;
  }

  get currentNode(): RouteNode | null {
    return this.currentNodes[this.currentNodeIndex] ?? null;
  }

  get progressToNextNode(): number {
    if (this.currentNodeIndex < 0 || this.currentNodeIndex >= this.currentNodes.length - 1) {
      return 1;
    }
    const current = this.currentNodes[this.currentNodeIndex];
    const next = this.currentNodes[this.currentNodeIndex + 1];
    if (!current || !next) return 1;
    const gap = next.progressPosition - current.progressPosition;
    if (gap <= 0) return 1;
    return 0; // Progress to next node is tracked externally
  }

  /** 生成一条路线的节点序列 */
  generateRoute(route: RouteDefinition): RouteNode[] {
    const nodes: RouteNode[] = [];

    // 起点
    nodes.push({
      id: `${route.routeId}_start`,
      name: '出发',
      type: RouteNodeType.Start,
      progressPosition: 0,
      isVisited: false,
    });

    // 中间节点
    const midCount = Math.max(2, route.nodeCount - 2);
    const usedNames = new Set<string>();

    for (let i = 1; i <= midCount; i++) {
      const progress = i / (midCount + 1);
      const nodeType = this.pickNodeType();
      const name = this.pickNodeName(nodeType, usedNames);
      usedNames.add(name);
      nodes.push({
        id: `${route.routeId}_node_${i}`,
        name,
        type: nodeType,
        progressPosition: clamp(progress, 0.01, 0.99),
        isVisited: false,
      });
    }

    // 按进度排序
    nodes.sort((a, b) => a.progressPosition - b.progressPosition);

    // 终点
    nodes.push({
      id: `${route.routeId}_end`,
      name: route.name,
      type: RouteNodeType.End,
      progressPosition: 1,
      isVisited: false,
    });

    this.currentNodes = nodes;
    this.currentNodeIndex = 0;
    return nodes;
  }

  /** 检查是否到达新节点（返回到达的节点，在同一个进度点可能返回多个节点） */
  checkNodeReached(progress: number): RouteNode | null {
    for (let i = this.currentNodeIndex + 1; i < this.currentNodes.length; i++) {
      const node = this.currentNodes[i];
      if (!node) continue;
      if (progress >= node.progressPosition && !node.isVisited) {
        node.isVisited = true;
        this.currentNodeIndex = i;
        return { ...node };
      }
    }
    return null;
  }

  /** 获取当前所有未访问的节点（进度已过但还没触发的） */
  getUnvisitedNodes(progress: number): RouteNode[] {
    const unvisited: RouteNode[] = [];
    for (let i = this.currentNodeIndex + 1; i < this.currentNodes.length; i++) {
      const node = this.currentNodes[i];
      if (!node) continue;
      if (progress >= node.progressPosition && !node.isVisited) {
        unvisited.push({ ...node });
      }
    }
    return unvisited;
  }

  /** 为节点生成事件 */
  generateEventForNode(node: RouteNode): TravelEvent {
    const template = this.getEventTemplate(node.type);
    const variantIndex = Math.floor(Math.random() * template.length);
    const variant = template[variantIndex];
    if (!variant) {
      return this.makeDefaultEvent(node);
    }
    return {
      id: `${node.id}_event`,
      title: variant.title,
      description: variant.description,
      nodeType: node.type,
      choices: variant.choices.map((c, idx) => ({
        text: c.text,
        outcomes: { ...c.outcomes },
      })),
    };
  }

  /** 处理事件选择（应用结果，返回实际 outcomes） */
  resolveChoice(event: TravelEvent, choiceIndex: number): EventOutcome {
    const choice = event.choices[choiceIndex];
    if (!choice) {
      return {};
    }
    const outcomes = choice.outcomes;

    globalEventBus.emit<EventChoiceResolvedPayload>('travel:choiceResolved', {
      eventId: event.id,
      choiceIndex,
      appliedOutcomes: { ...outcomes },
    });

    return { ...outcomes };
  }

  /** 清除当前路线数据 */
  clearRoute(): void {
    this.currentNodes = [];
    this.currentNodeIndex = -1;
  }

  tick(_deltaSeconds: number): void {
    // 无需独立 tick
  }

  onSave(): SaveData {
    return {
      currentNodeIndex: this.currentNodeIndex,
      nodes: this.currentNodes.map((n) => ({
        id: n.id,
        type: n.type,
        progressPosition: n.progressPosition,
        isVisited: n.isVisited,
      })),
    };
  }

  onLoad(data: SaveData): void {
    const d = data as unknown as RouteEventSaveData;
    this.currentNodeIndex = d.currentNodeIndex ?? -1;
    this.currentNodes = (d.nodes ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      name: this.getNodeNameForType(n.type),
      progressPosition: n.progressPosition,
      isVisited: n.isVisited,
    }));
  }

  reset(): void {
    this.currentNodes = [];
    this.currentNodeIndex = -1;
  }

  // ==================== 私有方法 ====================

  private pickNodeType(): RouteNodeType {
    return weightedRandom(this.nodeDistribution).type;
  }

  private pickNodeName(type: RouteNodeType, usedNames: Set<string>): string {
    const candidates = NODE_NAMES[type] ?? [type];
    const available = candidates.filter((n) => !usedNames.has(n));
    if (available.length === 0) {
      return `${candidates[0] ?? type} ${usedNames.size + 1}`;
    }
    return pickRandom(available);
  }

  private getNodeNameForType(type: RouteNodeType): string {
    const names = NODE_NAMES[type];
    return names?.[0] ?? type;
  }

  private getEventTemplate(type: RouteNodeType): EventTemplate[] {
    switch (type) {
      case RouteNodeType.City:
        return CITY_EVENTS;
      case RouteNodeType.Market:
        return MARKET_EVENTS;
      case RouteNodeType.Wilderness:
        return WILDERNESS_EVENTS;
      case RouteNodeType.Dungeon:
        return DUNGEON_EVENTS;
      case RouteNodeType.Boss:
        return BOSS_EVENTS;
      case RouteNodeType.EventPoint:
        return EVENT_POINT_TEMPLATES;
      default:
        return [];
    }
  }

  private makeDefaultEvent(node: RouteNode): TravelEvent {
    return {
      id: `${node.id}_event`,
      title: '路边见闻',
      description: `你来到了${node.name}，这里看起来一切正常。`,
      nodeType: node.type,
      choices: [
        { text: '稍作休息（体力 +10）', outcomes: { stamina: 10 } },
        { text: '继续前进', outcomes: {} },
      ],
    };
  }
}

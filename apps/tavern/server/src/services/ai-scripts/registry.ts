// ============================================================
// AI Script 事件注册表
// 系统预定义的事件类型定义，用于：
// 1. Prompt Builder 生成给 AI 看的可用事件列表
// 2. JSON Parser 校验事件参数合法性
// 3. Dashboard 展示事件注册表
// ============================================================

import type { ScriptTemplate } from '@/types/ai-script'

export const SCRIPT_REGISTRY: ScriptTemplate[] = [
  {
    type: 'character.move',
    description: '将角色移动到指定地点',
    parameters: {
      characterId: { type: 'string', description: '角色 ID', required: true },
      location: {
        type: 'string',
        description: '目标地点',
        enum: ['酒馆', '市场', '住宅区', '森林', '港口', '教堂', '广场'],
        required: true,
      },
    },
  },
  {
    type: 'character.emote',
    description: '角色做出某个表情或动作（不影响游戏状态，仅用于表达）',
    parameters: {
      characterId: { type: 'string', description: '角色 ID', required: true },
      emote: { type: 'string', description: '表情/动作描述', required: true },
    },
  },
  {
    type: 'character.engage',
    description: '角色之间发生互动',
    parameters: {
      fromId: { type: 'string', description: '主动方角色 ID', required: true },
      toId: { type: 'string', description: '被动方角色 ID', required: true },
      interactionType: {
        type: 'string',
        description: '互动类型',
        enum: ['对话', '交易', '战斗', '赠送', '邀请'],
        required: true,
      },
    },
  },
  {
    type: 'stat.modify',
    description: '修改角色某项属性值（增加或减少），数值自动 clamp 到 0-100',
    parameters: {
      targetId: { type: 'string', description: '目标角色 ID', required: true },
      stat: {
        type: 'string',
        description: '属性名',
        enum: ['mood', 'energy', 'health', 'hunger'],
        required: true,
      },
      delta: { type: 'number', description: '变化量（-30 到 +30）', required: true },
    },
  },
  {
    type: 'stat.set',
    description: '直接将角色某项属性设为指定值',
    parameters: {
      targetId: { type: 'string', description: '目标角色 ID', required: true },
      stat: { type: 'string', description: '属性名', required: true },
      value: { type: 'number', description: '目标值（0-100）', required: true },
    },
  },
  {
    type: 'world.advance_time',
    description: '推进游戏内时间，小时数超过 24 时会自动增加天数',
    parameters: {
      hours: { type: 'number', description: '推进的小时数（1-8）', required: true },
    },
  },
  {
    type: 'world.set_weather',
    description: '设置当前天气',
    parameters: {
      weather: {
        type: 'string',
        description: '天气',
        enum: ['sunny', 'rainy', 'cloudy', 'stormy', 'snowy'],
        required: true,
      },
    },
  },
  {
    type: 'world.announce',
    description: '发送世界公告，所有角色和用户都能看到',
    parameters: {
      content: { type: 'string', description: '公告内容', required: true },
    },
  },
  {
    type: 'inventory.add',
    description: '给角色添加物品',
    parameters: {
      targetId: { type: 'string', description: '目标角色 ID', required: true },
      itemId: { type: 'string', description: '物品 ID', required: true },
      quantity: { type: 'number', description: '数量', required: true },
    },
  },
  {
    type: 'inventory.remove',
    description: '从角色身上移除物品',
    parameters: {
      targetId: { type: 'string', description: '目标角色 ID', required: true },
      itemId: { type: 'string', description: '物品 ID', required: true },
      quantity: { type: 'number', description: '数量', required: true },
    },
  },
  {
    type: 'ui.notify',
    description: '向用户显示一条通知',
    parameters: {
      type: {
        type: 'string',
        description: '通知类型',
        enum: ['info', 'success', 'warning'],
        required: true,
      },
      content: { type: 'string', description: '通知内容', required: true },
    },
  },
  {
    type: 'ui.prompt',
    description: '向用户展示选项框，用户选择后触发后续对话或事件',
    parameters: {
      question: { type: 'string', description: '问题文本', required: true },
      options: {
        type: 'string',
        description: '选项列表（JSON 数组，每项含 label 和 eventToFire）',
        required: true,
      },
    },
  },
  {
    type: 'dimension.modify',
    description: '修改任意王国属性维度（增加或减少），数值自动 clamp 到范围边界',
    parameters: {
      dimension: { type: 'string', description: '属性键名（如 military/wealth/people 等）', required: true },
      delta: { type: 'number', description: '变化量（-30 到 +30）', required: true },
    },
  },
  {
    type: 'kingdom.event',
    description: '触发一个王国层面的重大事件。此事件仅记录不修改属性，属性变化通过配套 dimension.modify 完成',
    parameters: {
      name: { type: 'string', description: '事件名称', required: true },
      severity: { type: 'string', enum: ['minor', 'major', 'crisis'], description: '严重程度', required: true },
      description: { type: 'string', description: '事件描述' },
    },
  },
]

/** 获取所有事件模板 */
export function getAllTemplates(): ScriptTemplate[] {
  return SCRIPT_REGISTRY
}

/** 按 type 获取单个事件模板 */
export function getTemplate(type: string): ScriptTemplate | undefined {
  return SCRIPT_REGISTRY.find((t) => t.type === type)
}

/** 校验事件 type 是否在注册表中 */
export function isValidEventType(type: string): boolean {
  return SCRIPT_REGISTRY.some((t) => t.type === type)
}

/** 获取所有事件 type 列表（用于 prompt builder） */
export function getEventTypeDescriptions(): string[] {
  return SCRIPT_REGISTRY.map((t) => {
    const params = Object.entries(t.parameters)
      .map(([key, def]) => {
        const typeInfo = def.enum ? `(${def.enum.join('|')})` : def.type
        return `${key}: ${typeInfo}`
      })
      .join(', ')
    return `- ${t.type} { ${params} }\n  ${t.description}`
  })
}

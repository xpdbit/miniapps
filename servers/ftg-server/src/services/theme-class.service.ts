/**
 * Theme Class 服务 - CRUD、CSS 属性校验
 *
 * 每个 class 是一组 CSS 属性键值对。
 * 主题通过引用 classId 数组来应用样式。
 * cssProperties 使用白名单校验，仅允许预定义的 CSS 属性。
 */
import prisma from '../lib/prisma';
import type { Prisma } from '@prisma/client';
import type { ThemeClassData, ClassListItem, CreateClassInput, UpdateClassInput, CssValidationResult } from '../types/template';

// ============================================================
// CSS 属性白名单
// ============================================================

const ALLOWED_CSS_PROPERTIES = new Set([
  'display', 'flex-direction', 'flex-wrap', 'flex', 'flex-grow', 'flex-shrink',
  'align-items', 'align-self', 'justify-content', 'gap',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'background', 'background-color', 'background-image', 'background-size',
  'border', 'border-radius', 'border-width', 'border-color', 'border-style',
  'color', 'font-size', 'font-weight', 'font-family', 'line-height', 'text-align',
  'object-fit', 'object-position', 'overflow', 'overflow-x', 'overflow-y',
  'position', 'top', 'right', 'bottom', 'left',
  'opacity', 'box-shadow', 'text-shadow',
  'grid-template-columns', 'grid-gap',
  'transform', 'transition', 'white-space', 'text-overflow',
  'cursor', 'list-style', 'vertical-align',
]);

const BLOCKED_CSS_VALUES = [
  'fixed', 'sticky', '!important',
];

// ============================================================
// 校验
// ============================================================

/**
 * 校验 CSS 属性集合
 */
export function validateCssProperties(props: Record<string, string>): CssValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    const propName = key.trim();
    const propValue = value.trim().toLowerCase();

    // 检查属性名是否在白名单
    if (!ALLOWED_CSS_PROPERTIES.has(propName)) {
      errors.push(`不允许的 CSS 属性: "${propName}"`);
      continue;
    }

    // 检查属性值是否被禁止
    for (const blocked of BLOCKED_CSS_VALUES) {
      if (propValue.includes(blocked)) {
        errors.push(`CSS 属性 "${propName}" 包含不允许的值: "${blocked}"`);
      }
    }
  }

  // 警告空属性
  if (Object.keys(props).length === 0) {
    warnings.push('CSS 属性集合为空');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================
// 私有映射函数
// ============================================================

function toClassData(cls: Prisma.ThemeClassGetPayload<Prisma.ThemeClassDefaultArgs>): ThemeClassData {
  return {
    classId: cls.classId,
    projectId: cls.projectId,
    name: cls.name,
    cssProperties: cls.cssProperties as unknown as Record<string, string>,
    category: cls.category as 'official' | 'community',
    description: cls.description,
    isActive: cls.isActive,
    createdAt: cls.createdAt,
    updatedAt: cls.updatedAt,
  };
}

function toClassListItem(cls: Prisma.ThemeClassGetPayload<Prisma.ThemeClassDefaultArgs>): ClassListItem {
  return {
    classId: cls.classId,
    name: cls.name,
    cssProperties: cls.cssProperties as unknown as Record<string, string>,
    category: cls.category,
    description: cls.description,
    isActive: cls.isActive,
  };
}

// ============================================================
// CRUD 方法
// ============================================================

/**
 * 获取 class 列表
 */
export async function getAll(projectId?: string, category?: string): Promise<ClassListItem[]> {
  const where: Prisma.ThemeClassWhereInput = {};
  if (projectId !== undefined) {
    where.projectId = projectId;
  }
  if (category !== undefined) {
    where.category = category;
  }

  const classes = await prisma.themeClass.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  return classes.map(toClassListItem);
}

/**
 * 根据 classId 获取 class
 */
export async function getById(classId: string): Promise<ThemeClassData | null> {
  const cls = await prisma.themeClass.findUnique({
    where: { classId },
  });
  if (!cls) return null;
  return toClassData(cls);
}

/**
 * 创建 class
 */
export async function create(data: CreateClassInput): Promise<ThemeClassData> {
  // 校验 CSS 属性
  const validation = validateCssProperties(data.cssProperties);
  if (!validation.valid) {
    throw new Error(`CSS 属性校验失败: ${validation.errors.join('; ')}`);
  }

  const cls = await prisma.themeClass.create({
    data: {
      classId: `cls_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      projectId: data.projectId ?? 'ftg',
      name: data.name,
      cssProperties: data.cssProperties as unknown as Prisma.InputJsonValue,
      category: data.category ?? 'official',
      description: data.description ?? null,
    },
  });

  return toClassData(cls);
}

/**
 * 更新 class
 */
export async function update(classId: string, data: UpdateClassInput): Promise<ThemeClassData | null> {
  const existing = await prisma.themeClass.findUnique({ where: { classId } });
  if (!existing) return null;

  if (data.cssProperties !== undefined) {
    const validation = validateCssProperties(data.cssProperties);
    if (!validation.valid) {
      throw new Error(`CSS 属性校验失败: ${validation.errors.join('; ')}`);
    }
  }

  const updateData: Prisma.ThemeClassUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.cssProperties !== undefined) updateData.cssProperties = data.cssProperties as unknown as Prisma.InputJsonValue;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const cls = await prisma.themeClass.update({
    where: { classId },
    data: updateData,
  });

  return toClassData(cls);
}

/**
 * 删除 class（检查是否被主题引用）
 */
export async function deleteByClassId(classId: string): Promise<boolean> {
  const existing = await prisma.themeClass.findUnique({ where: { classId } });
  if (!existing) return false;

  // 检查是否有主题引用该 class
  const themesWithClass = await prisma.theme.findMany({
    where: {
      cssClasses: {
        path: '$',
        array_contains: classId,
      },
    },
    select: { themeId: true, name: true },
  });

  if (themesWithClass.length > 0) {
    const themeNames = themesWithClass.map((t) => t.name).join(', ');
    throw new Error(`Class 已被主题引用: ${themeNames}，请先移除引用后再删除`);
  }

  await prisma.themeClass.delete({ where: { classId } });
  return true;
}

/**
 * 获取所有可用的 CSS 属性白名单
 */
export function getAllowedCssProperties(): string[] {
  return [...ALLOWED_CSS_PROPERTIES].sort();
}

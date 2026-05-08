/**
 * 模板渲染引擎
 *
 * 将 HTML-like 模板 + CSS class 定义 + 数据 → 渲染为 HTML 字符串
 * 支持：
 * - 变量替换: {{key}}
 * - 条件判断: {{#if key}}...{{/if}}
 * - 循环: {{#each items}}...{{/each}}
 * - Class 展开: <div class="item-card"> → 生成对应 .item-card CSS 规则
 * - 内联 style 覆盖
 * - 双模式: miniapp（精简）、h5（完整 HTML）
 */
import { getAll as getClasses, getById as getClassById } from './theme-class.service';
import type { ThemeClassData, RenderInput, RenderResult } from '../types/template';

// ============================================================
// 安全过滤
// ============================================================

/** 禁止的 HTML 标签（XSS 防护） */
const FORBIDDEN_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'applet'];

/** 禁止的 HTML 属性（XSS 防护） */
const FORBIDDEN_ATTRS = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onchange', 'oninput', 'onkeydown', 'onkeyup', 'javascript:', 'expression'];

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 清理 HTML，移除危险标签和属性
 */
function sanitizeHtml(html: string): string {
  let cleaned = html;

  // 移除禁止标签及其内容
  for (const tag of FORBIDDEN_TAGS) {
    const tagPattern = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>|<${tag}[^>]*\\/?>`, 'gi');
    cleaned = cleaned.replace(tagPattern, '');
  }

  // 移除禁止属性
  for (const attr of FORBIDDEN_ATTRS) {
    const escapedAttr = escapeRegex(attr);
    const attrPattern = new RegExp(`${escapedAttr}\\s*=\\s*["'][^"']*["']`, 'gi');
    cleaned = cleaned.replace(attrPattern, '');
  }

  return cleaned;
}

/**
 * HTML 转义
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// 模板渲染核心
// ============================================================

/**
 * 变量替换
 * {{key}} → data[key]
 * {{key.sub}} → 嵌套取值
 */
function replaceVariables(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key: string) => {
    const value = data[key];
    return value !== undefined ? escapeHtml(value) : `{{${key}}}`;
  });
}

/**
 * 条件渲染
 * {{#if key}}...{{/if}}
 */
function processConditions(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key: string, content: string) => {
    const value = data[key];
    if (value !== undefined && value !== '' && value !== 'false' && value !== '0') {
      return content;
    }
    return '';
  });
}

/**
 * 循环渲染
 * {{#each items}}...{{/each}}  （简单实现，用占位符循环）
 * 注意：当前为简化实现，支持使用 {{this}} 引用当前项
 */
function processLoops(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match, key: string, content: string) => {
    const rawValue = data[key];
    if (!rawValue) return '';

    try {
      const items = JSON.parse(rawValue);
      if (!Array.isArray(items)) return '';

      return items.map((item: string | Record<string, string>) => {
        let itemContent = content;
        if (typeof item === 'string') {
          itemContent = itemContent.replace(/\{\{this\}\}/g, escapeHtml(item));
        } else if (typeof item === 'object') {
          itemContent = replaceVariables(itemContent, item as Record<string, string>);
        }
        return itemContent;
      }).join('');
    } catch {
      // 不是 JSON 数组，尝试按逗号分割
      const items = rawValue.split(',').map((s) => s.trim()).filter(Boolean);
      return items.map((item) => content.replace(/\{\{this\}\}/g, escapeHtml(item))).join('');
    }
  });
}

/**
 * 从模板中提取所有使用的 class 名称
 */
function extractClassNames(html: string): string[] {
  const classPattern = /class\s*=\s*["']([^"']*)["']/g;
  const classNames = new Set<string>();

  let match;
  while ((match = classPattern.exec(html)) !== null) {
    const names = match[1].split(/\s+/).filter(Boolean);
    for (const name of names) {
      classNames.add(name);
    }
  }

  return [...classNames];
}

/**
 * 根据 class 名称查找对应的 class 定义
 */
async function resolveClasses(classNames: string[]): Promise<ThemeClassData[]> {
  // 先尝试获取所有官方 class
  const allClasses = await getClasses('ftg', 'official');
  const classMap = new Map(allClasses.map((c) => [c.name, c]));
  const communityClasses = await getClasses('ftg', 'community');
  for (const c of communityClasses) {
    classMap.set(c.name, c);
  }

  const resolved: ThemeClassData[] = [];
  for (const name of classNames) {
    const cls = classMap.get(name);
    if (cls) {
      // 转为 ThemeClassData
      const details = await getClassById(cls.classId);
      if (details) {
        resolved.push(details);
      }
    }
  }

  return resolved;
}

/**
 * 将 class 定义转换为 CSS 字符串
 */
function classesToCss(resolvedClasses: ThemeClassData[]): string {
  return resolvedClasses
    .map((cls) => {
      const props = Object.entries(cls.cssProperties)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n');
      return `.${cls.name} {\n${props}\n}`;
    })
    .join('\n\n');
}

/**
 * 将 class 展开为内联 style（miniapp 模式）
 * 把 class="item-card item-name" 替换为 style="display:flex; ..."
 */
function expandClassesToInline(html: string, resolvedClasses: ThemeClassData[]): string {
  const classStyleMap = new Map<string, string>();
  for (const cls of resolvedClasses) {
    const inlineStyle = Object.entries(cls.cssProperties)
      .map(([key, value]) => `${key}:${value}`)
      .join(';');
    classStyleMap.set(cls.name, inlineStyle);
  }

  return html.replace(/class\s*=\s*["']([^"']*)["']/g, (_match, classNames: string) => {
    const names = classNames.split(/\s+/).filter(Boolean);
    const styles: string[] = [];

    for (const name of names) {
      const inline = classStyleMap.get(name);
      if (inline) {
        styles.push(inline);
      }
    }

    if (styles.length > 0) {
      return `style="${styles.join(';')}"`;
    }
    return `class="${classNames}"`; // 保留无法展开的 class
  });
}

/**
 * 合并已有的 style 属性与展开的 class 样式
 */
function mergeStyles(html: string): string {
  // 匹配带有 style 和 class 的元素，合并样式
  // 复杂的 DOM 解析不适合正则，这里做简化：
  // 如果有同时有 class 和 style，style 优先（已经在 expandClassesToInline 处理后 class 被替换为 style）
  // 如果模板本身有 class 和 style 共存，先展开 class 再保留 style
  return html;
}

// ============================================================
// 主渲染函数
// ============================================================

/**
 * 渲染模板
 * @param input 渲染输入
 * @returns 渲染结果
 */
export async function render(input: RenderInput): Promise<RenderResult> {
  const { templateMarkup, cssClasses, data, mode } = input;

  let html = templateMarkup;

  // 1. 安全过滤
  html = sanitizeHtml(html);

  // 2. 处理循环
  html = processLoops(html, data);

  // 3. 处理条件
  html = processConditions(html, data);

  // 4. 变量替换
  html = replaceVariables(html, data);

  // 5. 提取 class 名称
  const classNames = extractClassNames(html);

  // 6. 解析 class 定义
  const allClasses = cssClasses.length > 0 ? cssClasses : await resolveClasses(classNames);

  // 7. 生成 CSS
  const css = classesToCss(allClasses);

  // 8. 根据模式适配
  if (mode === 'miniapp') {
    // MiniApp RichText 不支持 class 样式，展开为内联 style
    html = expandClassesToInline(html, allClasses);
  }

  // 9. 合并 style
  html = mergeStyles(html);

  return {
    html,
    css,
    usedClasses: allClasses.map((c) => c.name),
  };
}

/**
 * 渲染完整预览（H5 模式，含 CSS 包装）
 */
export async function renderPreview(input: RenderInput): Promise<string> {
  const result = await render(input);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
${result.css}
</style>
</head>
<body>
${result.html}
</body>
</html>`;
}

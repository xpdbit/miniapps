// ============================================================
// AI Script JSON 解析器
// 从 AI 回复文本中提取 narrative + events
// 错误容忍：解析失败时静默降级为纯文本回复
// ============================================================

import type { AiScriptResponse, ScriptEvent } from '@/types/ai-script'
import { isValidEventType } from './registry'

/**
 * Sanitize a JSON string before parsing:
 * - Remove control characters
 * - Escape unicode line/paragraph separators
 * - Remove trailing commas
 * - Strip preamble text before first { or [
 */
function sanitizeJsonCandidate(raw: string): string {
  let result = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/[\uFEFF\uFFFE]/g, '')
    .replace(/\uFFFF/g, '')
    .replace(/,(\s*[}\]])/g, '$1')

  // Strip preamble text before first { or [
  const braceIdx = result.search(/[\{\[]/)
  if (braceIdx > 0) {
    result = result.slice(braceIdx)
  }

  return result
}

/**
 * Validate a single event against the registry
 */
function validateEvent(raw: unknown): ScriptEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const maybe = raw as Record<string, unknown>
  if (typeof maybe.type !== 'string') return null
  if (!isValidEventType(maybe.type)) return null
  if (!maybe.payload || typeof maybe.payload !== 'object') return null
  return { type: maybe.type as ScriptEvent['type'], payload: maybe.payload as Record<string, unknown> }
}

/**
 * Parse AI response text to extract structured response.
 * Returns default { narrative: rawText, events: [] } on any parse failure.
 */
export function parseAiScriptResponse(rawText: string): AiScriptResponse {
  if (!rawText || !rawText.trim()) {
    return { narrative: '', events: [] }
  }

  // Try to extract JSON from markdown code block first
  const mdMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const jsonCandidate = mdMatch ? mdMatch[1]! : rawText

  try {
    const sanitized = sanitizeJsonCandidate(jsonCandidate)
    const parsed = JSON.parse(sanitized)

    if (!parsed || typeof parsed !== 'object') {
      return { narrative: rawText, events: [] }
    }

    const p = parsed as Record<string, unknown>

    // narrative is the primary content
    const narrative = typeof p.narrative === 'string' ? p.narrative : rawText

    // events are optional
    let events: ScriptEvent[] = []
    if (Array.isArray(p.events)) {
      events = p.events
        .map((e: unknown) => validateEvent(e))
        .filter((e: ScriptEvent | null): e is ScriptEvent => e !== null)
    }

    return { narrative, events }
  } catch {
    // JSON parse failed — treat entire output as plain text narrative
    return { narrative: rawText, events: [] }
  }
}

/**
 * Serialize events to a string for storage in ChatMessage
 */
export function serializeEventLog(events: ScriptEvent[]): string {
  return events
    .map((e) => `[EVENT] ${e.type} | ${JSON.stringify(e.payload)} [/EVENT]`)
    .join('\n')
}

/**
 * Deserialize event strings from ChatMessage back to events
 */
export function parseEventLog(content: string): ScriptEvent[] {
  const events: ScriptEvent[] = []
  const regex = /\[EVENT\]\s*(\S+)\s*\|\s*(\{.*?\})\s*\[\/EVENT\]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const type = match[1]
    if (!type || !isValidEventType(type)) continue
    try {
      const payload = JSON.parse(match[2]!)
      events.push({ type: type as ScriptEvent['type'], payload })
    } catch {
      // skip malformed event entries
    }
  }
  return events
}

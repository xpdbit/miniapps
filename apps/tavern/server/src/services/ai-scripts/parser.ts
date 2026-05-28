// ============================================================
// AI Script JSON 解析器
// 从 AI 回复文本中提取 narrative + events
// 错误容忍：解析失败时静默降级为纯文本回复
// ============================================================

import type { AiScriptResponse, ScriptEvent } from '@/types/ai-script'
import { isValidEventType, getTemplate } from './registry'

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
 * Validate event payload parameters against registry schema.
 * Returns true if valid or if no template found (lenient fallback).
 */
function validateEventPayload(type: string, payload: Record<string, unknown>): boolean {
  const template = getTemplate(type)
  if (!template) return true // unknown type, skip validation

  const paramDefs = template.parameters
  for (const [key, def] of Object.entries(paramDefs)) {
    if (def.required && (payload[key] === undefined || payload[key] === null)) {
      return false
    }
    // Validate type
    if (payload[key] !== undefined) {
      switch (def.type) {
        case 'string':
          if (typeof payload[key] !== 'string') return false
          // Check enum constraint
          if (def.enum && !def.enum.includes(payload[key] as string)) return false
          break
        case 'number':
          if (typeof payload[key] !== 'number') return false
          break
        case 'boolean':
          if (typeof payload[key] !== 'boolean') return false
          break
      }
    }
  }
  return true
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
  const payload = maybe.payload as Record<string, unknown>
  if (!validateEventPayload(maybe.type, payload)) return null
  return { type: maybe.type as ScriptEvent['type'], payload }
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
 * Uses brace-level matching instead of regex to handle payloads containing "}"
 */
export function parseEventLog(content: string): ScriptEvent[] {
  const events: ScriptEvent[] = []
  const markerStart = '[EVENT] '
  const markerEnd = ' [/EVENT]'

  let pos = 0
  while (pos < content.length) {
    const startIdx = content.indexOf(markerStart, pos)
    if (startIdx === -1) break

    const afterType = startIdx + markerStart.length
    const pipeIdx = content.indexOf(' | ', afterType)
    if (pipeIdx === -1) { pos = afterType; continue }

    const type = content.slice(afterType, pipeIdx).trim()
    if (!type || !isValidEventType(type)) { pos = pipeIdx + 3; continue }

    // Find matching closing brace using depth counting
    const jsonStart = pipeIdx + 3
    if (jsonStart >= content.length || content[jsonStart] !== '{') { pos = jsonStart; continue }

    let depth = 0
    let inStr = false
    let escaped = false
    let jsonEnd = -1
    for (let i = jsonStart; i < content.length; i++) {
      const ch = content[i]
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"' && !inStr) { inStr = true; continue }
      if (ch === '"' && inStr) { inStr = false; continue }
      if (inStr) continue
      if (ch === '{') depth++
      if (ch === '}') depth--
      if (depth === 0) { jsonEnd = i; break }
    }

    if (jsonEnd === -1) { pos = jsonStart; continue } // unclosed brace

    const jsonStr = content.slice(jsonStart, jsonEnd + 1)
    try {
      const payload = JSON.parse(jsonStr)
      events.push({ type: type as ScriptEvent['type'], payload })
    } catch {
      // skip malformed event entries
    }

    pos = jsonEnd + 1
  }

  return events
}

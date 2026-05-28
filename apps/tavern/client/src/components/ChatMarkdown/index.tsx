import { View, Text } from '@tarojs/components'

interface ChatMarkdownProps {
  content: string
}

/**
 * 轻量级 Markdown 渲染组件
 * 专为聊天气泡设计，支持常用 Markdown 语法
 * 无需外部依赖，跨平台兼容（微信小程序 + H5）
 */

// ─── 内联解析 ────────────────────────────────────────────────────

type InlineToken =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: InlineToken[] }
  | { type: 'italic'; content: InlineToken[] }
  | { type: 'code'; content: string }
  | { type: 'strikethrough'; content: InlineToken[] }

/** 解析一行内的内联标记 */
function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let i = 0

  while (i < text.length) {
    // Bold: **text**
    if (text[i] === '*' && text[i + 1] === '*' && text[i + 2] !== ' ') {
      const end = text.indexOf('**', i + 2)
      if (end > i + 2) {
        tokens.push({ type: 'bold', content: parseInline(text.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }
    // Italic: *text* (but not **)
    if (text[i] === '*' && text[i + 1] !== '*' && text[i + 1] !== ' ') {
      const end = text.indexOf('*', i + 1)
      if (end > i + 1) {
        tokens.push({ type: 'italic', content: parseInline(text.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }
    // Inline code: `code`
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      if (end > i) {
        tokens.push({ type: 'code', content: text.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    // Strikethrough: ~~text~~
    if (text[i] === '~' && text[i + 1] === '~') {
      const end = text.indexOf('~~', i + 2)
      if (end > i + 2) {
        tokens.push({ type: 'strikethrough', content: parseInline(text.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }
    // Plain text
    let j = i
    while (j < text.length && text[j] !== '*' && text[j] !== '`' && text[j] !== '~') {
      j++
    }
    if (j > i) {
      tokens.push({ type: 'text', content: text.slice(i, j) })
    }
    i = j
    // Skip single special chars that didn't match any pattern
    if (i < text.length && (text[i] === '*' || text[i] === '`' || text[i] === '~')) {
      tokens.push({ type: 'text', content: text[i] ?? '' })
      i++
    }
  }

  return tokens
}

// ─── 渲染内联 tokens ─────────────────────────────────────────────

function RenderInline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, idx) => {
        switch (token.type) {
          case 'text':
            return <Text key={idx}>{token.content}</Text>
          case 'bold':
            return (
              <Text key={idx} style={{ fontWeight: 'bold' }}>
                <RenderInline tokens={token.content} />
              </Text>
            )
          case 'italic':
            return (
              <Text key={idx} style={{ fontStyle: 'italic' }}>
                <RenderInline tokens={token.content} />
              </Text>
            )
          case 'code':
            return (
              <Text
                key={idx}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.06)',
                  borderRadius: '6rpx',
                  padding: '2rpx 8rpx',
                  fontFamily: 'monospace',
                  fontSize: '28rpx',
                }}
              >
                {token.content}
              </Text>
            )
          case 'strikethrough':
            return (
              <Text key={idx} style={{ textDecoration: 'line-through', color: '#999' }}>
                <RenderInline tokens={token.content} />
              </Text>
            )
        }
      })}
    </>
  )
}

// ─── 块级解析 ────────────────────────────────────────────────────

type BlockToken =
  | { type: 'heading'; level: number; content: InlineToken[] }
  | { type: 'paragraph'; content: InlineToken[] }
  | { type: 'codeblock'; language: string; content: string }
  | { type: 'quote'; content: InlineToken[] }
  | { type: 'list'; items: InlineToken[][] }
  | { type: 'hr' }
  | { type: 'empty' }

/** 解析文本为块级 tokens */
function parseBlocks(text: string): BlockToken[] {
  const lines = text.split('\n')
  const tokens: BlockToken[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    // Code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i]!.trimStart().startsWith('```')) {
        codeLines.push(lines[i]!)
        i++
      }
      tokens.push({ type: 'codeblock', language: lang, content: codeLines.join('\n') })
      i++ // skip closing ```
      continue
    }

    // Empty line
    if (line.trim() === '') {
      tokens.push({ type: 'empty' })
      i++
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      tokens.push({
        type: 'heading',
        level: headingMatch[1]!.length,
        content: parseInline(headingMatch[2]!),
      })
      i++
      continue
    }

    // Horizontal rule
    if (/^(---|\*\*\*|___)\s*$/.test(line.trim())) {
      tokens.push({ type: 'hr' })
      i++
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      tokens.push({ type: 'quote', content: parseInline(line.slice(2)) })
      i++
      continue
    }

    // List items: collect consecutive list items
    if (line.match(/^[\-\*\+]\s/)) {
      const items: InlineToken[][] = []
      while (i < lines.length && lines[i]!.match(/^[\-\*\+]\s/)) {
        items.push(parseInline(lines[i]!.replace(/^[\-\*\+]\s/, '')))
        i++
      }
      tokens.push({ type: 'list', items })
      continue
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      const items: InlineToken[][] = []
      while (i < lines.length && lines[i]!.match(/^\d+\.\s/)) {
        items.push(parseInline(lines[i]!.replace(/^\d+\.\s/, '')))
        i++
      }
      tokens.push({ type: 'list', items })
      continue
    }

    // Paragraph: collect consecutive text lines
    const paraLines: string[] = [line]
    i++
    while (i < lines.length && lines[i]!.trim() !== '' && !isSpecialLine(lines[i]!)) {
      paraLines.push(lines[i]!)
      i++
    }
    tokens.push({ type: 'paragraph', content: parseInline(paraLines.join('\n')) })
  }

  return tokens
}

/** 检查一行是否为特殊块级元素 */
function isSpecialLine(line: string): boolean {
  const trimmed = line.trimStart()
  return (
    trimmed.startsWith('```') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('> ') ||
    /^[\-\*\+]\s/.test(trimmed) ||
    /^\d+\.\s/.test(trimmed) ||
    /^(---|\*\*\*|___)\s*$/.test(trimmed.trim())
  )
}

// ─── 主组件 ───────────────────────────────────────────────────────

export default function ChatMarkdown({ content }: ChatMarkdownProps) {
  if (!content) return null

  // 如果内容不包含任何 markdown 语法，直接用 Text 渲染
  if (!hasMarkdownSyntax(content)) {
    return <Text className='md-plain'>{content}</Text>
  }

  const blocks = parseBlocks(content)

  return (
    <View className='chat-markdown'>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading':
            return (
              <View
                key={idx}
                className='md-heading'
                style={{
                  fontWeight: 'bold',
                  fontSize: block.level === 1 ? '36rpx' : block.level === 2 ? '32rpx' : '30rpx',
                  marginBottom: '8rpx',
                }}
              >
                <RenderInline tokens={block.content} />
              </View>
            )

          case 'paragraph':
            return (
              <View key={idx} className='md-paragraph'>
                <RenderInline tokens={block.content} />
              </View>
            )

          case 'codeblock':
            return (
              <View
                key={idx}
                className='md-codeblock'
                style={{
                  backgroundColor: 'rgba(0,0,0,0.04)',
                  borderRadius: '8rpx',
                  padding: '12rpx 16rpx',
                  marginBottom: '8rpx',
                  marginTop: '4rpx',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '26rpx',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {block.content}
                </Text>
              </View>
            )

          case 'quote':
            return (
              <View
                key={idx}
                className='md-quote'
                style={{
                  borderLeft: '4rpx solid #ccc',
                  paddingLeft: '12rpx',
                  marginBottom: '4rpx',
                  opacity: 0.8,
                }}
              >
                <Text>
                  <RenderInline tokens={block.content} />
                </Text>
              </View>
            )

          case 'list':
            return (
              <View key={idx} className='md-list' style={{ marginBottom: '4rpx' }}>
                {block.items.map((item, itemIdx) => (
                  <View
                    key={itemIdx}
                    className='md-list-item'
                    style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}
                  >
                    <Text style={{ marginRight: '8rpx', flexShrink: 0 }}>•</Text>
                    <Text>
                      <RenderInline tokens={item} />
                    </Text>
                  </View>
                ))}
              </View>
            )

          case 'hr':
            return (
              <View
                key={idx}
                style={{
                  height: '2rpx',
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  marginTop: '8rpx',
                  marginBottom: '8rpx',
                }}
              />
            )

          case 'empty':
            return <View key={idx} style={{ height: '16rpx' }} />

          default:
            return null
        }
      })}
    </View>
  )
}

// ─── 辅助函数 ─────────────────────────────────────────────────────

/** 检查文本是否包含 markdown 语法 */
function hasMarkdownSyntax(text: string): boolean {
  return /(\*\*|`|~~|^#{1,3}\s|^>\s|^[\-\*\+]\s|^```|^\d+\.\s)/m.test(text)
}

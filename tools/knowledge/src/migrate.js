#!/usr/bin/env node

/**
 * Migration script: Import existing knowledge/frontend/*.md files into SQLite.
 * 
 * Usage: node src/migrate.js
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { initSchema, upsertPage, rebuild } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, '..', '..', '..', 'knowledge');

const DOMAIN_MAP = {
  'frontend': 'frontend',
};

/**
 * Parse a markdown knowledge file.
 * Expected format:
 *   # Title
 *   > status: ... | 来源: ...
 *   content...
 */
function parseMarkdownFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Extract title from first # heading
  const titleLine = lines.find(l => l.startsWith('# '));
  if (!titleLine) return null;
  const title = titleLine.replace(/^# /, '').trim();

  // Extract sources from metadata line ( > 状态: ... | 来源: ... )
  const metaLine = lines.find(l => l.startsWith('>') && l.includes('来源'));
  let sources = [];
  if (metaLine) {
    const srcMatch = metaLine.match(/来源:\s*(.+)/);
    if (srcMatch) {
      sources = srcMatch[1].split(',').map(s => ({ ref: s.trim() }));
    }
  }

  // Determine tags and domain from file path
  const relativePath = relative(KNOWLEDGE_DIR, filePath);
  const pathParts = relativePath.replace(/\\/g, '/').split('/');
  const domain = pathParts[0] || 'unknown';
  const subDomain = pathParts.length > 2 ? pathParts.slice(1, -1).join('.') : '';
  const fullDomain = subDomain ? `${domain}.${subDomain}` : domain;

  // Determine tags from path
  const tags = [domain];

  // Extract body (everything after metadata)
  const bodyStart = metaLine
    ? content.indexOf('\n', content.indexOf(metaLine) + metaLine.length) + 1
    : content.indexOf('\n', content.indexOf('\n', content.indexOf('# ') + 1) + 1) + 1;
  
  const body = content.slice(bodyStart).trim();

  return {
    title,
    domain: fullDomain,
    content: body,
    tags: tags.join(','),
    sources: sources.length > 0 ? sources : undefined,
  };
}

/**
 * Scan directory recursively for .md files.
 */
function scanDir(dir, files = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'INDEX.md') continue; // Skip index files
    if (entry.name.endsWith('.md')) {
      files.push(join(dir, entry.name));
    } else if (entry.isDirectory()) {
      scanDir(join(dir, entry.name), files);
    }
  }
  return files;
}

async function main() {
  console.log('🚀 开始迁移 knowledge/ 中的知识到 SQLite...\n');

  // Initialize DB
  initSchema();
  console.log('✅ 数据库已初始化\n');

  // Scan for .md files
  const mdFiles = scanDir(KNOWLEDGE_DIR);
  const knowledgeFiles = mdFiles.filter(f => !f.includes('README.md') && !f.includes('INDEX.md'));
  
  console.log(`找到 ${knowledgeFiles.length} 个知识文件\n`);

  let imported = 0;
  let skipped = 0;

  for (const filePath of knowledgeFiles) {
    const parsed = parseMarkdownFile(filePath);
    if (!parsed) {
      console.log(`  ⏭  跳过 (无法解析): ${relative(KNOWLEDGE_DIR, filePath)}`);
      skipped++;
      continue;
    }

    // Determine changed_by based on source info
    // The 来源 field tells us these were manually curated
    const pageId = upsertPage({
      ...parsed,
      status: 'verified', // These are manually curated, so mark as verified
      source_grade: 'A', // Manually curated from cited sources
      changed_by: 'migration',
    });

    console.log(`  ✅ [${parsed.domain}] ${parsed.title} (ID: ${pageId})`);
    imported++;
  }

  // Update the spec status
  console.log(`\n📊 迁移完成: ${imported} 条导入, ${skipped} 条跳过`);

  // Rebuild indexes
  rebuild();
  console.log('✅ 索引重建完成\n');

  console.log('现在可以用以下命令查询:');
  console.log('  npm run knowledge query <关键词>');
  console.log('  npm run knowledge list');
  console.log('  npm run knowledge list --domain=frontend');
}

main().catch(e => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});

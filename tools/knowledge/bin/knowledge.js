#!/usr/bin/env node

/**
 * Knowledge Base CLI
 * Usage: knowledge <command> [options]
 */

import { initSchema, closeDb, searchPages, getPage, listPages, upsertPage,
         findDuplicate, gradeSource, getStalePages, markStale,
         getGraph, exportAll, rebuild } from '../src/db.js';

const [,, command, ...args] = process.argv;

function printHelp() {
  console.log(`
知识库 CLI — SQLite 驱动的 Wiki 知识管理系统

用法:
  knowledge <command> [options]

命令:
  query <关键词>         FTS5 全文搜索知识
  get <page-id>         查看单条知识详情
  list [--domain=]      列出知识条目
  capture               交互式写入新知识
  stale                 查看过期知识 (90 天未更新)
  export [--dir=路径]    导出为 markdown 文件
  graph                 查看引用图谱
  rebuild               重建所有索引
  help                  显示帮助
`);
}

async function main() {
  // Ensure DB schema exists on first run
  initSchema();

  switch (command) {
    case 'query':
    case 'search':
      await cmdQuery(args);
      break;
    case 'get':
      await cmdGet(args);
      break;
    case 'list':
    case 'ls':
      await cmdList(args);
      break;
    case 'capture':
      await cmdCapture(args);
      break;
    case 'stale':
      await cmdStale();
      break;
    case 'export':
      await cmdExport(args);
      break;
    case 'graph':
      await cmdGraph();
      break;
    case 'rebuild':
      await cmdRebuild();
      break;
    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
      break;
  }

  closeDb();
}

async function cmdQuery(args) {
  const query = args.join(' ');
  if (!query) {
    console.log('请输入搜索关键词。用法: knowledge query <关键词>');
    return;
  }
  const results = searchPages(query);
  if (results.length === 0) {
    console.log('未找到匹配的知识条目。');
    return;
  }
  console.log(`找到 ${results.length} 条结果:\n`);
  for (const r of results) {
    const snippet = r.snippet || '';
    console.log(`  [${r.domain}] ${r.title}`);
    if (snippet) console.log(`    ${snippet.replace(/\n/g, ' ')}`);
    console.log(`    状态: ${r.status} | 更新: ${r.updated_at?.slice(0, 10) || '未知'}`);
    console.log(`    ID: ${r.id}\n`);
  }
}

async function cmdGet(args) {
  const pageId = args[0];
  if (!pageId) {
    console.log('请输入 page ID。用法: knowledge get <page-id>');
    return;
  }
  const page = getPage(pageId);
  if (!page) {
    console.log(`未找到: ${pageId}`);
    return;
  }
  console.log(`# ${page.title}`);
  console.log(`ID: ${page.id}`);
  console.log(`域: ${page.domain} | 状态: ${page.status} | 等级: ${page.source_grade}`);
  console.log(`标签: ${page.tags || '无'}`);
  if (page.aliases?.length) console.log(`别名: ${page.aliases.join(', ')}`);
  console.log(`创建: ${page.created_at?.slice(0, 10)} | 更新: ${page.updated_at?.slice(0, 10)}`);
  if (page.sources?.length) console.log(`来源: ${page.sources.map(s => typeof s === 'string' ? s : s.url || s.ref).join(', ')}`);
  console.log(`\n--- 正文 ---\n${page.content}`);
  if (page.links_to?.length) {
    console.log(`\n→ 引用: ${page.links_to.map(l => l.title).join(', ')}`);
  }
  if (page.linked_from?.length) {
    console.log(`← 被引用: ${page.linked_from.map(l => l.title).join(', ')}`);
  }
}

async function cmdList(args) {
  const opts = { limit: 50 };
  for (const arg of args) {
    if (arg.startsWith('--domain=')) opts.domain = arg.split('=')[1];
    else if (arg.startsWith('--tag=')) opts.tag = arg.split('=')[1];
    else if (arg.startsWith('--status=')) opts.status = arg.split('=')[1];
    else if (arg.startsWith('--limit=')) opts.limit = parseInt(arg.split('=')[1], 10);
  }

  const pages = listPages(opts);
  if (pages.length === 0) {
    console.log('暂无知识条目。');
    return;
  }
  console.log(`共 ${pages.length} 条知识:\n`);
  for (const p of pages) {
    console.log(`  [${p.domain}] ${p.title}`);
    console.log(`    标签: ${p.tags || '无'} | 等级: ${p.source_grade} | 状态: ${p.status}`);
    console.log(`    ID: ${p.id} | 更新: ${p.updated_at?.slice(0, 10)}`);
    console.log();
  }
}

async function cmdCapture(args) {
  // Parse CLI args first
  const title = args.find(a => a.startsWith('--title='))?.split('=').slice(1).join('=');
  const domain = args.find(a => a.startsWith('--domain='))?.split('=').slice(1).join('=');
  const content = args.find(a => a.startsWith('--content='))?.split('=').slice(1).join('=');
  const tagArg = args.find(a => a.startsWith('--tags='));
  const srcArg = args.find(a => a.startsWith('--sources='));
  const force = args.includes('--force');

  if (title && domain && content) {
    // Non-interactive mode from CLI args
    let sources = undefined;
    if (srcArg) {
      const srcStr = srcArg.split('=').slice(1).join('=');
      try { sources = JSON.parse(srcStr); } catch { sources = srcStr; }
    }
    await writeKnowledge({
      title, domain, content,
      tags: tagArg?.split('=').slice(1).join('=') || '',
      sources,
      force,
    });
    return;
  }

  // Stdin mode (agent pipe)
  const hasStdin = !process.stdin.isTTY;
  if (hasStdin) {
    let input = '';
    process.stdin.setEncoding('utf-8');
    for await (const chunk of process.stdin) {
      input += chunk;
    }
    try {
      const data = JSON.parse(input);
      data.force = data.force || force;
      await writeKnowledge(data);
    } catch (e) {
      console.error('解析输入失败:', e.message);
      process.exit(1);
    }
    return;
  }

  // Interactive mode
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const data = {
    title: await rl.question('标题: '),
    domain: await rl.question('领域 (如 general.design-patterns): '),
    content: await rl.question('正文 (Markdown): '),
    tags: await rl.question('标签 (逗号分隔): '),
    sources: await rl.question('来源 (JSON 数组, 可选): '),
  };

  if (data.tags) data.tags = data.tags.trim();
  if (data.sources) {
    try { data.sources = JSON.parse(data.sources); } catch { data.sources = undefined; }
  } else {
    data.sources = undefined;
  }

  rl.close();
  await writeKnowledge(data);
}

async function writeKnowledge(data) {
  const title = data.title?.trim();
  const domain = data.domain?.trim();
  const content = data.content?.trim();

  if (!title || !domain || !content) {
    console.error('错误: title, domain, content 为必填');
    process.exit(1);
  }

  // Parse sources if provided as string
  let sources = data.sources;
  if (typeof sources === 'string') {
    try { sources = JSON.parse(sources); } catch { sources = [sources]; }
  }

  // Step 1: Source grading
  const sourceGrade = gradeSource(sources);
  console.log(`来源可信度: ${sourceGrade}`);

  if (sourceGrade === 'C' && (!sources || sources.length === 0)) {
    console.log('⚠  无来源引用，标记为 C 级。C 级知识需要 S/A 锚点。');
  }

  // Step 2: Dedup check
  const aliases = data.aliases || [];
  const force = data.force || false;
  const dup = findDuplicate(title, aliases);
  if (dup.exact) {
    if (!force) {
      console.log(`⚠  检测到重复: 已有标题为 "${dup.exact.title}" 的知识 (${dup.exact.id})`);
      console.log('知识未被写入。如需强制写入，请用 --force 参数。');
      return;
    }
    console.log(`⚠  检测到重复, 但 --force 已指定, 覆盖写入`);
  }
  if (!force && dup.fuzzy.length > 0 && dup.fuzzy[0].rank < -5) {
    console.log(`⚠  存在高相似条目: "${dup.fuzzy[0].title}" (相似度较高)`);
    console.log('如需强制写入，请用 --force 参数。');
    return;
  }

  // Step 3: Write to DB
  const pageId = upsertPage({
    title,
    domain,
    tags: data.tags || '',
    aliases: data.aliases || [],
    content,
    sources: sources || [],
    source_grade: sourceGrade,
    status: 'auto-extracted',
    changed_by: 'manual',
  });

  console.log(`✅ 知识已写入 (ID: ${pageId})`);
  console.log(`状态: auto-extracted（需验证）`);

  return pageId;
}

async function cmdStale() {
  const stale = getStalePages();
  if (stale.length === 0) {
    console.log('✅ 没有过期的知识条目。');
    return;
  }

  console.log(`发现 ${stale.length} 条过期知识 (>90 天未更新):\n`);
  for (const s of stale) {
    console.log(`  [${s.domain}] ${s.title}`);
    console.log(`    最后更新: ${s.updated_at?.slice(0, 10)}`);
    console.log(`    ID: ${s.id}\n`);
  }
}

async function cmdExport(args) {
  const dir = args.find(a => a.startsWith('--dir='))?.split('=')[1] || './knowledge_export';
  await exportAll(dir);
  console.log(`✅ 已导出到: ${dir}`);
}

async function cmdGraph() {
  const graph = getGraph();
  console.log(`节点: ${graph.nodes.length}`);
  console.log(`链接: ${graph.links.length}\n`);

  // Show domains
  const domains = {};
  for (const n of graph.nodes) {
    domains[n.domain] = (domains[n.domain] || 0) + 1;
  }
  console.log('知识分布:');
  for (const [d, count] of Object.entries(domains)) {
    console.log(`  ${d}: ${count} 条`);
  }

  if (graph.links.length > 0) {
    console.log(`\n引用关系: ${graph.links.length} 条链接`);
  }
}

async function cmdRebuild() {
  rebuild();
  console.log('✅ 索引重建完成');
}

main().catch(e => {
  console.error('错误:', e.message);
  process.exit(1);
});

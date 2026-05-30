import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '..', '..', '..', 'knowledge', 'knowledge.db');

let _db = null;

/**
 * Get or create the database connection.
 */
export function getDb() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  return _db;
}

/**
 * Close the database connection.
 */
export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Initialize the database schema.
 * Safe to call multiple times - uses IF NOT EXISTS.
 */
export function initSchema() {
  const db = getDb();

  db.exec(`
    -- 页面主表
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      domain TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      aliases TEXT,
      content TEXT NOT NULL,
      sources TEXT,
      status TEXT NOT NULL DEFAULT 'verified',
      source_grade TEXT NOT NULL DEFAULT 'B',
      oracle_scores TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      verified_at TEXT
    );

    -- 全文搜索（不用 content=pages，直接存内容保证 sync 可控）
    CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
      title, tags, aliases, content,
      tokenize='unicode61 tokenchars'
    );

    -- 变更历史
    CREATE TABLE IF NOT EXISTS page_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id TEXT NOT NULL REFERENCES pages(id),
      changed_at TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      diff_summary TEXT,
      prev_content_hash TEXT,
      new_content_hash TEXT
    );

    -- 双向链接
    CREATE TABLE IF NOT EXISTS wiki_links (
      source_id TEXT NOT NULL REFERENCES pages(id),
      target_id TEXT NOT NULL REFERENCES pages(id),
      PRIMARY KEY (source_id, target_id)
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_pages_domain ON pages(domain);
    CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);
    CREATE INDEX IF NOT EXISTS idx_pages_updated ON pages(updated_at);
  `);

  // Create the tag_summary view (recreate to reflect latest data)
  db.exec(`
    DROP VIEW IF EXISTS tag_summary;
    CREATE VIEW tag_summary AS
      SELECT t.tag, COUNT(*) AS cnt
      FROM pages, json_each('["' || replace(tags, ',', '","') || '"]') AS t
      GROUP BY t.tag ORDER BY cnt DESC;
  `);

  return db;
}

/**
 * Hash page content for change detection.
 */
function hashContent(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Compute the page ID from domain and title.
 */
export function makePageId(domain, title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${domain}.${slug}`;
}

/**
 * Insert or update a page. Returns the page ID.
 */
export function upsertPage({
  id,
  title,
  domain,
  tags = '',
  aliases = null,
  content,
  sources = null,
  status = 'verified',
  source_grade = 'B',
  oracle_scores = null,
  changed_by = 'manual',
}) {
  const db = getDb();
  const now = new Date().toISOString();

  // Compute ID if not provided
  const pageId = id || makePageId(domain, title);

  // Check existing
  const existing = db.prepare('SELECT content, updated_at, created_at FROM pages WHERE id = ?').get(pageId);

  const prevHash = existing ? hashContent(existing.content) : null;
  const newHash = hashContent(content);

  db.prepare(`
    INSERT INTO pages (id, title, domain, tags, aliases, content, sources, status, source_grade, oracle_scores, created_at, updated_at, verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      domain = excluded.domain,
      tags = excluded.tags,
      aliases = excluded.aliases,
      content = excluded.content,
      sources = excluded.sources,
      status = excluded.status,
      source_grade = excluded.source_grade,
      oracle_scores = excluded.oracle_scores,
      updated_at = excluded.updated_at,
      verified_at = COALESCE(excluded.verified_at, pages.verified_at)
  `).run(
    pageId, title, domain, tags,
    aliases ? JSON.stringify(aliases) : null,
    content,
    sources ? JSON.stringify(sources) : null,
    status, source_grade,
    oracle_scores ? JSON.stringify(oracle_scores) : null,
    existing ? existing.created_at : now,
    now,
    status === 'verified' ? now : null
  );

  // Record history
  db.prepare(`
    INSERT INTO page_history (page_id, changed_at, changed_by, diff_summary, prev_content_hash, new_content_hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(pageId, now, changed_by, '', prevHash, newHash);

  // Sync FTS
  syncFts();

  // Extract wiki links
  extractWikiLinks(pageId, content);

  return pageId;
}

/**
 * Sync FTS indexes for all pages.
 * Deletes and repopulates the FTS table from the pages table.
 */
export function syncFts() {
  const db = getDb();
  db.exec(`
    DELETE FROM pages_fts;
    INSERT INTO pages_fts(rowid, title, tags, aliases, content)
    SELECT rowid, title, tags, aliases, content FROM pages
    WHERE status != 'rejected';
  `);
}

/**
 * Extract [[wiki links]] from content and store in wiki_links table.
 */
export function extractWikiLinks(sourceId, content) {
  const db = getDb();
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  let match;

  // Delete existing links from this source
  db.prepare('DELETE FROM wiki_links WHERE source_id = ?').run(sourceId);

  while ((match = linkRegex.exec(content)) !== null) {
    const targetTitle = match[1].trim();
    // Try to find target page by title
    const target = db.prepare('SELECT id FROM pages WHERE title = ? LIMIT 1').get(targetTitle);
    if (target) {
      db.prepare('INSERT OR IGNORE INTO wiki_links (source_id, target_id) VALUES (?, ?)').run(sourceId, target.id);
    }
  }
}

/**
 * Check if a string contains CJK characters.
 */
function hasCJK(text) {
  return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(text);
}

/**
 * Escape special FTS5 characters in a query string.
 */
function escapeFts5(text) {
  return text.replace(/['"*^()~\-+]/g, ' ').trim();
}

/**
 * Search pages using FTS5 with LIKE fallback for CJK queries.
 * Returns array of { id, title, domain, tags, snippet }.
 */
export function searchPages(query, limit = 10) {
  const db = getDb();
  if (!query || query.trim() === '') {
    return db.prepare(`
      SELECT id, title, domain, tags, updated_at, status
      FROM pages
      WHERE status != 'rejected'
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(limit);
  }

  const hasChinese = hasCJK(query);
  const escaped = escapeFts5(query);

  if (hasChinese) {
    // CJK queries: use LIKE-based search (FTS5 unicode61 tokenchars still
    // doesn't handle Chinese word segmentation well for substring queries)
    const likePattern = `%${query}%`;
    return db.prepare(`
      SELECT p.id, p.title, p.domain, p.tags, p.status, p.updated_at,
             NULL AS snippet
      FROM pages p
      WHERE p.status != 'rejected'
        AND (p.title LIKE ? OR p.content LIKE ? OR p.tags LIKE ? OR p.aliases LIKE ?)
      ORDER BY
        CASE WHEN p.title LIKE ? THEN 0 ELSE 1 END,
        p.updated_at DESC
      LIMIT ?
    `).all(likePattern, likePattern, likePattern, likePattern, likePattern, limit);
  }

  // Non-CJK queries: use FTS5
  try {
    const results = db.prepare(`
      SELECT p.id, p.title, p.domain, p.tags, p.status, p.updated_at,
             snippet(pages_fts, 1, '<mark>', '</mark>', '...', 32) AS snippet
      FROM pages_fts
      JOIN pages p ON pages_fts.rowid = p.rowid
      WHERE pages_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(escaped, limit);

    return results;
  } catch {
    // FTS5 query syntax error — fall back to LIKE
    const likePattern = `%${query}%`;
    return db.prepare(`
      SELECT p.id, p.title, p.domain, p.tags, p.status, p.updated_at,
             NULL AS snippet
      FROM pages p
      WHERE p.status != 'rejected'
        AND (p.title LIKE ? OR p.content LIKE ?)
      ORDER BY
        CASE WHEN p.title LIKE ? THEN 0 ELSE 1 END,
        p.updated_at DESC
      LIMIT ?
    `).all(likePattern, likePattern, likePattern, limit);
  }
}

/**
 * Get a single page by ID.
 */
export function getPage(pageId) {
  const db = getDb();
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId);
  if (!page) return null;

  // Parse JSON fields
  if (page.aliases) page.aliases = JSON.parse(page.aliases);
  if (page.sources) page.sources = JSON.parse(page.sources);
  if (page.oracle_scores) page.oracle_scores = JSON.parse(page.oracle_scores);

  // Get incoming links
  page.linked_from = db.prepare(`
    SELECT p.id, p.title FROM wiki_links wl
    JOIN pages p ON p.id = wl.source_id
    WHERE wl.target_id = ?
  `).all(pageId);

  // Get outgoing links
  page.links_to = db.prepare(`
    SELECT p.id, p.title FROM wiki_links wl
    JOIN pages p ON p.id = wl.target_id
    WHERE wl.source_id = ?
  `).all(pageId);

  return page;
}

/**
 * List pages with optional filters.
 */
export function listPages({ domain, tag, status, limit = 50 } = {}) {
  const db = getDb();
  let sql = 'SELECT id, title, domain, tags, status, updated_at, source_grade FROM pages WHERE 1=1';
  const params = [];

  if (domain) {
    sql += ' AND domain = ?';
    params.push(domain);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  } else {
    sql += ' AND status != ?';
    params.push('rejected');
  }

  sql += ' ORDER BY updated_at DESC LIMIT ?';
  params.push(limit);

  let rows = db.prepare(sql).all(...params);

  // Client-side tag filter (since tags are comma-separated)
  if (tag) {
    rows = rows.filter(r => r.tags.split(',').map(t => t.trim()).includes(tag));
  }

  return rows;
}

/**
 * Query method for dedup checking.
 * Returns { exact: null|page, fuzzy: page[] }
 */
export function findDuplicate(title, aliases = []) {
  const db = getDb();

  // Exact match on title or aliases
  const exact = db.prepare('SELECT id, title, content, tags FROM pages WHERE title = ? OR aliases LIKE ? LIMIT 1')
    .get(title, `%${title}%`);

  // Fuzzy: use LIKE for CJK, FTS5 for non-CJK
  const cleanTitle = title.replace(/[^\w\u4e00-\u9fff]+/g, ' ').trim();
  let fuzzy = [];
  if (hasCJK(cleanTitle)) {
    const p = `%${title}%`;
    fuzzy = db.prepare(`
      SELECT p.id, p.title, p.content, p.tags, 0.0 AS rank
      FROM pages p
      WHERE p.status != 'rejected' AND (p.title LIKE ? OR p.content LIKE ?)
      LIMIT 3
    `).all(p, p);
  } else {
    try {
      fuzzy = db.prepare(`
        SELECT p.id, p.title, p.content, p.tags, rank
        FROM pages_fts JOIN pages p ON pages_fts.rowid = p.rowid
        WHERE pages_fts MATCH ?
        ORDER BY rank
        LIMIT 3
      `).all(escapeFts5(cleanTitle));
    } catch {
      // FTS5 error, skip fuzzy
    }
  }

  return { exact, fuzzy };
}

/**
 * Get stale pages (updated > 90 days ago).
 */
export function getStalePages() {
  const db = getDb();
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  return db.prepare(`
    SELECT id, title, domain, tags, updated_at FROM pages
    WHERE updated_at < ? AND status NOT IN ('stale', 'rejected')
    ORDER BY updated_at ASC
  `).all(cutoff);
}

/**
 * Mark pages as stale.
 */
export function markStale(pageIds) {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare('UPDATE pages SET status = ?, updated_at = ? WHERE id = ?');
  const txn = db.transaction((ids) => {
    for (const id of ids) {
      stmt.run('stale', now, id);
    }
  });
  txn(pageIds);
}

/**
 * Get the full graph for visualization.
 */
export function getGraph() {
  const db = getDb();
  const nodes = db.prepare('SELECT id, title, domain FROM pages WHERE status NOT IN (\'rejected\')').all();
  const links = db.prepare('SELECT source_id, target_id FROM wiki_links').all();
  return { nodes, links };
}

/**
 * Export all pages as markdown files (temporary, for review).
 */
export function exportAll(outputDir) {
  const db = getDb();
  const pages = db.prepare('SELECT * FROM pages WHERE status NOT IN (\'rejected\')').all();

  for (const page of pages) {
    const dirPath = join(outputDir, page.domain.replace(/\./g, sep));
    mkdirSync(dirPath, { recursive: true });

    const filename = page.id.split('.').slice(1).join('.') + '.md';
    const content = [
      `# ${page.title}`,
      '',
      `> 状态: ${page.status} | 等级: ${page.source_grade} | 更新: ${page.updated_at}`,
      '',
      page.content,
      '',
      '---',
      '',
      '**标签**: ' + (page.tags || '无'),
    ].join('\n');

    writeFileSync(join(dirPath, filename), content, 'utf-8');
  }
}

/**
 * Rebuild all indexes and wiki links.
 */
export function rebuild() {
  const db = getDb();

  // Rebuild FTS
  db.exec('INSERT INTO pages_fts(pages_fts) VALUES(\'rebuild\')');

  // Rebuild wiki_links
  db.exec('DELETE FROM wiki_links');
  const pages = db.prepare('SELECT id, content FROM pages').all();
  for (const p of pages) {
    if (p.content) {
      extractWikiLinks(p.id, p.content);
    }
  }

  // Check stale
  const stale = getStalePages();
  if (stale.length > 0) {
    markStale(stale.map(s => s.id));
  }
}

/**
 * Grade source quality based on URL patterns.
 */
export function gradeSource(sources) {
  if (!sources || sources.length === 0) return 'C';

  // Ordered from most authoritative to least
  const patterns = {
    S: [/w3\.org/, /rfc-editor\.org/, /doi\.org/, /ieee\.org/, /arxiv\.org/,
        /refactoring\.guru/, /martinfowler\.com/],
    A: [/github\.com\/(?!.*\/blob\/.*)/, /oreilly\.com/, /manning\.com/, /amazon\.com/,
        /microsoft\.com\/en-us/, /google\.com\/docs/, /kubernetes\.io/, /nginx\.org/,
        /docker\.com/, /nodejs\.org/, /npmjs\.com/, /python\.org/, /reactjs\.org/],
    B: [/medium\.com/, /stackoverflow\.com/, /dev\.to/, /blog\./, /hashnode\.com/,
        /css-tricks\.com/, /smashingmagazine\.com/, /sitepoint\.com/],
  };

  let highestGrade = 'C';

  for (const source of sources) {
    const url = typeof source === 'string' ? source : (source.url || source.ref || '');
    for (const [grade, regexps] of Object.entries(patterns)) {
      for (const re of regexps) {
        if (re.test(url)) {
          if (grade === 'S' || (grade === 'A' && highestGrade !== 'S') || (grade === 'B' && highestGrade === 'C')) {
            highestGrade = grade;
          }
        }
      }
    }
  }

  return highestGrade;
}

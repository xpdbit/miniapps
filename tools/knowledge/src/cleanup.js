import Database from 'better-sqlite3';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, '..', '..', '..', 'knowledge', 'knowledge.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = OFF');

const ids = ["general.design-patterns.单例模式", "general.design-patterns.factory-method"];

for (const id of ids) {
  db.exec(`DELETE FROM page_history WHERE page_id = '${id}'`);
  db.exec(`DELETE FROM wiki_links WHERE source_id = '${id}' OR target_id = '${id}'`);
  db.exec(`DELETE FROM pages WHERE id = '${id}'`);
}

db.exec("INSERT INTO pages_fts(pages_fts) VALUES('rebuild')");
db.pragma('foreign_keys = ON');

console.log('Cleaned up test entries');
db.close();

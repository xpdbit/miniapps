-- ============================================================
-- 清理 ecs100mysql 中已有的随机/测试用户
-- 执行: mysql -u root -p < cleanup-random-users.sql
-- ⚠️ 请先确认数据库状态后再执行清理步骤
-- ============================================================

-- ─── STEP 1: 查看受影响用户 ────────────────────────────────

-- 旧 schema (shared_users) — 待清理用户
SELECT '=== shared_users 中的随机用户 ===' AS info;
SELECT id, openid, nickname, createdAt
FROM miniapps.shared_users
WHERE openid LIKE 'dev\_%'
   OR openid LIKE 'test\_%'
   OR openid LIKE 'mock\_%'
   OR nickname LIKE '用户\_%'
   OR nickname LIKE '微信用户%'
   OR openid IS NOT NULL AND openid NOT IN (SELECT openid FROM miniapps.shared_users WHERE openid LIKE 'ox%')
ORDER BY createdAt;

-- 新 schema (users + user_auths) — 如果新表已创建
SELECT '=== users 表中的随机用户（如存在）===' AS info;
SELECT u.id, u.uuid, u.nickname, u.createdAt, ua.auth_type, ua.credential
FROM miniapps.users u
LEFT JOIN miniapps.user_auths ua ON ua.user_uuid = u.uuid
WHERE ua.auth_type = 'wechat'
  AND (
    ua.credential LIKE 'dev\_%'
    OR ua.credential LIKE 'test\_%'
    OR ua.credential LIKE 'mock\_%'
    OR u.nickname LIKE '用户\_%'
    OR u.nickname LIKE '微信用户%'
  )
ORDER BY u.createdAt;

-- 统计
SELECT '=== 统计数据 ===' AS info;
SELECT 
  'old shared_users' AS src,
  COUNT(*) AS cnt
FROM miniapps.shared_users
WHERE openid LIKE 'dev\_%' OR openid LIKE 'test\_%' OR openid LIKE 'mock\_%'
   OR nickname LIKE '用户\_%' OR nickname LIKE '微信用户%';

-- ─── STEP 2: 清理（确认后手动取消注释执行） ──────────────────

-- ⚠️ 以下为清理语句，请确认 STEP 1 的统计结果后手动执行

-- -- 删除旧 schema 随机用户
-- DELETE FROM miniapps.shared_users
-- WHERE openid LIKE 'dev\_%'
--    OR openid LIKE 'test\_%'
--    OR openid LIKE 'mock\_%'
--    OR (nickname LIKE '用户\_%' AND openid NOT LIKE 'ox%')
--    OR (nickname LIKE '微信用户%' AND openid NOT LIKE 'ox%');

-- -- 删除新 schema 随机用户（如果已迁移）
-- -- 步骤: 先收集 UUID → 先删子表 user_auths → 再删父表 users（FK 约束要求）
-- CREATE TEMPORARY TABLE _cleanup_uuids AS
-- SELECT ua.user_uuid
-- FROM miniapps.user_auths ua
-- WHERE ua.auth_type = 'wechat'
--   AND (
--     ua.credential LIKE 'dev\_%'
--     OR ua.credential LIKE 'test\_%'
--     OR ua.credential LIKE 'mock\_%'
--   );
-- 
-- DELETE ua FROM miniapps.user_auths ua
-- WHERE ua.user_uuid IN (SELECT user_uuid FROM _cleanup_uuids);
-- 
-- DELETE u FROM miniapps.users u
-- WHERE u.uuid IN (SELECT user_uuid FROM _cleanup_uuids);
-- 
-- DROP TEMPORARY TABLE IF EXISTS _cleanup_uuids;

-- -- 删除 tavern 库中的关联数据（cascade 由应用层处理）
-- -- Card, CardLike, CardFav, Persona, ChatSession 等相关数据
-- -- 如果外键未配置 CASCADE，需手动清理：
-- -- DELETE FROM ai_tavern.Card WHERE user_uuid IN (...);
-- -- DELETE FROM ai_tavern.ChatSession WHERE user_uuid IN (...);
-- -- 等等

-- ─── STEP 3: 保留内置用户 ──────────────────────────────────

-- 内置用户（不应被清理）：
-- SELECT * FROM miniapps.shared_users WHERE openid = 'builtin_system' OR openid = 'builtin_tester';
-- 对应新 schema：
-- SELECT u.*, ua.credential FROM miniapps.users u
-- JOIN miniapps.user_auths ua ON ua.user_uuid = u.uuid
-- WHERE ua.credential IN ('builtin_system', 'builtin_tester');

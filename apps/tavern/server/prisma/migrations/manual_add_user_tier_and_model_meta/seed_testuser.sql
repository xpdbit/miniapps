-- Seed test user: builtin_tester (TESTER, full permissions, unlimited quota)
-- Uses actual shared_users table columns on ECS (no dailyQuota column)
INSERT INTO shared_users (id, uuid, openid, nickname, role, meta, created_at, updated_at)
VALUES ('testuser-00000001', 'tester-uuid-00000001', 'builtin_tester', '内测玩家', 'ADMIN', '{}', NOW(), NOW())
ON DUPLICATE KEY UPDATE role = 'ADMIN', nickname = '内测玩家';

INSERT INTO UserTier (id, user_id, tier, level, maxDailyQuota, maxSessions, maxCharacters, maxPersonas, permissions, created_at, updated_at)
VALUES (
  'testtier-00000001',
  'testuser-00000001',
  'TESTER',
  1,
  99999, 99, 99, 99,
  '{"canUseCustomKey":true,"canPublishCards":true,"canExport":true,"modelTier":"all","prioritySupport":true,"betaFeatures":true,"maxTokenPerCall":32768,"maxContextLength":128000}',
  NOW(), NOW()
)
ON DUPLICATE KEY UPDATE tier = 'TESTER', maxDailyQuota = 99999, permissions = VALUES(permissions);

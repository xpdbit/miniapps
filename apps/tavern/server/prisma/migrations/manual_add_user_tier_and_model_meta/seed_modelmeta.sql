-- ============================================================
-- Seed: ModelMeta — 21 AI models
-- ============================================================

-- 强制 UTF-8 连接编码，防止 MySQL CLI 默认 latin1 导致中文乱码
/*!40101 SET NAMES utf8mb4 */;

INSERT INTO ModelMeta (modelId, displayName, provider, description, icon, minTier, minLevel, quotaCost, isActive, sortOrder, created_at, updated_at)
VALUES
  ('qwen-turbo',           '通义千问 Turbo',    'tongyi',     '快速响应，适合日常对话',     '⚡', 'FREE', 1, 1, true, 10, NOW(), NOW()),
  ('qwen-plus',            '通义千问 Plus',     'tongyi',     '更强能力，适合复杂任务',     '✨', 'FREE', 1, 1, true, 20, NOW(), NOW()),
  ('qwen-max',             '通义千问 Max',      'tongyi',     '最强模型，适合极限挑战',     '🔥', 'FREE', 1, 2, true, 30, NOW(), NOW()),
  ('big-pickle',           'Big Pickle',        'opencode',   '免费大模型 · OpenCode Go',  '🥒', 'FREE', 1, 1, true, 40, NOW(), NOW()),
  ('minimax-m2.5-free',    'MiniMax M2.5 Free', 'opencode',   '免费对话 · OpenCode Go',     '🆓', 'FREE', 1, 1, true, 50, NOW(), NOW()),
  ('deepseek-v4-flash-free', 'DeepSeek V4 Flash', 'opencode', '免费推理 · OpenCode Go',     '⚙️', 'FREE', 1, 1, true, 60, NOW(), NOW()),
  ('chatglm-turbo',        'ChatGLM Turbo',     'zhipu',      '轻量高效推理',               '💨', 'PAID', 1, 2, true, 90, NOW(), NOW()),
  ('glm-4',                'GLM-4',             'zhipu',      '智谱旗舰大模型',             '🔮', 'PAID', 1, 3, true, 100, NOW(), NOW()),
  ('gpt-4o',               'GPT-4o',            'openai',     '多模态旗舰模型',             '🧠', 'PAID', 1, 3, true, 110, NOW(), NOW()),
  ('gpt-4-turbo',          'GPT-4 Turbo',       'openai',     '高性能推理',                 '💎', 'PAID', 1, 3, true, 120, NOW(), NOW()),
  ('deepseek-chat',        'DeepSeek V3',       'deepseek',   '国产开源，代码能力强',       '🐋', 'PAID', 1, 2, true, 130, NOW(), NOW()),
  ('deepseek-reasoner',    'DeepSeek R1',       'deepseek',   '深度推理，复杂问题克星',     '🔍', 'PAID', 1, 2, true, 140, NOW(), NOW()),
  ('claude-3.5-sonnet',    'Claude 3.5 Sonnet', 'anthropic',  '平衡性能与速度',             '🎭', 'PAID', 1, 3, true, 150, NOW(), NOW()),
  ('claude-3-opus',        'Claude 3 Opus',     'anthropic',  '最强分析推理',               '🏛️', 'PAID', 1, 3, true, 160, NOW(), NOW()),
  ('gemini-2.5-pro',       'Gemini 2.5 Pro',    'google',     'Google 旗舰模型',            '🌐', 'PAID', 1, 2, true, 170, NOW(), NOW()),
  ('gemini-2.5-flash',     'Gemini 2.5 Flash',  'google',     '轻量快速响应',               '⚡', 'PAID', 1, 1, true, 180, NOW(), NOW()),
  ('moonshot-v1-8k',       'Kimi 8K',           'moonshot',   '长上下文理解',               '🌙', 'PAID', 1, 2, true, 190, NOW(), NOW()),
  ('moonshot-v1-32k',      'Kimi 32K',          'moonshot',   '超长上下文处理',             '🌕', 'PAID', 1, 3, true, 200, NOW(), NOW()),
  ('abab6.5s',             'abab6.5s',          'minimax',    'MiniMax 快速模型',           '🎯', 'PAID', 1, 2, true, 210, NOW(), NOW()),
  ('abab7',                'abab7',             'minimax',    'MiniMax 旗舰模型',           '🚀', 'PAID', 1, 3, true, 220, NOW(), NOW()),
  ('openrouter-auto',      'OpenRouter Auto',   'openrouter', '智能路由最佳模型',           '🔀', 'PAID', 1, 2, true, 230, NOW(), NOW())
ON DUPLICATE KEY UPDATE displayName = VALUES(displayName), description = VALUES(description), icon = VALUES(icon), minTier = VALUES(minTier), quotaCost = VALUES(quotaCost), sortOrder = VALUES(sortOrder);

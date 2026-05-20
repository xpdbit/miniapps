// =============================================================================
// Dashboard Admin 种子脚本 (CommonJS)
// 在首次部署时自动创建初始 super_admin 账号
//
// 环境变量（由 deploy/.env 提供）：
//   ADMIN_SEED_USERNAME — 初始管理员用户名（默认: admin）
//   ADMIN_SEED_PASSWORD — 初始管理员密码（默认: Admin123!）
//   DATABASE_URL         — Prisma 数据源 URL（Docker 内自动注入）
//
// 使用方式：node prisma/seed.cjs
// =============================================================================

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const username = process.env.ADMIN_SEED_USERNAME || 'admin'
  const password = process.env.ADMIN_SEED_PASSWORD || 'Admin123!'

  console.log(`[Seed] 检查管理员账号 "${username}" ...`)

  const existing = await prisma.dashboardAdminUser.findUnique({ where: { username } })
  if (existing) {
    console.log(`[Seed] 管理员 "${username}" 已存在，跳过创建。`)
    return
  }

  const password_hash_val = await bcrypt.hash(password, 12)
  const admin = await prisma.dashboardAdminUser.create({
    data: { username, password_hash: password_hash_val, role: 'super_admin' },
  })

  console.log(`[Seed] 已创建 super_admin 账号: id=${admin.id}, username="${admin.username}"`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('[Seed] 种子执行失败:', e.message || e)
    prisma.$disconnect()
    process.exit(1)
  })

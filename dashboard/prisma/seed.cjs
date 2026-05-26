// =============================================================================
// Dashboard Admin 种子脚本 (CommonJS)
// 使用统一 User + UserAuth 模型创建初始 super_admin 账号
//
// 环境变量：
//   ADMIN_SEED_USERNAME — 初始管理员昵称（默认: admin）
//   ADMIN_SEED_PASSWORD — 初始管理员密码（默认: Admin123!）
//   MINIAPPS_DATABASE_URL — miniapps 库连接串
//
// 使用方式：node prisma/seed.cjs
// =============================================================================

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const prisma = new PrismaClient()

async function main() {
  const nickname = process.env.ADMIN_SEED_USERNAME || 'admin'
  const password = process.env.ADMIN_SEED_PASSWORD || 'Admin123!'

  console.log(`[Seed] 检查管理员账号 "${nickname}" ...`)

  // Check if a password auth already exists for this nickname
  const existingAuth = await prisma.userAuth.findFirst({
    where: { authType: 'password', credential: nickname },
  })
  if (existingAuth) {
    console.log(`[Seed] 管理员 "${nickname}" 已存在 (user_uuid=${existingAuth.userUuid})，跳过创建。`)
    return
  }

  // Also check by User.nickname
  const existingUser = await prisma.user.findFirst({
    where: { nickname },
    include: { auths: { where: { authType: 'password' } } },
  })
  if (existingUser && existingUser.auths.length > 0) {
    console.log(`[Seed] 管理员 "${nickname}" 已存在 (uuid=${existingUser.uuid})，跳过创建。`)
    return
  }

  const uuid = crypto.randomUUID()
  const passwordHash = await bcrypt.hash(password, 12)

  const admin = await prisma.user.create({
    data: {
      uuid,
      nickname,
      role: 'super_admin',
      auths: {
        create: {
          authType: 'password',
          credential: passwordHash,
        },
      },
    },
    include: { auths: true },
  })

  console.log(`[Seed] 已创建 super_admin 账号:`)
  console.log(`        uuid=${admin.uuid}  nickname="${admin.nickname}"`)
  console.log(`        登录: 用户名="${nickname}"  密码="${password}"`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('[Seed] 种子执行失败:', e.message || e)
    prisma.$disconnect()
    process.exit(1)
  })

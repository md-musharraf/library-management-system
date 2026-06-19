import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function run() {
  console.log('--- Database Tenants ---')
  const tenants = await prisma.tenant.findMany()
  console.log(JSON.stringify(tenants, null, 2))
  console.log('------------------------')
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

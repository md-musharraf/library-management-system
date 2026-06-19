import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function run() {
  console.log('--- Database Tenants ---')
  const tenants = await prisma.tenant.findMany()
  console.log(JSON.stringify(tenants, null, 2))
  
  console.log('--- Database Shifts ---')
  const shifts = await prisma.shift.findMany()
  console.log(JSON.stringify(shifts, null, 2))

  console.log('--- Database Plans ---')
  const plans = await prisma.plan.findMany({
    include: { shift: true }
  })
  console.log(JSON.stringify(plans, null, 2))
  
  console.log('------------------------')
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

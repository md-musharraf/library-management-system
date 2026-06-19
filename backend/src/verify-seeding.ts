import { PrismaClient } from '@prisma/client'
import http from 'http'

const prisma = new PrismaClient()

function postRequest(path: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body)
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${parsed.error || data}`))
          } else {
            resolve(parsed)
          }
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

async function run() {
  console.log('--- STARTING TENANT SEEDING VERIFICATION ---')
  const uniqueEmail = `test-${Date.now()}@library.com`
  
  try {
    console.log(`Registering new tenant with email: ${uniqueEmail}...`)
    const regRes = await postRequest('/api/auth/register-tenant', {
      libraryName: 'Seeded Test Library',
      ownerName: 'Seeded Owner',
      phone: '+918888777766',
      address: 'Test Seeding Address, Delhi',
      email: uniqueEmail,
      password: 'password123',
    })
    
    const tenantId = regRes.tenantId
    console.log(`Registration successful! Tenant ID: ${tenantId}`)
    
    // Now let's query the database using Prisma to check shifts and plans for this tenant
    console.log('Querying database for shifts...')
    const shifts = await prisma.shift.findMany({
      where: { tenantId }
    })
    
    console.log(`Found ${shifts.length} shifts:`)
    shifts.forEach(s => {
      console.log(` - ${s.name} (${s.startTime} - ${s.endTime})`)
    })
    
    if (shifts.length !== 3) {
      throw new Error(`Expected exactly 3 shifts, but found ${shifts.length}`)
    }
    
    console.log('Querying database for plans...')
    const plans = await prisma.plan.findMany({
      where: { tenantId },
      include: { shift: true }
    })
    
    console.log(`Found ${plans.length} plans:`)
    plans.forEach(p => {
      console.log(` - ${p.name} (Price: ₹${p.price}, Duration: ${p.durationDays} days, Shift: ${p.shift?.name})`)
    })
    
    if (plans.length !== 3) {
      throw new Error(`Expected exactly 3 plans, but found ${plans.length}`)
    }
    
    // Clean up test data
    console.log('Cleaning up test tenant data...')
    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { tenantId } }),
      prisma.booking.deleteMany({ where: { tenantId } }),
      prisma.seat.deleteMany({ where: { tenantId } }),
      prisma.plan.deleteMany({ where: { tenantId } }),
      prisma.shift.deleteMany({ where: { tenantId } }),
      prisma.whatsappConfig.deleteMany({ where: { tenantId } }),
      prisma.user.deleteMany({ where: { tenantId } }),
      prisma.tenant.delete({ where: { id: tenantId } })
    ])
    
    console.log('Clean up completed.')
    console.log('--- TENANT SEEDING VERIFICATION SUCCESSFUL ---')
  } catch (err: any) {
    console.error('--- TENANT SEEDING VERIFICATION FAILED ---')
    console.error(err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

run()

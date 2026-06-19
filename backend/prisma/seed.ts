import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with dynamic shifts...')

  // Clean existing data
  await prisma.messageLog.deleteMany({})
  await prisma.whatsappConfig.deleteMany({})
  await prisma.payment.deleteMany({})
  await prisma.booking.deleteMany({})
  await prisma.seat.deleteMany({})
  await prisma.plan.deleteMany({})
  await prisma.shift.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.student.deleteMany({})
  await prisma.tenant.deleteMany({})

  // 1. Create Tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Elite Library & Study Hub',
      ownerName: 'Vikram Singh',
      phone: '+919876543210',
      address: 'Plot 42, Sector 15, Noida, UP, India',
    },
  })
  console.log(`Tenant created: ${tenant.name} (${tenant.id})`)

  // 2. Create Admin User (password: password123)
  const hashedPassword = await bcrypt.hash('password123', 10)
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Vikram Singh',
      email: 'admin@elitelib.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })
  console.log(`Admin user created: ${admin.email}`)

  // 3. Create Dynamic Shifts
  const shiftA = await prisma.shift.create({
    data: {
      tenantId: tenant.id,
      name: 'Shift A',
      startTime: '06:00',
      endTime: '11:00',
    },
  })

  const shiftB = await prisma.shift.create({
    data: {
      tenantId: tenant.id,
      name: 'Shift B',
      startTime: '11:00',
      endTime: '16:00',
    },
  })

  const shiftC = await prisma.shift.create({
    data: {
      tenantId: tenant.id,
      name: 'Shift C',
      startTime: '16:00',
      endTime: '21:00',
    },
  })

  const shiftFullDay = await prisma.shift.create({
    data: {
      tenantId: tenant.id,
      name: 'Full Day',
      startTime: '00:00',
      endTime: '23:59',
    },
  })
  console.log('Dynamic Shifts created.')

  // 4. Create Plans linked to Shifts
  const planA = await prisma.plan.create({
    data: {
      tenantId: tenant.id,
      name: 'Monthly Shift A (6-11)',
      durationDays: 30,
      price: 1000.0,
      shiftId: shiftA.id,
    },
  })

  const planB = await prisma.plan.create({
    data: {
      tenantId: tenant.id,
      name: 'Monthly Shift B (11-4)',
      durationDays: 30,
      price: 1000.0,
      shiftId: shiftB.id,
    },
  })

  const planC = await prisma.plan.create({
    data: {
      tenantId: tenant.id,
      name: 'Monthly Shift C (4-9)',
      durationDays: 30,
      price: 1200.0,
      shiftId: shiftC.id,
    },
  })

  const planFull = await prisma.plan.create({
    data: {
      tenantId: tenant.id,
      name: 'Monthly Full Day (24 Hrs)',
      durationDays: 30,
      price: 2200.0,
      shiftId: shiftFullDay.id,
    },
  })
  console.log('Plans created.')

  // 5. Create Padded Seats (S-01 to S-12)
  const seats = []
  const areas = ['Silent Zone', 'Discussion Area']
  for (let i = 1; i <= 12; i++) {
    const seatNumber = `S-${i < 10 ? '0' + i : i}`
    const seat = await prisma.seat.create({
      data: {
        tenantId: tenant.id,
        seatNumber,
        status: i <= 2 ? 'OCCUPIED' : 'AVAILABLE',
        areaName: i <= 8 ? areas[0] : areas[1],
      },
    })
    seats.push(seat)
  }
  console.log('Seats created.')

  // 6. Create Students
  const student1 = await prisma.student.create({
    data: {
      tenantId: tenant.id,
      name: 'John Doe',
      phone: '+919999888877',
      email: 'john.doe@gmail.com',
      registrationNo: 'REG2026001',
      status: 'ACTIVE',
    },
  })

  const student2 = await prisma.student.create({
    data: {
      tenantId: tenant.id,
      name: 'Jane Smith',
      phone: '+918888777766',
      email: 'jane.smith@yahoo.com',
      registrationNo: 'REG2026002',
      status: 'ACTIVE',
    },
  })

  const student3 = await prisma.student.create({
    data: {
      tenantId: tenant.id,
      name: 'Alice Johnson',
      phone: '+917777666655',
      email: 'alice.j@outlook.com',
      registrationNo: 'REG2026003',
      status: 'ACTIVE',
    },
  })
  console.log('Students created.')

  // 7. Create Bookings linked to Shifts
  const startDate1 = new Date('2026-05-22T00:00:00Z')
  const endDate1 = new Date('2026-06-21T23:59:59Z') // Expires soon (current date is 2026-06-19)
  const booking1 = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      studentId: student1.id,
      seatId: seats[0].id, // S-01
      planId: planA.id,
      startDate: startDate1,
      endDate: endDate1,
      shiftId: shiftA.id,
      status: 'ACTIVE',
    },
  })

  const startDate2 = new Date('2026-06-10T00:00:00Z')
  const endDate2 = new Date('2026-07-10T23:59:59Z')
  const booking2 = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      studentId: student2.id,
      seatId: seats[1].id, // S-02
      planId: planB.id,
      startDate: startDate2,
      endDate: endDate2,
      shiftId: shiftB.id,
      status: 'ACTIVE',
    },
  })
  console.log('Bookings created.')

  // 8. Create Payments
  await prisma.payment.create({
    data: {
      tenantId: tenant.id,
      bookingId: booking1.id,
      amount: 1000.0,
      paymentDate: startDate1,
      paymentMode: 'UPI',
      status: 'PAID',
    },
  })

  await prisma.payment.create({
    data: {
      tenantId: tenant.id,
      bookingId: booking2.id,
      amount: 1000.0,
      paymentDate: startDate2,
      paymentMode: 'CASH',
      status: 'PAID',
    },
  })
  console.log('Payments created.')

  // 9. Create WhatsappConfig
  await prisma.whatsappConfig.create({
    data: {
      tenantId: tenant.id,
      apiUrl: 'https://api.ultramsg.com/instance8849',
      token: 'mock-auth-token-xyz789',
      providerType: 'ULTRAMSG',
      templateWelcome: 'Hello {student_name}, welcome to {library_name}! Your registration code is {registration_no}. We are glad to have you.',
      templateExpiry: 'Dear {student_name}, your seat {seat_number} subscription ({shift} shift) at {library_name} expires on {expiry_date}. Total due: INR {due_amount}. Please renew to prevent cancellation.',
      expiryDaysAlert: 3,
    },
  })
  console.log('WhatsApp Config created.')

  console.log('Seeding completed successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

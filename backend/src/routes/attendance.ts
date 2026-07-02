import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { Attendance, Student, Booking } from '../models'

// Local timezone-aware date string helper (YYYY-MM-DD)
function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const router = Router()

/**
 * POST /api/attendance/check-in
 * Check in a student by registration number
 */
router.post('/check-in', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { registrationNo } = req.body

  if (!registrationNo) {
    return res.status(400).json({ error: 'Registration number is required' })
  }

  try {
    // 1. Find active student
    const student = await Student.findOne({ registrationNo: registrationNo.trim().toUpperCase(), tenantId }) as any
    if (!student) {
      return res.status(404).json({ error: 'Registration number not found' })
    }

    if (student.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'This student workspace is marked inactive' })
    }

    // 2. Check if student already has an open check-in today
    const todayStr = getLocalDateString()
    const openCheckIn = await Attendance.findOne({
      tenantId,
      studentId: student._id,
      date: todayStr,
      checkOut: { $exists: false }
    })

    if (openCheckIn) {
      return res.status(400).json({ error: `${student.name} is already checked in.` })
    }

    // 3. Find if student has active booking to display seat info
    const activeBooking = await Booking.findOne({ tenantId, studentId: student._id, status: 'ACTIVE' }).populate('seat') as any

    // 4. Create check-in record
    const attendance = new Attendance({
      _id: uuidv4(),
      tenantId,
      studentId: student._id,
      checkIn: new Date(),
      date: todayStr
    })
    await attendance.save()

    return res.json({
      success: true,
      message: 'Checked in successfully!',
      studentName: student.name,
      checkInTime: attendance.checkIn,
      seatNumber: activeBooking?.seat?.seatNumber || 'Unassigned',
      shiftName: activeBooking?.shift?.name || 'N/A'
    })

  } catch (error) {
    console.error('Check-in error:', error)
    return res.status(500).json({ error: 'Internal server error processing check-in' })
  }
})

/**
 * POST /api/attendance/check-out
 * Check out a student by registration number
 */
router.post('/check-out', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { registrationNo } = req.body

  if (!registrationNo) {
    return res.status(400).json({ error: 'Registration number is required' })
  }

  try {
    // 1. Find student
    const student = await Student.findOne({ registrationNo: registrationNo.trim().toUpperCase(), tenantId }) as any
    if (!student) {
      return res.status(404).json({ error: 'Registration number not found' })
    }

    // 2. Find their open check-in record (latest one where checkOut is missing)
    const openLog = await Attendance.findOne({
      tenantId,
      studentId: student._id,
      checkOut: { $exists: false }
    }).sort({ checkIn: -1 }) as any

    if (!openLog) {
      return res.status(400).json({ error: `${student.name} does not have an active Check-In record.` })
    }

    // 3. Update Check-out timestamp
    const now = new Date()
    openLog.checkOut = now
    await openLog.save()

    // Calculate duration
    const diffMs = now.getTime() - new Date(openLog.checkIn).getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    return res.json({
      success: true,
      message: 'Checked out successfully!',
      studentName: student.name,
      checkOutTime: now,
      duration: `${hours}h ${minutes}m`
    })

  } catch (error) {
    console.error('Check-out error:', error)
    return res.status(500).json({ error: 'Internal server error processing check-out' })
  }
})

/**
 * GET /api/attendance/today
 * Get all check-in/out logs for today
 */
router.get('/today', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const todayStr = getLocalDateString()

  try {
    const logs = await Attendance.find({ tenantId, date: todayStr })
      .populate('student')
      .sort({ checkIn: -1 }) as any[]

    // Bulk fetch active bookings for all students in today's logs to avoid N+1
    const studentIds = [...new Set(logs.map((l: any) => l.studentId).filter(Boolean))]
    const activeBookings = studentIds.length > 0
      ? await Booking.find({ tenantId, studentId: { $in: studentIds }, status: 'ACTIVE' }).populate('seat') as any[]
      : []

    // Map by studentId (take first active booking per student)
    const seatByStudentMap: Record<string, any> = {}
    activeBookings.forEach((b: any) => {
      if (b.studentId && !seatByStudentMap[b.studentId]) {
        seatByStudentMap[b.studentId] = b
      }
    })

    const formatted = logs.map((l: any) => {
      const activeBooking = seatByStudentMap[l.studentId] || null
      return {
        id: l._id,
        studentId: l.studentId,
        studentName: l.student?.name || 'Deleted Student',
        registrationNo: l.student?.registrationNo || 'N/A',
        phone: l.student?.phone || 'N/A',
        seatNumber: activeBooking?.seat?.seatNumber || 'Unassigned',
        checkIn: l.checkIn,
        checkOut: l.checkOut || null
      }
    })

    return res.json(formatted)
  } catch (error) {
    console.error('Fetch today attendance error:', error)
    return res.status(500).json({ error: 'Internal server error fetching today logs' })
  }
})

/**
 * GET /api/attendance/history
 * Fetch historical logs with filters
 */
router.get('/history', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { startDate, endDate, search } = req.query

  try {
    const query: any = { tenantId }

    if (startDate && endDate) {
      query.date = { $gte: String(startDate), $lte: String(endDate) }
    }

    const logs = await Attendance.find(query)
      .populate('student')
      .sort({ checkIn: -1 }) as any[]

    // Bulk fetch active bookings for all students in logs to avoid N+1
    const studentIds = [...new Set(logs.map((l: any) => l.studentId).filter(Boolean))]
    const activeBookings = studentIds.length > 0
      ? await Booking.find({ tenantId, studentId: { $in: studentIds }, status: 'ACTIVE' }).populate('seat') as any[]
      : []

    const seatByStudentMap: Record<string, any> = {}
    activeBookings.forEach((b: any) => {
      if (b.studentId && !seatByStudentMap[b.studentId]) {
        seatByStudentMap[b.studentId] = b
      }
    })

    let formatted = logs.map((l: any) => {
      const activeBooking = seatByStudentMap[l.studentId] || null
      return {
        id: l._id,
        studentId: l.studentId,
        studentName: l.student?.name || 'Deleted Student',
        registrationNo: l.student?.registrationNo || 'N/A',
        phone: l.student?.phone || 'N/A',
        seatNumber: activeBooking?.seat?.seatNumber || 'Unassigned',
        checkIn: l.checkIn,
        checkOut: l.checkOut || null,
        date: l.date
      }
    })

    // Filter by student name/regNo if search is supplied
    if (search) {
      const s = String(search).toLowerCase()
      formatted = formatted.filter(
        f => f.studentName.toLowerCase().includes(s) || f.registrationNo.toLowerCase().includes(s)
      )
    }

    return res.json(formatted)
  } catch (error) {
    console.error('Fetch attendance history error:', error)
    return res.status(500).json({ error: 'Internal server error fetching history logs' })
  }
})

/**
 * GET /api/attendance/analytics
 * Retrieve busiest check-in hours, daily trends, and low attendance students
 */
router.get('/analytics', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!

  try {
    // 1. Calculate Busiest Hours (Last 30 Days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    const recentLogs = await Attendance.find({
      tenantId,
      checkIn: { $gte: thirtyDaysAgo }
    }).select('checkIn')

    const hourlyCounts = Array.from({ length: 24 }, (_, i) => {
      const hourNum = i;
      const label = hourNum === 0 
        ? '12 AM' 
        : hourNum < 12 
          ? `${hourNum} AM` 
          : hourNum === 12 
            ? '12 PM' 
            : `${hourNum - 12} PM`;
      return { hour: hourNum, hourLabel: label, count: 0 };
    })

    recentLogs.forEach((log: any) => {
      if (log.checkIn) {
        const hour = new Date(log.checkIn).getHours()
        if (hour >= 0 && hour < 24) {
          hourlyCounts[hour].count++
        }
      }
    })

    // Filter to normal operating hours (e.g. 6 AM to 11 PM) or just return all 24
    // We'll return all 24, but the frontend can choose how to render them.

    // 2. Daily Trends (Last 14 Days)
    const dailyTrends: { date: string; label: string; count: number }[] = []
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = getLocalDateString(d)
      const label = `${d.getDate()} ${months[d.getMonth()]}`
      dailyTrends.push({ date: dateStr, label, count: 0 })
    }

    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    fourteenDaysAgo.setHours(0, 0, 0, 0)

    const trendLogs = await Attendance.find({
      tenantId,
      checkIn: { $gte: fourteenDaysAgo }
    }).select('date')

    trendLogs.forEach((log: any) => {
      const logDate = log.date // YYYY-MM-DD
      const trendDay = dailyTrends.find(t => t.date === logDate)
      if (trendDay) {
        trendDay.count++
      }
    })

    // 3. Low Attendance / Inactive Students
    // Defined as active students with active seat bookings who have checked in fewer than 3 times (or <50% rate) in the last 7 days.
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const activeBookings = await Booking.find({
      tenantId,
      status: 'ACTIVE',
      endDate: { $gte: new Date() }
    }).populate('student').populate('seat') as any[]

    const activeStudentIds = activeBookings
      .filter(b => b.student && b.student.status === 'ACTIVE')
      .map(b => b.student._id)

    const recentCheckIns = await Attendance.find({
      tenantId,
      studentId: { $in: activeStudentIds },
      checkIn: { $gte: sevenDaysAgo }
    }).select('studentId')

    const studentAttendanceMap: Record<string, number> = {}
    activeStudentIds.forEach(id => {
      studentAttendanceMap[id] = 0
    })

    recentCheckIns.forEach((log: any) => {
      if (studentAttendanceMap[log.studentId] !== undefined) {
        studentAttendanceMap[log.studentId]++
      }
    })

    const lowAttendanceList: any[] = []

    for (const booking of activeBookings) {
      if (!booking.student || booking.student.status !== 'ACTIVE') continue
      const studentId = booking.student._id
      const count = studentAttendanceMap[studentId] || 0

      // Calculate how many days the booking has actually been active in the last 7 days
      const bookingStart = new Date(booking.startDate)
      const msDiff = Date.now() - bookingStart.getTime()
      const daysActive = Math.max(1, Math.min(7, Math.ceil(msDiff / (1000 * 60 * 60 * 24))))

      const attendanceRate = daysActive > 0 ? Math.round((count / daysActive) * 100) : 0

      // Flag if checked in 0 times, or check-in rate is less than 50% (for bookings active at least 3 days)
      const isLow = count === 0 || (daysActive >= 3 && attendanceRate < 50)

      if (isLow) {
        const lastLog = await Attendance.findOne({
          tenantId,
          studentId
        }).sort({ checkIn: -1 }).select('checkIn')

        lowAttendanceList.push({
          studentId,
          name: booking.student.name,
          registrationNo: booking.student.registrationNo,
          phone: booking.student.phone,
          seatNumber: booking.seat?.seatNumber || 'Unassigned',
          attendanceCount: count,
          daysActive,
          attendanceRate,
          lastActive: lastLog ? lastLog.checkIn : null
        })
      }
    }

    // Sort by lowest count first
    lowAttendanceList.sort((a, b) => a.attendanceCount - b.attendanceCount)

    return res.json({
      hourlyCounts,
      dailyTrends,
      lowAttendanceList
    })
  } catch (error) {
    console.error('Attendance analytics error:', error)
    return res.status(500).json({ error: 'Internal server error calculating analytics' })
  }
})

/**
 * GET /api/attendance/student-by-regno/:regNo
 * Lookup student details dynamically by Registration Number for live kiosk greeting
 */
router.get('/student-by-regno/:regNo', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { regNo } = req.params

  if (!regNo || !regNo.trim()) {
    return res.status(400).json({ error: 'Registration number is required' })
  }

  try {
    const student = await Student.findOne({ registrationNo: regNo.trim().toUpperCase(), tenantId }) as any
    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    // Find if the student has an active booking
    const activeBooking = await Booking.findOne({ tenantId, studentId: student._id, status: 'ACTIVE' }).populate('seat') as any

    return res.json({
      id: student._id,
      name: student.name,
      registrationNo: student.registrationNo,
      status: student.status,
      assignedSeat: activeBooking?.seat?.seatNumber || 'Unassigned',
      shiftName: activeBooking?.shift?.name || 'N/A'
    })
  } catch (error) {
    console.error('Lookup student by regNo error:', error)
    return res.status(500).json({ error: 'Internal server error looking up student' })
  }
})

/**
 * GET /api/attendance/student-kiosk-dictionary
 * Fetch lightweight dictionary of active students (Registration No -> Name) for local caching
 */
router.get('/student-kiosk-dictionary', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!

  try {
    const students = await Student.find({ tenantId, status: 'ACTIVE' })
      .select('registrationNo name')
      .lean()

    const dictionary = students.map((s: any) => ({
      registrationNo: s.registrationNo,
      name: s.name
    }))

    return res.json(dictionary)
  } catch (error) {
    console.error('Fetch student kiosk dictionary error:', error)
    return res.status(500).json({ error: 'Internal server error fetching dictionary' })
  }
})

/**
 * GET /api/attendance/student/:studentId/monthly
 * Fetch monthly attendance history & calculated present/absent days for a single student
 */
router.get('/student/:studentId/monthly', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { studentId } = req.params
  const { month } = req.query // Format: YYYY-MM

  if (!studentId) {
    return res.status(400).json({ error: 'Student ID is required' })
  }

  try {
    // Validate student exists and belongs to tenant
    const student = await Student.findOne({ _id: studentId, tenantId })
    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    // Default to current month if not specified
    const targetMonth = month ? String(month) : new Date().toISOString().slice(0, 7) // "YYYY-MM"
    const [yearStr, monthStr] = targetMonth.split('-')
    const year = parseInt(yearStr, 10)
    const monthIndex = parseInt(monthStr, 10) - 1 // 0-indexed month

    if (isNaN(year) || isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
      return res.status(400).json({ error: 'Invalid month format. Expected YYYY-MM' })
    }

    const monthStart = new Date(year, monthIndex, 1)
    const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999) // Last day of month

    const escapedMonth = targetMonth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Fetch all check-in/out records for this student in this month
    const logs = await Attendance.find({
      tenantId,
      studentId,
      date: { $regex: `^${escapedMonth}` }
    }).sort({ checkIn: 1 })

    // Fetch all active/completed bookings for this student that overlap with this month
    const bookings = await Booking.find({
      tenantId,
      studentId,
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
      status: { $in: ['ACTIVE', 'COMPLETED'] }
    }).populate('shift').populate('plan')

    const totalDays = monthEnd.getDate()
    const daysData = []
    let presentCount = 0
    let absentCount = 0
    let unbookedCount = 0
    let futureCount = 0

    const todayStr = getLocalDateString()

    for (let day = 1; day <= totalDays; day++) {
      const currentDayDate = new Date(year, monthIndex, day)
      const dayStr = String(day).padStart(2, '0')
      const dateStr = `${targetMonth}-${dayStr}`

      // Check if there is attendance on this day
      const dayLog = logs.find(l => l.date === dateStr)

      // Find booking covering this day
      const coveringBooking = bookings.find(b => {
        const start = new Date(b.startDate)
        const end = new Date(b.endDate)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        return currentDayDate >= start && currentDayDate <= end
      }) as any

      let status = 'NO_BOOKING'
      let checkIn = null
      let checkOut = null
      let duration = null
      let shiftName = coveringBooking?.shift?.name || 'N/A'
      let planName = coveringBooking?.plan?.name || 'N/A'

      if (dayLog) {
        status = 'PRESENT'
        presentCount++
        checkIn = dayLog.checkIn
        checkOut = dayLog.checkOut || null
        if (dayLog.checkOut) {
          const diffMs = new Date(dayLog.checkOut).getTime() - new Date(dayLog.checkIn).getTime()
          const hours = Math.floor(diffMs / (1000 * 60 * 60))
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
          duration = `${hours}h ${minutes}m`
        }
      } else if (coveringBooking) {
        if (dateStr > todayStr) {
          status = 'FUTURE_BOOKING'
          futureCount++
        } else {
          status = 'ABSENT'
          absentCount++
        }
      } else {
        status = 'NO_BOOKING'
        unbookedCount++
      }

      daysData.push({
        date: dateStr,
        day,
        status,
        checkIn,
        checkOut,
        duration,
        shiftName,
        planName
      })
    }

    const totalExpectedDays = presentCount + absentCount
    const attendanceRate = totalExpectedDays > 0 ? Math.round((presentCount / totalExpectedDays) * 100) : 0

    return res.json({
      student: {
        id: student._id,
        name: student.name,
        registrationNo: student.registrationNo,
        phone: student.phone
      },
      month: targetMonth,
      summary: {
        totalDays,
        presentCount,
        absentCount,
        unbookedCount,
        futureCount,
        attendanceRate
      },
      days: daysData
    })

  } catch (error) {
    console.error('Fetch student monthly attendance error:', error)
    return res.status(500).json({ error: 'Internal server error calculating monthly attendance' })
  }
})

export default router

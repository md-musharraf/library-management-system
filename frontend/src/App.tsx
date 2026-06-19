import React, { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Armchair,
  Settings,
  CreditCard,
  LogOut,
  Search,
  Plus,
  Bell,
  RefreshCw,
  Send,
  Shield,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  Smartphone,
  Info,
  Edit,
  Clock,
  Trash,
  Sun,
  Moon,
  X,
  Calendar,
  ArrowLeft,
  Download,
  LogIn,
  UserCheck
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { api } from './utils/api'

// Convert 24h time to 12h AM/PM
const formatTimeTo12h = (time24: string): string => {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
};

// Client-side smart reg-no preview (mirrors backend logic)
const getNextRegNoPreview = (lastRegNo: string): string => {
  const trimmed = lastRegNo.trim()
  if (!trimmed) return '1'
  const match = trimmed.match(/^(.*?)(\d+)$/)
  if (!match) return `${trimmed}-1`
  const prefix = match[1]
  const numStr = match[2]
  const nextNum = parseInt(numStr, 10) + 1
  if (!prefix) return String(nextNum)
  const padLen = numStr.length
  const paddedNext = String(nextNum).padStart(padLen, '0')
  return `${prefix}${paddedNext}`
};

// Define Types
interface DashboardMetrics {
  totalStudents: number
  totalSeats: number
  occupiedSeats: number
  occupancyRate: number
  totalRevenue: number
  pendingDues: number
}

interface ExpiringBooking {
  bookingId: string
  studentName: string
  studentPhone: string
  seatNumber: string
  planName: string
  shift: string
  shiftStartTime: string
  shiftEndTime: string
  endDate: string
  dueAmount: number
}

interface Student {
  id: string
  name: string
  phone: string
  email?: string
  registrationNo: string
  aadharNo?: string | null
  status: string
  createdAt: string
  activeSeat: string | null
  activePlan: string | null
  activeShift: string | null
  activeShiftId: string | null
  activeShiftTime: string | null
  hasActiveBooking?: boolean
  hasDues?: boolean
  dueAmount?: number
}

interface Shift {
  id: string
  name: string
  startTime: string
  endTime: string
}

interface SeatBooking {
  id: string
  studentId: string
  studentName: string
  studentPhone: string
  planName: string
  shiftId: string
  shiftName: string
  shiftStartTime: string
  shiftEndTime: string
  startDate: string
  endDate: string
}

interface Seat {
  id: string
  seatNumber: string
  areaName: string
  status: string
  bookings: SeatBooking[]
}

interface Plan {
  id: string
  name: string
  durationDays: number
  price: number
  shiftId: string
  shift: Shift
}

interface WhatsappConfig {
  apiUrl: string
  token: string
  providerType: string
  templateWelcome: string
  templateExpiry: string
  expiryDaysAlert: number
}

interface MessageLog {
  id: string
  recipient: string
  message: string
  status: string
  sentAt: string
}

// Helper to fetch and cache all students (valid for 1 day)
export const loadCachedStudents = async (bypass = false): Promise<Student[]> => {
  const cacheKey = 'lms_students_cache'
  const cacheDateKey = 'lms_students_cache_date'
  const todayStr = new Date().toISOString().split('T')[0]
  const cachedDate = localStorage.getItem(cacheDateKey)
  const cachedData = localStorage.getItem(cacheKey)

  if (!bypass && cachedDate === todayStr && cachedData) {
    try {
      return JSON.parse(cachedData)
    } catch {
      // fallback
    }
  }

  try {
    const data = await api.get('/students')
    localStorage.setItem(cacheKey, JSON.stringify(data))
    localStorage.setItem(cacheDateKey, todayStr)
    return data
  } catch (err) {
    console.error('Failed to fetch students for cache:', err)
    return []
  }
}

// Helper to fetch and cache all plans (valid for 1 day)
export const loadCachedPlans = async (bypass = false): Promise<Plan[]> => {
  const cacheKey = 'lms_plans_cache'
  const cacheDateKey = 'lms_plans_cache_date'
  const todayStr = new Date().toISOString().split('T')[0]
  const cachedDate = localStorage.getItem(cacheDateKey)
  const cachedData = localStorage.getItem(cacheKey)

  if (!bypass && cachedDate === todayStr && cachedData) {
    try {
      const parsed = JSON.parse(cachedData)
      // Self-healing: if the cache was stored with unpopulated string shift values, bypass cache
      const isStale = parsed.some((p: any) => typeof p.shift === 'string')
      if (!isStale) {
        return parsed
      }
    } catch {
      // fallback
    }
  }

  try {
    const data = await api.get('/plans')
    localStorage.setItem(cacheKey, JSON.stringify(data))
    localStorage.setItem(cacheDateKey, todayStr)
    return data
  } catch (err) {
    console.error('Failed to fetch plans for cache:', err)
    return []
  }
}

// Helper to fetch and cache all shifts (valid for 1 day)
export const loadCachedShifts = async (bypass = false): Promise<Shift[]> => {
  const cacheKey = 'lms_shifts_cache'
  const cacheDateKey = 'lms_shifts_cache_date'
  const todayStr = new Date().toISOString().split('T')[0]
  const cachedDate = localStorage.getItem(cacheDateKey)
  const cachedData = localStorage.getItem(cacheKey)

  if (!bypass && cachedDate === todayStr && cachedData) {
    try {
      return JSON.parse(cachedData)
    } catch {
      // fallback
    }
  }

  try {
    const data = await api.get('/shifts')
    localStorage.setItem(cacheKey, JSON.stringify(data))
    localStorage.setItem(cacheDateKey, todayStr)
    return data
  } catch (err) {
    console.error('Failed to fetch shifts for cache:', err)
    return []
  }
}

export default function App() {
  // Auth State
  const [token, setToken] = useState<string | null>(localStorage.getItem('lms_token'))
  const [tenantName, setTenantName] = useState<string | null>(localStorage.getItem('lms_tenant_name'))
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState<boolean>(false)
  const [authError, setAuthError] = useState<string | null>(null)
  
  // Auth inputs
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [libraryName, setLibraryName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  // View state
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'students' | 'seats' | 'plans' | 'settings' | 'attendance'>('dashboard')
  const isKioskMode = window.location.search.includes('mode=kiosk') || window.location.hash.includes('mode=kiosk')
  
  // Global Alert/Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('lms_theme')
    return (saved as 'light' | 'dark') || 'dark'
  })

  useEffect(() => {
    const root = window.document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('lms_theme', theme)
  }, [theme])

  // Trigger Toast
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Developer Admin State
  const [adminToken, setAdminToken] = useState<string | null>(localStorage.getItem('lms_admin_token'))

  // License State
  const [licenseStatus, setLicenseStatus] = useState<any>(null)
  const [licenseChecking, setLicenseChecking] = useState<boolean>(true)

  const [isAdminView, setIsAdminView] = useState(() => window.location.search.includes('mode=admin') || window.location.hash.includes('mode=admin'))

  // Fetch tenant profile and license status on login/load
  useEffect(() => {
    if (token && !isAdminView) {
      setLicenseChecking(true)
      Promise.all([
        api.get('/tenant/profile'),
        api.get('/license/status'),
        loadCachedStudents().catch(() => []) // Pre-fetch and cache student list once daily
      ])
        .then(([profileData, licenseData]) => {
          setTenantName(profileData.name)
          setLogoUrl(profileData.logoUrl)
          localStorage.setItem('lms_tenant_name', profileData.name)
          setLicenseStatus(licenseData)
        })
        .catch((err) => {
          console.error('Error bootstrapping app details:', err)
        })
        .finally(() => {
          setLicenseChecking(false)
        })
    } else {
      setLicenseChecking(false)
    }
  }, [token])

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('lms_token')
    localStorage.removeItem('lms_tenant_id')
    localStorage.removeItem('lms_tenant_name')
    setToken(null)
    setTenantName(null)
    setLogoUrl(null)
    showToast('Logged out successfully', 'success')
  }

  // Unified login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    try {
      const data = await api.post('/auth/login', { email, password })
      localStorage.setItem('lms_token', data.token)
      localStorage.setItem('lms_tenant_id', data.tenantId)
      localStorage.setItem('lms_tenant_name', data.tenantName)
      setToken(data.token)
      setTenantName(data.tenantName)
      showToast(`Welcome back, ${data.user.name}!`, 'success')
    } catch (err: any) {
      setAuthError(err.message || 'Invalid email or password')
    }
  }

  // Unified register handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    try {
      const data = await api.post('/auth/register-tenant', {
        libraryName,
        ownerName,
        phone,
        address,
        email,
        password,
      })
      localStorage.setItem('lms_token', data.token)
      localStorage.setItem('lms_tenant_id', data.tenantId)
      localStorage.setItem('lms_tenant_name', libraryName)
      setToken(data.token)
      setTenantName(libraryName)
      setIsRegistering(false)
      showToast('Library registered and set up successfully!', 'success')
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed. Check inputs.')
    }
  }

  return (
    <div className="min-h-screen bg-app-bg text-slate-100 flex flex-col font-sans relative overflow-x-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md transition-all duration-300 transform translate-y-0 border ${
          toast.type === 'success' 
            ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' 
            : 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {isAdminView ? (
        !adminToken ? (
          <AdminLoginView setAdminToken={setAdminToken} showToast={showToast} theme={theme} setTheme={setTheme} setIsAdminView={setIsAdminView} />
        ) : (
          <AdminDashboardView adminToken={adminToken} setAdminToken={setAdminToken} showToast={showToast} theme={theme} setTheme={setTheme} />
        )
      ) : !token ? (
        <div className="flex-1 flex items-center justify-center p-4 min-h-screen relative">
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 bg-app-surface border border-app-border rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center shadow-lg"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>
          </div>

          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10 animate-pulse delay-700"></div>
          
          <div className="w-full max-w-md backdrop-blur-xl bg-app-surface/80 border border-app-border p-8 rounded-3xl shadow-2xl">
            <div className="flex flex-col items-center gap-2 mb-8">
              <div className="p-3 bg-violet-600/20 rounded-2xl border border-violet-500/30 text-violet-400">
                <BookOpen className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mt-2">
                {isRegistering ? 'Register Your Library' : 'Library Owner & Admin Portal'}
              </h1>
              <p className="text-sm text-slate-400 text-center">
                {isRegistering 
                  ? 'Register your library workspace and configure seating setups in minutes.' 
                  : 'Exclusively for Library Owners & staff to manage seats, shifts, and admissions.'}
              </p>
            </div>

            {authError && (
              <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
              {isRegistering ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Library Name</label>
                    <input 
                      type="text" required placeholder="e.g. Elite Study Hub" 
                      value={libraryName} onChange={(e) => setLibraryName(e.target.value)}
                      className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Owner Name</label>
                      <input 
                        type="text" required placeholder="Owner Name" 
                        value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                        className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Contact Phone</label>
                      <input 
                        type="text" required placeholder="+91..." 
                        value={phone} onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Address</label>
                    <input 
                      type="text" required placeholder="Library Address" 
                      value={address} onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                </>
              ) : null}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Email Address</label>
                <input 
                  type="email" required placeholder="admin@library.com" 
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Password</label>
                <input 
                  type="password" required placeholder="••••••••" 
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-violet-600/20 text-sm mt-6 flex justify-center items-center gap-2"
              >
                {isRegistering ? <UserPlus className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                {isRegistering ? 'Register & Start Setup' : 'Login Admin Dashboard'}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-400">
              {isRegistering ? (
                <span>
                  Already have a registered library?{' '}
                  <button onClick={() => { setIsRegistering(false); setAuthError(null); }} className="text-violet-400 font-semibold hover:underline">
                    Login here
                  </button>
                </span>
              ) : (
                <span>
                  Want to register a new library?{' '}
                  <button onClick={() => { setIsRegistering(true); setAuthError(null); }} className="text-violet-400 font-semibold hover:underline">
                    Register Library
                  </button>
                </span>
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-app-border/40 text-center">
              <button 
                onClick={() => setIsAdminView(true)} 
                className="text-[10px] text-slate-500 hover:text-amber-400 hover:underline transition-colors inline-flex items-center gap-1 mx-auto cursor-pointer font-medium"
              >
                <Shield className="w-3.5 h-3.5" /> Developer Admin Console
              </button>
            </div>
          </div>
        </div>
      ) : licenseChecking ? (
        <div className="flex-1 flex justify-center items-center">
          <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      ) : licenseStatus && !licenseStatus.valid ? (
        <LicenseExpiredScreen 
          licenseStatus={licenseStatus} 
          setLicenseStatus={setLicenseStatus} 
          showToast={showToast} 
          handleLogout={handleLogout} 
        />
      ) : isKioskMode ? (
        <KioskGateView showToast={showToast} handleLogout={handleLogout} theme={theme} setTheme={setTheme} />
      ) : (
        <div className="flex-1 flex flex-col md:flex-row min-h-screen">
          {/* Desktop Sidebar Navigation */}
          <aside className="hidden md:flex flex-col w-64 bg-app-surface border-r border-app-border p-5 justify-between">
            <div className="space-y-8">
              <div className="flex items-center gap-3 px-2">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-cover border border-app-border" onError={() => setLogoUrl(null)} />
                ) : (
                  <div className="p-2 bg-violet-600/20 rounded-xl border border-violet-500/30 text-violet-400">
                    <BookOpen className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h2 className="text-sm font-bold text-white leading-none truncate max-w-[150px]" title={tenantName || ''}>
                    {tenantName}
                  </h2>
                  <span className="text-[10px] text-emerald-400 font-medium">SaaS Portal</span>
                </div>
              </div>

              <nav className="space-y-1">
                <SidebarItem 
                  icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" 
                  active={currentTab === 'dashboard'} onClick={() => setCurrentTab('dashboard')} 
                />
                <SidebarItem 
                  icon={<Users className="w-5 h-5" />} label="Students" 
                  active={currentTab === 'students'} onClick={() => setCurrentTab('students')} 
                />
                <SidebarItem 
                  icon={<Armchair className="w-5 h-5" />} label="Seats Layout" 
                  active={currentTab === 'seats'} onClick={() => setCurrentTab('seats')} 
                />
                <SidebarItem 
                  icon={<Clock className="w-5 h-5" />} label="Attendance" 
                  active={currentTab === 'attendance'} onClick={() => setCurrentTab('attendance')} 
                />
                <SidebarItem 
                  icon={<CreditCard className="w-5 h-5" />} label="Plans & Shifts" 
                  active={currentTab === 'plans'} onClick={() => setCurrentTab('plans')} 
                />
                <SidebarItem 
                  icon={<Settings className="w-5 h-5" />} label="Settings" 
                  active={currentTab === 'settings'} onClick={() => setCurrentTab('settings')} 
                />
              </nav>
            </div>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </aside>

          {/* Core Content Area */}
          <main className="flex-1 flex flex-col min-h-0 bg-app-bg relative pb-20 md:pb-5">
            {/* Header */}
            <header className="flex justify-between items-center px-4 py-4 md:px-8 border-b border-app-border bg-app-surface/30 backdrop-blur-sm sticky top-0 z-20">
              <div className="flex items-center gap-3 md:hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover border border-app-border" onError={() => setLogoUrl(null)} />
                ) : (
                  <div className="p-1.5 bg-violet-600/20 rounded-lg border border-violet-500/30 text-violet-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                )}
                <h1 className="text-sm font-bold text-white max-w-[120px] truncate">{tenantName}</h1>
              </div>
              <h2 className="hidden md:block text-lg font-bold text-white capitalize">{currentTab.replace('-', ' ')}</h2>
              
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-app-surface border border-app-border rounded-xl text-xs text-slate-300">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Installed App</span>
                </div>
                <a
                  href="/?mode=kiosk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-lg shadow-violet-600/20 transition-all cursor-pointer border border-violet-500/30"
                  title="Launch Gate Kiosk"
                >
                  <Smartphone className="w-3.5 h-3.5 text-slate-100" />
                  <span>Launch Kiosk</span>
                </a>
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 bg-app-surface border border-app-border rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                  title="Toggle Theme"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                </button>
                <button 
                  onClick={handleLogout}
                  className="md:hidden p-2 text-red-400 hover:bg-red-500/10 rounded-xl"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Tab Containers */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              {currentTab === 'dashboard' && <DashboardView showToast={showToast} />}
              {currentTab === 'students' && <StudentsView showToast={showToast} />}
              {currentTab === 'seats' && <SeatsView showToast={showToast} />}
              {currentTab === 'attendance' && <AttendanceView showToast={showToast} setCurrentTab={setCurrentTab} />}
              {currentTab === 'plans' && <PlansAndShiftsView showToast={showToast} />}
              {currentTab === 'settings' && <SettingsView showToast={showToast} setTenantName={setTenantName} setLogoUrl={setLogoUrl} />}
            </div>
          </main>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-app-surface border-t border-app-border px-6 py-2 flex justify-between items-center shadow-2xl backdrop-blur-lg">
            <BottomNavItem 
              icon={<LayoutDashboard className="w-5.5 h-5.5" />} label="Home" 
              active={currentTab === 'dashboard'} onClick={() => setCurrentTab('dashboard')} 
            />
            <BottomNavItem 
              icon={<Users className="w-5.5 h-5.5" />} label="Students" 
              active={currentTab === 'students'} onClick={() => setCurrentTab('students')} 
            />
            <BottomNavItem 
              icon={<Armchair className="w-5.5 h-5.5" />} label="Seats" 
              active={currentTab === 'seats'} onClick={() => setCurrentTab('seats')} 
            />
            <BottomNavItem 
              icon={<Clock className="w-5.5 h-5.5" />} label="Attendance" 
              active={currentTab === 'attendance'} onClick={() => setCurrentTab('attendance')} 
            />
            <BottomNavItem 
              icon={<CreditCard className="w-5.5 h-5.5" />} label="Plans" 
              active={currentTab === 'plans'} onClick={() => setCurrentTab('plans')} 
            />
            <BottomNavItem 
              icon={<Settings className="w-5.5 h-5.5" />} label="Settings" 
              active={currentTab === 'settings'} onClick={() => setCurrentTab('settings')} 
            />
          </nav>
        </div>
      )}
    </div>
  )
}

// Helper: Sidebar Navigation Item
function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
        active 
          ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' 
          : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// Helper: Mobile Navigation Item
function BottomNavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-1 flex-1 py-1"
    >
      <div className={`p-1 rounded-xl transition-all ${active ? 'text-violet-400' : 'text-slate-400'}`}>
        {icon}
      </div>
      <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? 'text-violet-400' : 'text-slate-500'}`}>
        {label}
      </span>
    </button>
  )
}

// ==========================================
// KIOSK GATE VIEW COMPONENT (Library Entrance Tablet/Display)
// ==========================================
function KioskGateView({
  showToast,
  handleLogout,
  theme,
  setTheme
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void
  handleLogout: () => void
  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void
}) {
  const [regNo, setRegNo] = useState('')
  const [loading, setLoading] = useState(false)
  const [time, setTime] = useState(new Date())
  const [statusCard, setStatusCard] = useState<{
    type: 'success' | 'checkout' | 'error'
    studentName?: string
    registrationNo?: string
    seatNumber?: string
    shiftName?: string
    duration?: string
    message: string
    timestamp: Date
  } | null>(null)

  const [seats, setSeats] = useState<any[]>([])
  const [todayLogs, setTodayLogs] = useState<any[]>([])
  const [resolvedName, setResolvedName] = useState<string | null>(null)
  const [searchingName, setSearchingName] = useState(false)
  const [studentDictionary, setStudentDictionary] = useState<{ registrationNo: string; name: string }[]>([])

  const loadLiveOccupancy = async () => {
    try {
      const [sData, lData] = await Promise.all([
        api.get('/seats'),
        api.get('/attendance/today')
      ])
      setSeats(sData)
      setTodayLogs(lData)
    } catch (err) {
      console.error('Error fetching live occupancy for kiosk:', err)
    }
  }

  // Load and cache student dictionary in localStorage (valid for 1 day)
  const loadCachedStudentDictionary = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0]
      const cachedDate = localStorage.getItem('lms_kiosk_last_fetch_date')
      const cachedData = localStorage.getItem('lms_kiosk_students')

      if (cachedDate === todayStr && cachedData) {
        setStudentDictionary(JSON.parse(cachedData))
        console.log('Loaded student dictionary from local storage cache.')
      } else {
        const data = await api.get('/attendance/student-kiosk-dictionary')
        setStudentDictionary(data)
        localStorage.setItem('lms_kiosk_students', JSON.stringify(data))
        localStorage.setItem('lms_kiosk_last_fetch_date', todayStr)
        console.log('Fetched student dictionary from server and cached locally.')
      }
    } catch (err) {
      console.error('Failed to load student dictionary:', err)
    }
  }

  // Initial load and periodic refresh of seating map (every 10 seconds to optimize requests)
  useEffect(() => {
    loadLiveOccupancy()
    loadCachedStudentDictionary()
    const interval = setInterval(loadLiveOccupancy, 10000)
    return () => clearInterval(interval)
  }, [])

  // Auto-resolve student name as they type (client-side lookup with server fallback)
  useEffect(() => {
    const trimmed = regNo.trim().toUpperCase()
    if (trimmed.length < 3) {
      setResolvedName(null)
      return
    }

    // 1. Try local memory lookup
    const localMatch = studentDictionary.find(
      (s: any) => s.registrationNo.toUpperCase() === trimmed
    )

    if (localMatch) {
      setResolvedName(localMatch.name)
      return
    }

    // 2. Fallback to server search with debounce (in case of newly registered students)
    const debounceTimer = setTimeout(async () => {
      setSearchingName(true)
      try {
        const student = await api.get(`/attendance/student-by-regno/${encodeURIComponent(trimmed)}`)
        setResolvedName(student.name)
        
        // Add newly found student to local dictionary to avoid future hits
        const updatedDict = [...studentDictionary, { registrationNo: student.registrationNo, name: student.name }]
        setStudentDictionary(updatedDict)
        localStorage.setItem('lms_kiosk_students', JSON.stringify(updatedDict))
      } catch (err) {
        setResolvedName(null)
      } finally {
        setSearchingName(false)
      }
    }, 500)

    return () => clearTimeout(debounceTimer)
  }, [regNo, studentDictionary])

  // Digital clock update
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-clear success/error feedback card after 7 seconds
  useEffect(() => {
    if (statusCard) {
      const timer = setTimeout(() => {
        setStatusCard(null)
      }, 7000)
      return () => clearTimeout(timer)
    }
  }, [statusCard])

  // Play synthetic audio chime using Web Audio API
  const playBeep = (type: 'success' | 'checkout' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (type === 'success') {
        // High double-beep for Check-In
        const osc1 = audioCtx.createOscillator()
        const gain1 = audioCtx.createGain()
        osc1.connect(gain1)
        gain1.connect(audioCtx.destination)
        osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime) // D5
        gain1.gain.setValueAtTime(0.08, audioCtx.currentTime)
        osc1.start()
        osc1.stop(audioCtx.currentTime + 0.08)

        setTimeout(() => {
          const osc2 = audioCtx.createOscillator()
          const gain2 = audioCtx.createGain()
          osc2.connect(gain2)
          gain2.connect(audioCtx.destination)
          osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime) // A5
          gain2.gain.setValueAtTime(0.08, audioCtx.currentTime)
          osc2.start()
          osc2.stop(audioCtx.currentTime + 0.15)
        }, 100)
      } else if (type === 'checkout') {
        // Ascending-descending sweet chime for Check-Out
        const osc1 = audioCtx.createOscillator()
        const gain1 = audioCtx.createGain()
        osc1.connect(gain1)
        gain1.connect(audioCtx.destination)
        osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime) // E5
        gain1.gain.setValueAtTime(0.08, audioCtx.currentTime)
        osc1.start()
        osc1.stop(audioCtx.currentTime + 0.1)

        setTimeout(() => {
          const osc2 = audioCtx.createOscillator()
          const gain2 = audioCtx.createGain()
          osc2.connect(gain2)
          gain2.connect(audioCtx.destination)
          osc2.frequency.setValueAtTime(523.25, audioCtx.currentTime) // C5
          gain2.gain.setValueAtTime(0.08, audioCtx.currentTime)
          osc2.start()
          osc2.stop(audioCtx.currentTime + 0.18)
        }, 80)
      } else {
        // Alert buzzer for Errors
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(140.00, audioCtx.currentTime) // Low buzzer
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime)
        osc.start()
        osc.stop(audioCtx.currentTime + 0.35)
      }
    } catch (err) {
      console.error('Audio feedback not supported or blocked:', err)
    }
  }

  const handleAction = async (actionType: 'check-in' | 'check-out') => {
    if (!regNo.trim()) {
      showToast('Please enter your registration number first.', 'error')
      playBeep('error')
      return
    }

    setLoading(true)
    setStatusCard(null)

    try {
      const endpoint = actionType === 'check-in' ? '/attendance/check-in' : '/attendance/check-out'
      const data = await api.post(endpoint, { registrationNo: regNo })

      if (actionType === 'check-in') {
        setStatusCard({
          type: 'success',
          studentName: data.studentName,
          registrationNo: regNo.trim().toUpperCase(),
          seatNumber: data.seatNumber,
          shiftName: data.shiftName,
          message: 'Checked In Successfully!',
          timestamp: new Date()
        })
        playBeep('success')
      } else {
        setStatusCard({
          type: 'checkout',
          studentName: data.studentName,
          registrationNo: regNo.trim().toUpperCase(),
          duration: data.duration,
          message: 'Checked Out Successfully!',
          timestamp: new Date()
        })
        playBeep('checkout')
      }
      setRegNo('') // clear input
      setResolvedName(null)
      loadLiveOccupancy()
    } catch (err: any) {
      setStatusCard({
        type: 'error',
        message: err.message || 'Verification failed. Please check registration number.',
        timestamp: new Date()
      })
      playBeep('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 min-h-screen bg-app-bg text-slate-100 flex flex-col font-sans relative overflow-y-auto">
      {/* Background Neon Orbs */}
      <div className="absolute top-10 left-10 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl -z-10 animate-pulse delay-1000"></div>

      {/* Top Header */}
      <header className="px-6 py-4 flex justify-between items-center border-b border-app-border bg-app-surface/20 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-600/20 rounded-xl border border-violet-500/30 text-violet-400">
            <BookOpen className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              LMS GATEWAY <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold rounded-md">KIOSK MODE</span>
            </h1>
            <p className="text-[10px] text-slate-400">Scan Registration ID or Card to enter/exit</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 bg-app-surface border border-app-border rounded-xl text-slate-400 hover:text-white transition-colors flex items-center justify-center animate-none"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>
          
          <button
            onClick={() => {
              window.location.href = '/'
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-app-surface hover:bg-slate-800 border border-app-border rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          
          <button
            onClick={handleLogout}
            className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl transition-all"
            title="Exit Gate & Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Console Center */}
      <div className="flex-1 flex flex-col lg:flex-row gap-8 p-6 max-w-7xl mx-auto w-full items-start justify-center">
        {/* Left Column: Console Panel */}
        <div className="w-full lg:w-5/12 flex flex-col items-center justify-center">
          {/* Real-time Clock View */}
          <div className="text-center mb-8 space-y-1">
            <div className="text-5xl md:text-7xl font-extrabold tracking-widest font-mono text-white bg-clip-text bg-gradient-to-r from-white via-slate-300 to-violet-400 drop-shadow-md">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs md:text-sm font-semibold uppercase tracking-wider text-violet-400 flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4 text-violet-400" />
              <span>{time.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>

          {/* Input & Form Area */}
          <div className="w-full max-w-lg backdrop-blur-xl bg-app-surface/60 border border-app-border p-8 rounded-3xl shadow-2xl relative">
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-white">Daily Attendance Gate Console</h3>
                <p className="text-xs text-slate-400">Please enter your Registration ID or scan your RFID Card barcode</p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ENTER REGISTRATION NUMBER"
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAction('check-in')
                      }
                    }}
                    className="w-full bg-slate-900/60 border-2 border-app-border hover:border-violet-500/50 focus:border-violet-500 text-center text-xl font-bold uppercase tracking-widest text-white rounded-2xl py-4 px-4 focus:outline-none transition-all shadow-inner placeholder:text-slate-600"
                    disabled={loading}
                    autoFocus
                  />
                  {regNo && (
                    <button
                      onClick={() => setRegNo('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white bg-slate-800 rounded-full p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Live Resolved Student Name greeting */}
                {searchingName && (
                  <div className="text-center py-2 flex items-center justify-center gap-1.5 text-xs text-slate-400 font-semibold animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-500" />
                    <span>Identifying Registration ID...</span>
                  </div>
                )}

                {!searchingName && resolvedName && (
                  <div className="text-center py-2.5 px-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold animate-bounce-short shadow-md shadow-emerald-950/5">
                    👋 Welcome, <span className="text-white font-extrabold uppercase">{resolvedName}</span>! Ready for attendance.
                  </div>
                )}

                {!searchingName && !resolvedName && regNo.trim().length >= 3 && (
                  <div className="text-center py-2.5 px-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold">
                    ⚠️ Registration ID not recognized
                  </div>
                )}

                {/* Check-In / Check-Out Actions */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleAction('check-in')}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer text-sm md:text-base border border-emerald-500/30"
                  >
                    {loading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <LogIn className="w-5 h-5" />
                    )}
                    <span>CHECK IN</span>
                  </button>
                  
                  <button
                    onClick={() => handleAction('check-out')}
                    disabled={loading}
                    className="bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 cursor-pointer text-sm md:text-base border border-violet-500/30"
                  >
                    {loading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <LogOut className="w-5 h-5" />
                    )}
                    <span>CHECK OUT</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Audio-Visual Real-time Feedback Card */}
          <div className="w-full max-w-lg mt-6 min-h-[140px] flex items-center justify-center">
            {statusCard ? (
              <div
                className={`w-full p-6 rounded-2xl shadow-2xl border transition-all duration-300 transform scale-100 flex items-start gap-4 relative animate-bounce-short ${
                  statusCard.type === 'success'
                    ? 'bg-emerald-955/80 border-emerald-500/30 text-emerald-100 shadow-emerald-950/20'
                    : statusCard.type === 'checkout'
                    ? 'bg-violet-950/80 border-violet-500/30 text-violet-100 shadow-violet-950/20'
                    : 'bg-rose-955/80 border-rose-500/30 text-rose-100 shadow-rose-950/20'
                }`}
              >
                <button
                  onClick={() => setStatusCard(null)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className={`p-3 rounded-xl border flex-shrink-0 ${
                  statusCard.type === 'success'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : statusCard.type === 'checkout'
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                }`}>
                  {statusCard.type === 'success' ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : statusCard.type === 'checkout' ? (
                    <UserCheck className="w-6 h-6" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 animate-pulse" />
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <h4 className="font-extrabold text-white text-lg tracking-wide uppercase">
                    {statusCard.message}
                  </h4>
                  
                  {statusCard.studentName && (
                    <div className="text-base font-bold text-white mt-1">
                      {statusCard.studentName}
                    </div>
                  )}
                  
                  {statusCard.registrationNo && (
                    <div className="text-xs text-slate-300 font-semibold tracking-wider font-mono">
                      ID: {statusCard.registrationNo}
                    </div>
                  )}

                  {statusCard.type === 'success' && (
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-emerald-500/20 text-xs">
                      <div>
                        <span className="text-slate-400 block">Assigned Seat:</span>
                        <span className="font-bold text-white text-sm">{statusCard.seatNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Shift Timing:</span>
                        <span className="font-bold text-white text-sm">{statusCard.shiftName}</span>
                      </div>
                    </div>
                  )}

                  {statusCard.type === 'checkout' && statusCard.duration && (
                    <div className="mt-2 pt-2 border-t border-violet-500/20 text-xs">
                      <span className="text-slate-400">Total Duration Logged:</span>
                      <span className="font-extrabold text-white text-sm ml-2">{statusCard.duration}</span>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 mt-2">
                    Time: {statusCard.timestamp.toLocaleTimeString()}
                  </div>

                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-3">
                    <div className={`h-full animate-shrink-width ${
                      statusCard.type === 'success' ? 'bg-emerald-500' : statusCard.type === 'checkout' ? 'bg-violet-500' : 'bg-rose-500'
                    }`} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-xs text-slate-500 font-medium">
                💡 Scan/enter Registration Number to receive check-in status card.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Seating Occupancy Grid */}
        <div className="w-full lg:w-7/12 backdrop-blur-md bg-app-surface/40 border border-app-border p-6 rounded-3xl shadow-2xl flex flex-col min-h-[500px]">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Armchair className="w-4 h-4 text-violet-400" />
              <span>Live Seating Map (Entrance Gate View)</span>
            </h3>
            <p className="text-[10px] text-slate-400">Green seats are vacant & available. Red seats are physically occupied.</p>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-6 max-h-[550px]">
            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] font-bold border-b border-app-border/40 pb-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50 block shadow-sm"></span>
                <span className="text-emerald-400">🟢 Empty / Vacant</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/50 block shadow-sm"></span>
                <span className="text-red-400">🔴 Occupied (Inside)</span>
              </span>
            </div>

            {/* Seats Grid Grouped by Area */}
            {seats.length === 0 ? (
              <div className="text-center py-16">
                <Armchair className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 text-xs font-semibold">No seats configured in this library.</p>
              </div>
            ) : (
              <div className="space-y-6 pt-2">
                {Object.entries(seats.reduce((acc: { [key: string]: any[] }, seat) => {
                  const area = seat.areaName || 'General Zone'
                  if (!acc[area]) acc[area] = []
                  acc[area].push(seat)
                  return acc
                }, {})).map(([areaName, areaSeats]) => (
                  <div key={areaName} className="space-y-2">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-violet-400 px-1 border-l-2 border-violet-500 pl-2">
                      {areaName}
                    </h4>
                    
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {areaSeats.map((seat) => {
                        // Check if this seat has someone physically checked in right now
                        const isPhysicallyPresent = todayLogs.some(
                          log => log.seatNumber === seat.seatNumber && log.checkOut === null
                        )
                        
                        let seatStyle = 'bg-slate-800/10 border-slate-700/60 text-slate-400'
                        let statusDot = 'bg-emerald-500 shadow-emerald-500/50'
                        
                        if (isPhysicallyPresent) {
                          seatStyle = 'bg-red-950/20 border-red-500/40 text-red-300 shadow-md shadow-red-955/20'
                          statusDot = 'bg-red-500 shadow-red-500/50 animate-pulse'
                        } else {
                          seatStyle = 'bg-emerald-950/10 border-emerald-500/30 text-emerald-300 shadow-md shadow-emerald-955/5'
                        }

                        return (
                          <div
                            key={seat.id}
                            className={`p-2 border-2 rounded-xl text-center transition-all flex flex-col justify-center items-center gap-0.5 h-14 ${seatStyle}`}
                          >
                            <span className="text-[9px] font-extrabold uppercase text-slate-500 block leading-none">Seat</span>
                            <span className="text-sm font-black text-white leading-none">{seat.seatNumber}</span>
                            <span className={`w-1.5 h-1.5 rounded-full mt-1 ${statusDot}`}></span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <footer className="text-center py-6 text-slate-500 text-xs mt-auto">
        &copy; {new Date().getFullYear()} LMS SaaS Inc. Secured Gate Controller API v1.0
      </footer>
    </div>
  )
}

// ==========================================
// SEAT DETAIL MODAL SUB-COMPONENT
// ==========================================
interface SeatDetailModalProps {
  seat: any
  onClose: () => void
  status: string
  bookingsList: any[]
  handleManualCheckIn: (regNo: string) => Promise<void>
  handleManualCheckOut: (regNo: string) => Promise<void>
  manualCheckingIn: boolean
  setCurrentTab?: (tab: any) => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export function SeatDetailModal({
  seat,
  onClose,
  status,
  bookingsList,
  handleManualCheckIn,
  handleManualCheckOut,
  manualCheckingIn,
  setCurrentTab,
  showToast
}: SeatDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-app-surface border border-app-border rounded-3xl p-6 shadow-2xl relative space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/40 rounded-full p-1.5 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-600/20 border border-violet-500/30 text-violet-400 rounded-2xl">
            <Armchair className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white">Seat {seat.seatNumber}</h3>
            <p className="text-xs text-slate-400">{seat.areaName || 'General Zone'}</p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="pt-2">
          {status === 'present' && (
            <span className="px-3 py-1.5 text-xs font-black uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center gap-1.5 w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Physically Present (Inside)</span>
            </span>
          )}
          {status === 'absent' && (
            <span className="px-3 py-1.5 text-xs font-black uppercase bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center gap-1.5 w-fit">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Absent (Not Checked-In)</span>
            </span>
          )}
          {status === 'vacant' && (
            <span className="px-3 py-1.5 text-xs font-black uppercase bg-slate-800 border border-slate-700 text-slate-400 rounded-xl flex items-center gap-1.5 w-fit">
              <span className="w-2 h-2 rounded-full bg-slate-600"></span>
              <span>Vacant (Available)</span>
            </span>
          )}
        </div>

        {/* Bookings Details */}
        <div className="space-y-4 pt-2">
          {bookingsList.length === 0 ? (
            <div className="bg-slate-900/40 border border-app-border/40 p-4 rounded-2xl text-center space-y-3">
              <p className="text-xs text-slate-400">There are no active shift bookings for this seat.</p>
              <button
                onClick={() => {
                  onClose()
                  if (setCurrentTab) {
                    setCurrentTab('seats')
                  }
                }}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Configure Seating Booking
              </button>
            </div>
          ) : (
            <div className="space-y-3 divide-y divide-app-border/40 max-h-60 overflow-y-auto pr-1">
              {bookingsList.map((booking: any, idx: number) => (
                <div key={booking.id} className={`space-y-3 ${idx > 0 ? 'pt-4' : ''}`}>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block font-medium">Student Name</span>
                      <span className="font-extrabold text-white text-sm block truncate">{booking.studentName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Phone</span>
                      <span className="font-bold text-slate-300 block">{booking.studentPhone}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/20 p-2.5 rounded-xl border border-app-border/30">
                    <div>
                      <span className="text-slate-400 block font-medium">Shift Timing</span>
                      <span className="font-bold text-white block">{booking.shiftName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Plan</span>
                      <span className="font-bold text-white block truncate">{booking.planName}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <div className="text-[10px] text-slate-500 font-medium">
                      Valid: {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      booking.isPresent 
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                        : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                    }`}>
                      {booking.isPresent ? 'Inside' : 'Absent'}
                    </span>
                  </div>

                  <div className="pt-1">
                    {booking.isPresent ? (
                      <button
                        onClick={() => {
                          if (booking.studentRegNo) {
                            handleManualCheckOut(booking.studentRegNo)
                          } else {
                            showToast('Student registration number missing.', 'error')
                          }
                        }}
                        disabled={manualCheckingIn}
                        className="w-full py-2 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/30 text-red-400 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {manualCheckingIn ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <LogOut className="w-4 h-4" />
                        )}
                        <span>Force Checkout</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (booking.studentRegNo) {
                            handleManualCheckIn(booking.studentRegNo)
                          } else {
                            showToast('Student registration number missing.', 'error')
                          }
                        }}
                        disabled={manualCheckingIn}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-500/30 shadow-lg shadow-emerald-600/10"
                      >
                        {manualCheckingIn ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <LogIn className="w-4 h-4" />
                        )}
                        <span>Manual Check-In</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ==========================================
// OWNER ATTENDANCE VIEW TAB COMPONENT
// ==========================================
function AttendanceView({
  showToast,
  setCurrentTab
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void
  setCurrentTab?: (tab: any) => void
}) {
  const [subTab, setSubTab] = useState<'map' | 'inside' | 'today' | 'history' | 'analytics'>('map')
  const [loading, setLoading] = useState(false)
  const [todayLogs, setTodayLogs] = useState<any[]>([])
  const [seats, setSeats] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<string>('')
  const [activeSeatDetail, setActiveSeatDetail] = useState<any | null>(null)
  const [manualCheckingIn, setManualCheckingIn] = useState(false)
  
  const [historyLogs, setHistoryLogs] = useState<any[]>([])
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [searchQuery, setSearchQuery] = useState('')

  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [outreachStudent, setOutreachStudent] = useState<any | null>(null)
  const [outreachMessage, setOutreachMessage] = useState('')
  const [sendingOutreach, setSendingOutreach] = useState(false)

  const loadTodayLogs = async () => {
    setLoading(true)
    try {
      const [logsData, seatsData, shiftsData] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/seats'),
        api.get('/shifts').catch(() => [])
      ])
      setTodayLogs(logsData)
      setSeats(seatsData)
      setShifts(shiftsData)
    } catch (err: any) {
      showToast(err.message || 'Error fetching today attendance logs', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadHistoryLogs = async () => {
    setLoading(true)
    try {
      const data = await api.get(`/attendance/history?startDate=${startDate}&endDate=${endDate}&search=${encodeURIComponent(searchQuery)}`)
      setHistoryLogs(data)
    } catch (err: any) {
      showToast(err.message || 'Error fetching history logs', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadAnalyticsData = async () => {
    setAnalyticsLoading(true)
    try {
      const data = await api.get('/attendance/analytics')
      setAnalyticsData(data)
    } catch (err: any) {
      showToast(err.message || 'Error fetching attendance analytics', 'error')
    } finally {
      setAnalyticsLoading(false)
    }
  }

  useEffect(() => {
    if (subTab === 'map' || subTab === 'inside' || subTab === 'today') {
      loadTodayLogs()
    } else if (subTab === 'analytics') {
      loadAnalyticsData()
    } else {
      loadHistoryLogs()
    }
  }, [subTab])

  const handleForceCheckOut = async (regNo: string) => {
    try {
      const data = await api.post('/attendance/check-out', { registrationNo: regNo })
      showToast(`Checked out ${data.studentName} successfully! Duration: ${data.duration}`, 'success')
      loadTodayLogs()
    } catch (err: any) {
      showToast(err.message || 'Error executing manual checkout', 'error')
    }
  }

  const handleManualCheckIn = async (regNo: string) => {
    setManualCheckingIn(true)
    try {
      const data = await api.post('/attendance/check-in', { registrationNo: regNo })
      showToast(`Checked in ${data.studentName} successfully!`, 'success')
      await loadTodayLogs()
      setActiveSeatDetail(null)
    } catch (err: any) {
      showToast(err.message || 'Error checking in student', 'error')
    } finally {
      setManualCheckingIn(false)
    }
  }

  const handleManualCheckOut = async (regNo: string) => {
    setManualCheckingIn(true)
    try {
      const data = await api.post('/attendance/check-out', { registrationNo: regNo })
      showToast(`Checked out ${data.studentName} successfully! Duration: ${data.duration}`, 'success')
      await loadTodayLogs()
      setActiveSeatDetail(null)
    } catch (err: any) {
      showToast(err.message || 'Error checking out student', 'error')
    } finally {
      setManualCheckingIn(false)
    }
  }

  const getSeatStatus = (seat: any) => {
    const seatBookings = seat.bookings || []
    
    const filteredBookings = selectedShiftId
      ? seatBookings.filter((b: any) => b.shiftId === selectedShiftId)
      : seatBookings

    if (filteredBookings.length === 0) {
      return { status: 'vacant', bookingsList: [] }
    }

    const bookingsWithStatus = filteredBookings.map((b: any) => {
      const isPresent = todayLogs.some(
        log => log.studentId === b.studentId && log.checkOut === null
      )
      return { ...b, isPresent }
    })

    const hasPresent = bookingsWithStatus.some((b: any) => b.isPresent)

    return {
      status: hasPresent ? 'present' : 'absent',
      bookingsList: bookingsWithStatus
    }
  }

  const checkedInStudents = todayLogs.filter((log) => log.checkOut === null)

  const exportToCSV = () => {
    try {
      const headers = ['Date', 'Student Name', 'Registration No', 'Phone', 'Seat Number', 'Check-In Time', 'Check-Out Time', 'Duration (if checked-out)']
      const rows = historyLogs.map((log) => {
        const checkInFormatted = new Date(log.checkIn).toLocaleString()
        const checkOutFormatted = log.checkOut ? new Date(log.checkOut).toLocaleString() : 'Currently Inside'
        
        let duration = ''
        if (log.checkOut) {
          const diff = new Date(log.checkOut).getTime() - new Date(log.checkIn).getTime()
          const hrs = Math.floor(diff / (1000 * 60 * 60))
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
          duration = `${hrs}h ${mins}m`
        } else {
          duration = 'N/A'
        }

        return [
          log.date,
          `"${log.studentName.replace(/"/g, '""')}"`,
          log.registrationNo,
          log.phone,
          log.seatNumber,
          `"${checkInFormatted}"`,
          `"${checkOutFormatted}"`,
          duration
        ]
      })

      const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `LMS_Attendance_Report_${startDate}_to_${endDate}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast('Attendance report exported successfully!', 'success')
    } catch (err: any) {
      showToast('Export failed: ' + err.message, 'error')
    }
  }

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-shrink-width {
          animation: shrinkWidth 7s linear forwards;
        }
        @keyframes bounceShort {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-short {
          animation: bounceShort 2s ease-in-out infinite;
        }
      `}} />

      {/* Top Header Card */}
      <div className="backdrop-blur-md bg-app-surface/40 border border-app-border p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white">Daily Attendance & Gate Manager</h2>
          <p className="text-xs text-slate-400">Monitor live check-ins, record times, and manage history logs.</p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/?mode=kiosk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-lg shadow-violet-600/20 transition-all cursor-pointer border border-violet-500/30"
          >
            <Smartphone className="w-4 h-4" />
            <span>Launch Kiosk Gate</span>
          </a>
          
          <button
            onClick={() => {
              if (subTab === 'history') loadHistoryLogs()
              else if (subTab === 'analytics') loadAnalyticsData()
              else loadTodayLogs()
            }}
            className="p-2.5 bg-app-surface hover:bg-slate-800 border border-app-border rounded-xl text-slate-400 hover:text-white transition-colors"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || analyticsLoading) ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Currently in Library</span>
            <span className="text-2xl font-black text-white mt-1 block">{checkedInStudents.length}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Users className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Total Check-Ins Today</span>
            <span className="text-2xl font-black text-white mt-1 block">{todayLogs.length}</span>
          </div>
          <div className="p-3 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl">
            <LogIn className="w-6 h-6" />
          </div>
        </div>

        <div className="backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Completed Visits Today</span>
            <span className="text-2xl font-black text-white mt-1 block">
              {todayLogs.filter(log => log.checkOut !== null).length}
            </span>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-app-border">
        <button
          onClick={() => setSubTab('map')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            subTab === 'map'
              ? 'border-violet-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Live Seating Map
        </button>
        <button
          onClick={() => setSubTab('inside')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            subTab === 'inside'
              ? 'border-violet-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Currently Inside ({checkedInStudents.length})
        </button>
        <button
          onClick={() => setSubTab('today')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            subTab === 'today'
              ? 'border-violet-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Today's Logs ({todayLogs.length})
        </button>
        <button
          onClick={() => setSubTab('history')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            subTab === 'history'
              ? 'border-violet-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Historical Logs
        </button>
        <button
          onClick={() => setSubTab('analytics')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            subTab === 'analytics'
              ? 'border-violet-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Analytics & Outreach
        </button>
      </div>

      {/* Tab Panels */}
      <div className="min-h-[300px]">
        {((loading && subTab !== 'analytics') || (analyticsLoading && subTab === 'analytics')) && (
          <div className="flex justify-center items-center py-16">
            <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
          </div>
        )}

        {!loading && subTab === 'map' && (
          <div className="space-y-6">
            {/* Map Filtering Controls */}
            <div className="backdrop-blur-md bg-app-surface/40 border border-app-border p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md bg-emerald-500/20 border border-emerald-500/50 block shadow-sm shadow-emerald-500/10"></span>
                  <span className="text-emerald-400">🟢 Present ({seats.filter(s => getSeatStatus(s).status === 'present').length})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md bg-amber-500/20 border border-amber-500/50 block shadow-sm shadow-amber-500/10"></span>
                  <span className="text-amber-400">🟡 Absent ({seats.filter(s => getSeatStatus(s).status === 'absent').length})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md bg-slate-800/40 border border-slate-700 block"></span>
                  <span className="text-slate-400">⚪ Vacant ({seats.filter(s => getSeatStatus(s).status === 'vacant').length})</span>
                </span>
              </div>

              {/* Shift Filter Dropdown */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Filter Timing:</span>
                <select
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(e.target.value)}
                  className="w-full sm:w-48 bg-app-bg border border-app-border rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                >
                  <option value="">All Shifts (Live Overall)</option>
                  {shifts.map(sh => (
                    <option key={sh.id} value={sh.id}>{sh.name} ({sh.startTime} - {sh.endTime})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Areas / Zones Rendering */}
            {seats.length === 0 ? (
              <div className="text-center py-16 backdrop-blur-md bg-app-surface/20 border border-app-border rounded-2xl">
                <Armchair className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No seats configured in this library.</p>
                <p className="text-xs text-slate-500 mt-1">Configure seats under the "Seats Layout" tab first.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(seats.reduce((acc: { [key: string]: any[] }, seat) => {
                  const area = seat.areaName || 'General Zone'
                  if (!acc[area]) acc[area] = []
                  acc[area].push(seat)
                  return acc
                }, {})).map(([areaName, areaSeats]) => (
                  <div key={areaName} className="space-y-3">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-violet-400 px-1 border-l-2 border-violet-500 pl-3">
                      {areaName} ({areaSeats.length} Seats)
                    </h3>
                    
                    <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                      {areaSeats.map((seat) => {
                        const { status, bookingsList } = getSeatStatus(seat)
                        
                        let cardStyle = 'bg-slate-800/20 border-slate-700/60 text-slate-400 hover:border-slate-500'
                        if (status === 'present') {
                          cardStyle = 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-950/20 hover:border-emerald-400'
                        } else if (status === 'absent') {
                          cardStyle = 'bg-amber-950/20 border-amber-500/40 text-amber-300 shadow-md shadow-amber-950/20 hover:border-amber-400'
                        }

                        const occupantName = bookingsList.length > 0
                          ? bookingsList[0].studentName
                          : ''

                        return (
                          <button
                            key={seat.id}
                            onClick={() => setActiveSeatDetail(seat)}
                            className={`p-3 border-2 rounded-xl text-center transition-all flex flex-col justify-between items-center gap-1 cursor-pointer h-20 active:scale-95 ${cardStyle}`}
                          >
                            <span className="text-[10px] font-black tracking-wider uppercase text-slate-500 block">
                              Seat
                            </span>
                            <span className="text-lg font-black text-white leading-none">
                              {seat.seatNumber}
                            </span>
                            
                            <span className="text-[9px] font-bold truncate max-w-full block leading-none">
                              {status === 'vacant' ? (
                                <span className="text-slate-600 font-medium">Vacant</span>
                              ) : (
                                occupantName.split(' ')[0]
                              )}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && subTab === 'inside' && (
          <div>
            {checkedInStudents.length === 0 ? (
              <div className="text-center py-16 backdrop-blur-md bg-app-surface/20 border border-app-border rounded-2xl">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No students are currently checked in.</p>
                <p className="text-xs text-slate-500 mt-1">Check-ins will appear live here as students scan their credentials at the kiosk gate.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {checkedInStudents.map((student) => (
                  <div
                    key={student.id}
                    className="backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl hover:border-violet-500/40 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-extrabold text-white text-base leading-tight">
                            {student.studentName}
                          </h4>
                          <span className="text-xs text-slate-400 font-mono tracking-wider">
                            ID: {student.registrationNo}
                          </span>
                        </div>
                        <span className="px-2.5 py-1 text-[10px] font-black uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                          Seat {student.seatNumber}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs border-t border-app-border/40 pt-3">
                        <div className="flex justify-between text-slate-400">
                          <span>Checked In:</span>
                          <span className="font-bold text-white">
                            {new Date(student.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Time Elapsed:</span>
                          <span className="font-mono font-bold text-violet-400">
                            {(() => {
                              const diff = new Date().getTime() - new Date(student.checkIn).getTime()
                              const h = Math.floor(diff / (1000 * 60 * 60))
                              const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                              return `${h}h ${m}m`
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Contact:</span>
                          <span className="text-slate-300 font-medium">{student.phone}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleForceCheckOut(student.registrationNo)}
                      className="w-full mt-4 py-2 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/30 text-red-400 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Force Checkout</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && subTab === 'today' && (
          <div className="backdrop-blur-md bg-app-surface/40 border border-app-border rounded-2xl overflow-hidden">
            {todayLogs.length === 0 ? (
              <div className="text-center py-16">
                <LogIn className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No check-in activity recorded today.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-app-border bg-slate-900/30 text-xs font-black uppercase text-slate-400 tracking-wider">
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">Seat No</th>
                      <th className="px-6 py-4">Check-In</th>
                      <th className="px-6 py-4">Check-Out</th>
                      <th className="px-6 py-4">Duration</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/40 text-xs">
                    {todayLogs.map((log) => {
                      const isInside = log.checkOut === null
                      const durationStr = log.checkOut
                        ? (() => {
                            const diff = new Date(log.checkOut).getTime() - new Date(log.checkIn).getTime()
                            const h = Math.floor(diff / (1000 * 60 * 60))
                            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                            return `${h}h ${m}m`
                          })()
                        : 'N/A'

                      return (
                        <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-white text-sm">{log.studentName}</div>
                            <div className="text-[10px] text-slate-500 font-mono tracking-wider">ID: {log.registrationNo} • {log.phone}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-slate-800 text-slate-300 font-bold rounded-md">
                              {log.seatNumber}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-300">
                            {new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-300">
                            {log.checkOut
                              ? new Date(log.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                              : '—'}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-400">
                            {durationStr}
                          </td>
                          <td className="px-6 py-4">
                            {isInside ? (
                              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase rounded-md">
                                Inside
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-500 text-[10px] font-black uppercase rounded-md">
                                Checked Out
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {isInside ? (
                              <button
                                onClick={() => handleForceCheckOut(log.registrationNo)}
                                className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/30 text-red-400 text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                              >
                                Checkout
                              </button>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!loading && subTab === 'history' && (
          <div className="space-y-4">
            <div className="backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div className="relative">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Search Student</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Name or Registration No"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={loadHistoryLogs}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-violet-600/10"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </button>

                {historyLogs.length > 0 && (
                  <button
                    onClick={exportToCSV}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/10"
                    title="Export CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="backdrop-blur-md bg-app-surface/40 border border-app-border rounded-2xl overflow-hidden">
              {historyLogs.length === 0 ? (
                <div className="text-center py-16">
                  <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium">No records matching the filters were found.</p>
                  <p className="text-xs text-slate-500 mt-1">Adjust dates or try searching for another term.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-app-border bg-slate-900/30 text-xs font-black uppercase text-slate-400 tracking-wider">
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Student</th>
                        <th className="px-6 py-4">Seat No</th>
                        <th className="px-6 py-4">Check-In</th>
                        <th className="px-6 py-4">Check-Out</th>
                        <th className="px-6 py-4">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border/40 text-xs">
                      {historyLogs.map((log) => {
                        const checkInTime = new Date(log.checkIn)
                        const checkOutTime = log.checkOut ? new Date(log.checkOut) : null
                        const durationStr = checkOutTime
                          ? (() => {
                              const diff = checkOutTime.getTime() - checkInTime.getTime()
                              const h = Math.floor(diff / (1000 * 60 * 60))
                              const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                              return `${h}h ${m}m`
                            })()
                          : 'Currently Inside'

                        return (
                          <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                            <td className="px-6 py-4 font-mono font-bold text-slate-400">
                              {log.date}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-white text-sm">{log.studentName}</div>
                              <div className="text-[10px] text-slate-500 font-mono tracking-wider">ID: {log.registrationNo} • {log.phone}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-slate-800 text-slate-300 font-bold rounded-md">
                                {log.seatNumber}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-300">
                              {checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-6 py-4 text-slate-300">
                              {checkOutTime
                                ? checkOutTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase rounded-md">Inside</span>}
                            </td>
                            <td className={`px-6 py-4 font-bold ${checkOutTime ? 'text-slate-400' : 'text-emerald-400'}`}>
                              {durationStr}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {!analyticsLoading && subTab === 'analytics' && (
          <AnalyticsViewPanel
            data={analyticsData}
            onSendOutreach={(student: any) => {
              setOutreachStudent(student)
              setOutreachMessage(`Hello ${student.name}, we noticed you haven't visited the library recently. Is everything okay? Please let us know if you need any assistance or wish to adjust your timings.`)
            }}
          />
        )}
      </div>

      {/* Seat Detail Modal */}
      {activeSeatDetail && (() => {
        const { status, bookingsList } = getSeatStatus(activeSeatDetail)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-app-bg border border-app-border rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
              <button
                onClick={() => setActiveSeatDetail(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/40 rounded-full p-1.5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-3 bg-violet-600/20 border border-violet-500/30 text-violet-400 rounded-2xl">
                  <Armchair className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">Seat {activeSeatDetail.seatNumber}</h3>
                  <p className="text-xs text-slate-400">{activeSeatDetail.areaName || 'General Zone'}</p>
                </div>
              </div>

              <div className="pt-2">
                {status === 'present' && (
                  <span className="px-3 py-1.5 text-xs font-black uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center gap-1.5 w-fit">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>Physically Present (Inside)</span>
                  </span>
                )}
                {status === 'absent' && (
                  <span className="px-3 py-1.5 text-xs font-black uppercase bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center gap-1.5 w-fit">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Absent (Not Checked-In)</span>
                  </span>
                )}
                {status === 'vacant' && (
                  <span className="px-3 py-1.5 text-xs font-black uppercase bg-slate-800 border border-slate-700 text-slate-400 rounded-xl flex items-center gap-1.5 w-fit">
                    <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                    <span>Vacant (Available)</span>
                  </span>
                )}
              </div>

              <div className="space-y-4 pt-2">
                {bookingsList.length === 0 ? (
                  <div className="bg-slate-900/40 border border-app-border/40 p-4 rounded-2xl text-center space-y-3">
                    <p className="text-xs text-slate-400">There are no active shift bookings for this seat.</p>
                    <button
                      onClick={() => {
                        setActiveSeatDetail(null)
                        if (setCurrentTab) {
                          setCurrentTab('seats')
                        }
                      }}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Configure Seating Booking
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 divide-y divide-app-border/40 max-h-60 overflow-y-auto pr-1">
                    {bookingsList.map((booking: any, idx: number) => (
                      <div key={booking.id} className={`space-y-3 ${idx > 0 ? 'pt-4' : ''}`}>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400 block font-medium">Student Name</span>
                            <span className="font-extrabold text-white text-sm block truncate">{booking.studentName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Phone</span>
                            <span className="font-bold text-slate-300 block">{booking.studentPhone}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/20 p-2.5 rounded-xl border border-app-border/30">
                          <div>
                            <span className="text-slate-400 block font-medium">Shift Timing</span>
                            <span className="font-bold text-white block">{booking.shiftName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Plan</span>
                            <span className="font-bold text-white block truncate">{booking.planName}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <div className="text-[10px] text-slate-500 font-medium">
                            Valid: {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            booking.isPresent 
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                              : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                          }`}>
                            {booking.isPresent ? 'Inside' : 'Absent'}
                          </span>
                        </div>

                        <div className="pt-1">
                          {booking.isPresent ? (
                            <button
                              onClick={() => {
                                if (booking.studentRegNo) {
                                  handleManualCheckOut(booking.studentRegNo)
                                } else {
                                  showToast('Student registration number missing.', 'error')
                                }
                              }}
                              disabled={manualCheckingIn}
                              className="w-full py-2 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/30 text-red-400 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              {manualCheckingIn ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <LogOut className="w-4 h-4" />
                              )}
                              <span>Force Checkout</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (booking.studentRegNo) {
                                  handleManualCheckIn(booking.studentRegNo)
                                } else {
                                  showToast('Student registration number missing.', 'error')
                                }
                              }}
                              disabled={manualCheckingIn}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-500/30 shadow-lg shadow-emerald-600/10"
                            >
                              {manualCheckingIn ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <LogIn className="w-4 h-4" />
                              )}
                              <span>Manual Check-In</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Outreach Message Modal */}
      {outreachStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-app-bg border border-app-border rounded-2xl w-full max-w-md p-6 relative shadow-2xl animate-fade-in text-left">
            <button
              onClick={() => setOutreachStudent(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/40 rounded-full p-1.5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-violet-600/20 border border-violet-500/30 text-violet-400 rounded-2xl">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">Student Outreach</h3>
                <p className="text-xs text-slate-400">Send WhatsApp reminder to {outreachStudent.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-xs bg-slate-900/30 border border-app-border/40 p-3 rounded-xl space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Registration No:</span>
                  <span className="font-bold text-white">{outreachStudent.registrationNo}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Phone:</span>
                  <span className="font-bold text-white">{outreachStudent.phone}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Attendance:</span>
                  <span className="font-bold text-amber-400">{outreachStudent.attendanceCount} check-ins ({outreachStudent.attendanceRate}% rate)</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Custom Message</label>
                <textarea
                  value={outreachMessage}
                  onChange={(e) => setOutreachMessage(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-900 border border-app-border rounded-xl p-3 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors placeholder:text-slate-600"
                  placeholder="Enter message text..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setOutreachStudent(null)}
                  className="px-4 py-2 border border-app-border hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setSendingOutreach(true)
                    try {
                      await api.post('/whatsapp/send-custom', {
                        studentId: outreachStudent.studentId,
                        message: outreachMessage
                      })
                      showToast(`WhatsApp reminder sent to ${outreachStudent.name}!`, 'success')
                      setOutreachStudent(null)
                    } catch (err: any) {
                      showToast(err.message || 'Failed to send outreach message', 'error')
                    } finally {
                      setSendingOutreach(false)
                    }
                  }}
                  disabled={sendingOutreach || !outreachMessage.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-violet-500/30 shadow-lg shadow-violet-600/15"
                >
                  {sendingOutreach ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Send Message</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// ANALYTICS & OUTREACH SUB-COMPONENT
// ==========================================
interface AnalyticsViewPanelProps {
  data: any
  onSendOutreach: (student: any) => void
}

function AnalyticsViewPanel({ data, onSendOutreach }: AnalyticsViewPanelProps) {
  if (!data) return (
    <div className="text-center py-16 backdrop-blur-md bg-app-surface/20 border border-app-border rounded-2xl">
      <RefreshCw className="w-8 h-8 text-slate-600 mx-auto mb-3 animate-spin" />
      <p className="text-slate-400 font-medium">Gathering library analytics...</p>
    </div>
  )

  // Process hourly counts to show only active hours (e.g., 6 AM to 10 PM) for better chart readability
  const activeHourlyData = data.hourlyCounts ? data.hourlyCounts.filter((h: any) => h.hour >= 6 && h.hour <= 22) : []

  return (
    <div className="space-y-6">
      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Busiest Hours */}
        <div className="backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl shadow-xl shadow-black/10">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Peak Check-In Hours</h3>
            <p className="text-xs text-slate-400">Hourly check-in volume aggregated over the last 30 days.</p>
          </div>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeHourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="hourLabel" stroke="#94a3b8" tickLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="count" fill="url(#violetGradient)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="violetGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#c084fc" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Attendance Trends */}
        <div className="backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl shadow-xl shadow-black/10">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Daily Attendance Trend</h3>
            <p className="text-xs text-slate-400">Total check-in count day-over-day for the last 14 days.</p>
          </div>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.dailyTrends || []}>
                <defs>
                  <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff'
                  }}
                />
                <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#emeraldGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Low Attendance / Inactive Students outreach table */}
      <div className="backdrop-blur-md bg-app-surface/40 border border-app-border rounded-2xl overflow-hidden shadow-xl shadow-black/10">
        <div className="p-5 border-b border-app-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/10">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Inactive & Low Attendance Students</h3>
            <p className="text-xs text-slate-400">Active seat bookings checking in less than 3 times or less than 50% frequency in the last 7 days.</p>
          </div>
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-semibold w-fit">
            ⚠️ {data.lowAttendanceList?.length || 0} Students Flagged
          </span>
        </div>

        {!data.lowAttendanceList || data.lowAttendanceList.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">All active students are checking in regularly!</p>
            <p className="text-xs text-slate-500 mt-1">No low-attendance warning flags raised in the last 7 days.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-app-border/60 bg-slate-900/40 text-[10px] uppercase tracking-wider text-slate-400 font-black">
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Seat Assigned</th>
                  <th className="px-6 py-4 text-center">Check-Ins (7d)</th>
                  <th className="px-6 py-4 text-center">Attendance Rate</th>
                  <th className="px-6 py-4">Last Checked-In</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/30">
                {data.lowAttendanceList.map((s: any) => {
                  let badgeStyle = 'bg-red-500/10 border border-red-500/20 text-red-400'
                  if (s.attendanceCount > 0) {
                    badgeStyle = 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  }

                  const formattedLastActive = s.lastActive 
                    ? new Date(s.lastActive).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Never'

                  return (
                    <tr key={s.studentId} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-sm">{s.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono tracking-wider">ID: {s.registrationNo} • {s.phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-800 text-slate-300 font-bold rounded-md">
                          {s.seatNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${badgeStyle}`}>
                          {s.attendanceCount} / 7 days
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-xs font-extrabold text-white">{s.attendanceRate}%</div>
                        <div className="text-[9px] text-slate-500 font-medium">Active {s.daysActive}d</div>
                      </td>
                      <td className="px-6 py-4 text-slate-300 text-xs">
                        {formattedLastActive}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => onSendOutreach(s)}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 ml-auto cursor-pointer border border-violet-500/30 shadow-md shadow-violet-600/10"
                        >
                          <Send className="w-3 h-3" />
                          <span>Outreach</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ==========================================
// VIEW 1: Dashboard View Component
// ==========================================
function DashboardView({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [expiring, setExpiring] = useState<ExpiringBooking[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingAlert, setSendingAlert] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [m, e, c] = await Promise.all([
        api.get('/dashboard/metrics'),
        api.get('/dashboard/expiring-bookings'),
        api.get('/dashboard/charts')
      ])
      setMetrics(m)
      setExpiring(e)
      setChartData(c)
    } catch (err: any) {
      showToast(err.message || 'Error loading dashboard metrics', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const triggerWhatsappAlert = async (bookingId: string, studentName: string) => {
    setSendingAlert(bookingId)
    try {
      await api.post('/whatsapp/send-manual', { bookingId })
      showToast(`WhatsApp reminder sent to ${studentName}!`, 'success')
    } catch (err: any) {
      showToast(err.message || 'WhatsApp configuration error. Configure API keys.', 'error')
    } finally {
      setSendingAlert(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Active Students" 
          value={metrics?.totalStudents || 0} 
          subtitle="Registered members"
          icon={<Users className="w-5 h-5" />} 
          color="violet"
        />
        <MetricCard 
          title="Seat Occupancy" 
          value={`${metrics?.occupancyRate || 0}%`} 
          subtitle={`${metrics?.occupiedSeats || 0}/${metrics?.totalSeats || 0} seats booked`}
          icon={<Armchair className="w-5 h-5" />} 
          color="emerald"
        />
        <MetricCard 
          title="Monthly Revenue" 
          value={`₹${metrics?.totalRevenue || 0}`} 
          subtitle="Fees collected"
          icon={<CreditCard className="w-5 h-5" />} 
          color="indigo"
        />
        <MetricCard 
          title="Dues Pending" 
          value={`₹${metrics?.pendingDues || 0}`} 
          subtitle="Next 10 days expected"
          icon={<AlertTriangle className="w-5 h-5" />} 
          color="rose"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Column */}
        <div className="lg:col-span-2 backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-white text-sm">Revenue & Membership Trends</h3>
              <p className="text-xs text-slate-400">Monthly aggregate data</p>
            </div>
            <button onClick={loadData} className="p-1.5 bg-app-border text-slate-400 hover:text-white rounded-lg transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#232d42" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }} 
                  labelStyle={{ color: 'var(--app-text)' }}
                  itemStyle={{ color: 'var(--app-text)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expiring Alerts Column */}
        <div className="backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl flex flex-col min-h-[350px]">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-white text-sm">Fee Expiring Alert</h3>
              <p className="text-xs text-slate-400">Membership ending within 3 days</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[280px]">
            {expiring.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <CheckCircle className="w-10 h-10 text-emerald-400/30 mb-2" />
                <span className="text-xs text-slate-400 font-medium">All students up-to-date!</span>
              </div>
            ) : (
              expiring.map((b) => (
                <div key={b.bookingId} className="bg-app-bg border border-app-border p-3 rounded-xl space-y-2.5 flex flex-col justify-between hover:border-violet-500/30 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">{b.studentName}</h4>
                      <span className="text-[10px] text-slate-400">Seat {b.seatNumber} ({b.shift} | {formatTimeTo12h(b.shiftStartTime)}-{formatTimeTo12h(b.shiftEndTime)})</span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-400 px-2 py-0.5 bg-rose-500/10 rounded-lg">
                      Expires: {new Date(b.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-t border-app-border pt-2">
                    <span className="text-[10px] text-slate-400">Due: ₹{b.dueAmount}</span>
                    <button 
                      onClick={() => triggerWhatsappAlert(b.bookingId, b.studentName)}
                      disabled={sendingAlert === b.bookingId}
                      className="px-2.5 py-1 bg-violet-600/20 hover:bg-violet-600 text-violet-400 hover:text-white rounded-lg text-[10px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {sendingAlert === b.bookingId ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      <span>Send Alert</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// KPI card helper
function MetricCard({ title, value, subtitle, icon, color }: { title: string; value: any; subtitle: string; icon: React.ReactNode; color: 'violet' | 'emerald' | 'indigo' | 'rose' }) {
  const colorMap = {
    violet: 'bg-violet-600/10 border-violet-500/20 text-violet-400 shadow-violet-600/5',
    emerald: 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400 shadow-emerald-600/5',
    indigo: 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400 shadow-indigo-600/5',
    rose: 'bg-rose-600/10 border-rose-500/20 text-rose-400 shadow-rose-600/5',
  }

  return (
    <div className={`backdrop-blur-md border p-4.5 rounded-2xl flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5 shadow-xl ${colorMap[color]}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</span>
        <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">{icon}</div>
      </div>
      <div>
        <h2 className="text-xl font-bold text-white leading-tight">{value}</h2>
        <span className="text-[10px] text-slate-400 leading-none">{subtitle}</span>
      </div>
    </div>
  )
}

// ==========================================
// VIEW 2: Student Management View Component
// ==========================================
function StudentsView({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState<'all' | 'pending'>('all')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const displayedStudents = students.filter(s => {
    if (filterTab === 'pending') {
      if (s.hasActiveBooking && !s.hasDues) {
        return false
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matches =
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.registrationNo && s.registrationNo.toLowerCase().includes(q))
      if (!matches) return false
    }
    return true
  })
  
  // Create student input states
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRegNo, setNewRegNo] = useState('')
  const [newAadharNo, setNewAadharNo] = useState('')
  const [nextAutoRegNo, setNextAutoRegNo] = useState<string>('1')  // preview for modal
  const [submitting, setSubmitting] = useState(false)

  // Edit student input states
  const [editStudentId, setEditStudentId] = useState('')
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editStatus, setEditStatus] = useState('ACTIVE')
  const [editRegNo, setEditRegNo] = useState('')
  const [editAadharNo, setEditAadharNo] = useState('')

  // Assignment during registration
  const [assignPlanId, setAssignPlanId] = useState('')
  const [assignSeatId, setAssignSeatId] = useState('')
  const [assignShiftId, setAssignShiftId] = useState('')
  const [assignPaymentMode, setAssignPaymentMode] = useState('UPI')
  const [bookAllShifts, setBookAllShifts] = useState(false)
  const [availableSeats, setAvailableSeats] = useState<Seat[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])

  const fetchStudents = async (bypassCache = false) => {
    setLoading(true)
    try {
      const [pData, sData, shData] = await Promise.all([
        loadCachedPlans(bypassCache),
        api.get('/seats').catch(() => []),
        loadCachedShifts(bypassCache)
      ])
      setPlans(pData)
      setShifts(shData)
      setAvailableSeats(sData.filter((s: Seat) => s.status === 'AVAILABLE'))
      
      if (shData.length > 0 && !assignShiftId) {
        setAssignShiftId(shData[0].id)
      }

      const stData = await loadCachedStudents(bypassCache)
      setStudents(stData)
    } catch (err: any) {
      showToast(err.message || 'Error loading students', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents(false)
  }, [])

  // Open Add Student modal and fetch the next auto reg-no preview
  const openAddModal = async () => {
    try {
      const regSettings = await api.get('/tenant/reg-settings')
      setNextAutoRegNo(regSettings.nextRegNo || '1')
    } catch {
      setNextAutoRegNo('1')
    }
    setIsAddModalOpen(true)
  }

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const student = await api.post('/students', {
        name: newName,
        phone: newPhone,
        email: newEmail || undefined,
        registrationNo: newRegNo.trim() || undefined,
        aadharNo: newAadharNo.trim() || undefined,
      })
      
      // If plan and seat are selected, book the seat
      if (assignPlanId && assignSeatId) {
        await api.post('/seats/book', {
          studentId: student.id,
          seatId: assignSeatId,
          planId: assignPlanId,
          shiftId: bookAllShifts ? undefined : assignShiftId,
          bookAllShifts,
          paymentMode: assignPaymentMode,
        })
      }

      showToast('Student registered successfully!', 'success')
      setIsAddModalOpen(false)
      // Reset inputs
      setNewName('')
      setNewPhone('')
      setNewEmail('')
      setNewRegNo('')
      setNewAadharNo('')
      setAssignPlanId('')
      setAssignSeatId('')
      setAssignShiftId(shifts[0]?.id || '')
      setAssignPaymentMode('UPI')
      setBookAllShifts(false)
      fetchStudents(true)
    } catch (err: any) {
      showToast(err.message || 'Error adding student', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditClick = (student: Student) => {
    setEditStudentId(student.id)
    setEditName(student.name)
    setEditPhone(student.phone)
    setEditEmail(student.email || '')
    setEditStatus(student.status)
    setEditRegNo(student.registrationNo || '')
    setEditAadharNo(student.aadharNo || '')
    setIsEditModalOpen(true)
  }

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.put(`/students/${editStudentId}`, {
        name: editName,
        phone: editPhone,
        email: editEmail || undefined,
        status: editStatus,
        registrationNo: editRegNo.trim() || undefined,
        aadharNo: editAadharNo.trim() || undefined,
      })
      showToast('Student details updated!', 'success')
      setIsEditModalOpen(false)
      fetchStudents(true)
    } catch (err: any) {
      showToast(err.message || 'Failed to update student', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteStudent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this student? All history will be deleted.')) return
    try {
      await api.delete(`/students/${id}`)
      showToast('Student deleted successfully', 'success')
      fetchStudents(true)
    } catch (err: any) {
      showToast(err.message || 'Failed to delete student', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="Search by name, phone, reg number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-app-surface border border-app-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>

          {/* Filter Toggles */}
          <div className="flex bg-app-surface p-1 rounded-xl border border-app-border">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                filterTab === 'all' 
                  ? 'bg-violet-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({students.length})
            </button>
            <button
              onClick={() => setFilterTab('pending')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'pending' 
                  ? 'bg-rose-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Fee Pending ({students.filter(s => !s.hasActiveBooking || s.hasDues).length})
            </button>
          </div>
        </div>

        <button 
          onClick={openAddModal}
          className="bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 transition-colors self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Student</span>
        </button>
      </div>

      {/* Student List */}
      <div className="backdrop-blur-md bg-app-surface/40 border border-app-border rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 flex justify-center"><RefreshCw className="w-6 h-6 text-violet-500 animate-spin" /></div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <Users className="w-8 h-8 opacity-30" />
            <span>No students found.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-app-border bg-app-surface/65 text-slate-400 font-medium">
                  <th className="px-5 py-4">Reg Code / Name</th>
                  <th className="px-5 py-4">Phone / Email</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Active Booking</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {displayedStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-app-surface/20 transition-colors">
                    <td className="px-5 py-4">
                      <div>
                        <div className="font-bold text-white text-sm">{s.name}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{s.registrationNo}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <div className="font-medium text-slate-200">{s.phone}</div>
                        <span className="text-[10px] text-slate-400">{s.email || '-'}</span>
                        {s.aadharNo && (
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5 text-slate-500" />
                            ••••-••••-{s.aadharNo.slice(-4)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${
                          s.status === 'ACTIVE' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        }`}>
                          {s.status}
                        </span>

                        {s.hasActiveBooking ? (
                          s.hasDues ? (
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1" title="Dues Pending">
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-400" /> Due: ₹{s.dueAmount}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Paid
                            </span>
                          )
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20" title="No Active Seat Assigned">
                            Unbooked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {s.activeSeat ? (
                        <div>
                          <div className="font-bold text-violet-400">Seat {s.activeSeat}</div>
                          <span className="text-[10px] text-slate-400 truncate block max-w-[200px]" title={`${s.activePlan} (${s.activeShift} | ${s.activeShiftTime})`}>
                            {s.activePlan} ({s.activeShift} | {s.activeShiftTime})
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">No Seat Assigned</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleEditClick(s)}
                        className="text-violet-400 hover:text-violet-300 font-semibold text-xs inline-flex items-center gap-1 bg-violet-600/10 px-2 py-1 rounded-lg"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteStudent(s.id)}
                        className="text-red-400 hover:text-red-300 font-semibold text-xs bg-red-600/10 px-2 py-1 rounded-lg"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-app-bg/70 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}>
          <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-app-bg p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-base text-white mb-4">Register New Student</h3>
            
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Full Name</label>
                <input 
                  type="text" required placeholder="John Doe" 
                  value={newName} onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Phone Mobile</label>
                <input 
                  type="text" required placeholder="+91..." 
                  value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email <span className="normal-case text-slate-500">(Optional)</span></label>
                <input 
                  type="email" placeholder="john@example.com" 
                  value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Reg. Number <span className="normal-case text-slate-500">(Optional)</span></label>
                  <input 
                    type="text" placeholder="e.g. LIB-2024-001" 
                    value={newRegNo} onChange={(e) => setNewRegNo(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                   <p className="text-[9px] text-slate-500 mt-1">
                    {newRegNo.trim() ? (
                      <span className="text-violet-400">Will use: <strong>{newRegNo.trim()}</strong></span>
                    ) : (
                      <span>Auto-assign: <strong className="text-violet-400">{nextAutoRegNo}</strong></span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Aadhar No. <span className="normal-case text-slate-500">(Optional)</span></label>
                  <input 
                    type="text" placeholder="12-digit number" 
                    maxLength={12}
                    value={newAadharNo} onChange={(e) => setNewAadharNo(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 font-mono tracking-wider"
                  />
                  <p className="text-[9px] text-slate-500 mt-1">{newAadharNo.length}/12 digits</p>
                </div>
              </div>

              <div className="border-t border-app-border pt-4 mt-2">
                <h4 className="text-[10px] font-bold text-white mb-3 uppercase tracking-wider">Purchase Membership (Optional)</h4>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Select Plan</label>
                    <select
                      value={assignPlanId}
                      onChange={(e) => {
                        setAssignPlanId(e.target.value)
                        const selectedPlan = plans.find(p => p.id === e.target.value)
                        if (selectedPlan) {
                          setAssignShiftId(selectedPlan.shiftId)
                        }
                      }}
                      className="w-full bg-app-bg border border-app-border rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="">-- No Plan --</option>
                      {plans.map((pl) => (
                        <option key={pl.id} value={pl.id}>{pl.name} (₹{pl.price})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Assign Seat</label>
                    <select
                      value={assignSeatId}
                      onChange={(e) => setAssignSeatId(e.target.value)}
                      required={!!assignPlanId}
                      className="w-full bg-app-bg border border-app-border rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="">-- No Seat --</option>
                      {availableSeats.map((se) => (
                        <option key={se.id} value={se.id}>{se.seatNumber} ({se.areaName.slice(0, 10)})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {assignPlanId && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="checkbox"
                        id="bookAllShifts"
                        checked={bookAllShifts}
                        onChange={(e) => setBookAllShifts(e.target.checked)}
                        className="accent-primary-600 rounded border-app-border focus:ring-primary-500"
                      />
                      <label htmlFor="bookAllShifts" className="text-[10px] font-semibold text-slate-400 cursor-pointer">
                        Book Full Seat (All Shifts)
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {!bookAllShifts ? (
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Confirm Shift</label>
                          <select
                            value={assignShiftId}
                            onChange={(e) => setAssignShiftId(e.target.value)}
                            className="w-full bg-app-bg border border-app-border rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none"
                          >
                            {shifts.map((sh) => (
                              <option key={sh.id} value={sh.id}>{sh.name} ({formatTimeTo12h(sh.startTime)}-{formatTimeTo12h(sh.endTime)})</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Confirm Shift</label>
                          <div className="w-full bg-app-bg/50 border border-app-border/50 rounded-xl px-2 py-2 text-[11px] text-slate-400 leading-normal">
                            All Shifts (Full)
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Payment Mode</label>
                        <select
                          value={assignPaymentMode}
                          onChange={(e) => setAssignPaymentMode(e.target.value)}
                          className="w-full bg-app-bg border border-app-border rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none"
                        >
                          <option value="UPI">UPI</option>
                          <option value="CASH">CASH</option>
                          <option value="CARD">CARD</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 bg-app-border hover:bg-app-border/70 text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 rounded-xl text-xs flex justify-center items-center"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-app-bg/70 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}>
          <div className="w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-app-bg p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-base text-white mb-4">Edit Student Details</h3>
            
            <form onSubmit={handleUpdateStudent} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Full Name</label>
                <input 
                  type="text" required placeholder="John Doe" 
                  value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Phone Mobile</label>
                <input 
                  type="text" required placeholder="+91..." 
                  value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email <span className="normal-case text-slate-500">(Optional)</span></label>
                <input 
                  type="email" placeholder="john@example.com" 
                  value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Reg. Number <span className="normal-case text-slate-500">(Optional)</span></label>
                  <input 
                    type="text" placeholder="e.g. LIB-2024-001" 
                    value={editRegNo} onChange={(e) => setEditRegNo(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Aadhar No. <span className="normal-case text-slate-500">(Optional)</span></label>
                  <input 
                    type="text" placeholder="12-digit number" 
                    maxLength={12}
                    value={editAadharNo} onChange={(e) => setEditAadharNo(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 font-mono tracking-wider"
                  />
                  <p className="text-[9px] text-slate-500 mt-1">{editAadharNo.length}/12 digits</p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="ACTIVE">Active Member</option>
                  <option value="INACTIVE">Inactive / Blocked</option>
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 bg-app-border hover:bg-app-border/70 text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 rounded-xl text-xs flex justify-center items-center"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// VIEW 3: Seat Management View Component
// ==========================================
function SeatsView({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [seats, setSeats] = useState<Seat[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [activeShiftId, setActiveShiftId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  
  // Booking modals
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null)
  const [isBookModalOpen, setIsBookModalOpen] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [shiftId, setShiftId] = useState('')
  const [paymentMode, setPaymentMode] = useState('UPI')
  const [bookingSubmit, setBookingSubmit] = useState(false)
  const [bookAllShiftsSeat, setBookAllShiftsSeat] = useState(false)

  // Creation modal
  const [isAddSeatModalOpen, setIsAddSeatModalOpen] = useState(false)
  const [newSeatNumber, setNewSeatNumber] = useState('')
  const [newAreaName, setNewAreaName] = useState('General Hall')

  const fetchSeats = async (bypassCache = false) => {
    setLoading(true)
    try {
      const [sData, stData, pData, shData] = await Promise.all([
        api.get('/seats'),
        loadCachedStudents(bypassCache),
        loadCachedPlans(bypassCache),
        loadCachedShifts(bypassCache)
      ])
      setSeats(sData)
      setStudents(stData.filter((st: Student) => !st.activeSeat))
      setPlans(pData)
      setShifts(shData)
      
      if (shData.length > 0) {
        if (!activeShiftId) {
          setActiveShiftId(shData[0].id)
        }
        if (!shiftId) {
          setShiftId(shData[0].id)
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading seating information', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSeats(false)
  }, [])

  const handleBookSeat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId || !selectedPlanId || !selectedSeat || (!bookAllShiftsSeat && !shiftId)) {
      showToast('Please select all booking parameters', 'error')
      return
    }

    setBookingSubmit(true)
    try {
      await api.post('/seats/book', {
        studentId: selectedStudentId,
        seatId: selectedSeat.id,
        planId: selectedPlanId,
        shiftId: bookAllShiftsSeat ? undefined : shiftId,
        paymentMode,
        bookAllShifts: bookAllShiftsSeat,
      })
      showToast(`Seat ${selectedSeat.seatNumber} booked successfully!`, 'success')
      setIsBookModalOpen(false)
      setSelectedSeat(null)
      setBookAllShiftsSeat(false)
      fetchSeats(true)
    } catch (err: any) {
      showToast(err.message || 'Booking failed', 'error')
    } finally {
      setBookingSubmit(false)
    }
  }

  const handleReleaseSeat = async (seatId: string, bookingId: string, seatNumber: string) => {
    if (!window.confirm(`Are you sure you want to release seat ${seatNumber} for this shift?`)) return
    try {
      await api.post('/seats/release', { seatId, bookingId })
      showToast(`Seat ${seatNumber} booking released!`, 'success')
      setSelectedSeat(null)
      fetchSeats(true)
    } catch (err: any) {
      showToast(err.message || 'Release failed', 'error')
    }
  }

  const handleCreateSeat = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/seats', { seatNumber: newSeatNumber, areaName: newAreaName })
      showToast(`Seat ${newSeatNumber} created!`, 'success')
      setIsAddSeatModalOpen(false)
      setNewSeatNumber('')
      fetchSeats(true)
    } catch (err: any) {
      showToast(err.message || 'Error creating seat', 'error')
    }
  }

  // Active shift object helper
  const activeShiftObj = shifts.find(s => s.id === activeShiftId)

  return (
    <div className="space-y-6">
      {/* Header action bar */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="font-bold text-white text-sm">Interactive Room Grid</h3>
          <p className="text-xs text-slate-400">Select shift timing, click seat to manage</p>
        </div>
        <button 
          onClick={() => setIsAddSeatModalOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Seat</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><RefreshCw className="w-6 h-6 text-violet-500 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Grid Layout Column */}
          <div className="md:col-span-2 backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl space-y-5">
            {/* Shifts Toggler bar */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">View Shift Timing</label>
              <div className="flex flex-wrap gap-2">
                {shifts.map((sh) => (
                  <button
                    key={sh.id}
                    onClick={() => {
                      setActiveShiftId(sh.id)
                      setSelectedSeat(null) // Reset selection
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeShiftId === sh.id 
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' 
                        : 'bg-app-bg text-slate-400 border border-app-border hover:text-white'
                    }`}
                  >
                    {sh.name} ({formatTimeTo12h(sh.startTime)}-{formatTimeTo12h(sh.endTime)})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-emerald-500 rounded-md"></span>
                  <span className="text-slate-300">Available (Active Shift)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-rose-500 rounded-md"></span>
                  <span className="text-slate-300">Occupied (Any Shift)</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
              {seats.map((seat) => {
                // Find if there is an active booking on this seat for the active shift
                const isOccupied = seat.bookings.length > 0
                return (
                  <button
                    key={seat.id}
                    onClick={() => {
                      setSelectedSeat(seat)
                      if (!isOccupied) {
                        setShiftId(activeShiftId) // default dropdown to selected shift
                        setIsBookModalOpen(true)
                      }
                    }}
                    className={`aspect-square rounded-xl border flex flex-col justify-center items-center relative transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                      isOccupied 
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' 
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                  >
                    <Armchair className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">{seat.seatNumber}</span>
                    <span className="text-[8px] text-slate-400">{seat.areaName.slice(0, 10)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selection Detail Column */}
          <div className="backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl min-h-[300px]">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-app-border">
              <Info className="w-5 h-5 text-violet-400" />
              <h3 className="font-bold text-white text-sm">Seat Details</h3>
            </div>

            {selectedSeat ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Seat Code</label>
                  <p className="text-lg font-bold text-white">{selectedSeat.seatNumber}</p>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Location / Area</label>
                  <p className="text-xs text-slate-200">{selectedSeat.areaName}</p>
                </div>

                {/* Show status specifically for the selected shift */}
                {(() => {
                  const activeBooking = selectedSeat.bookings.find(b => b.shiftId === activeShiftId)
                  return activeBooking ? (
                    <div className="bg-app-bg border border-app-border p-3 rounded-xl space-y-3 mt-4">
                      <div className="space-y-1">
                        <span className="text-[10px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded font-bold">Occupied for {activeShiftObj?.name}</span>
                        <p className="text-sm font-bold text-white leading-none mt-2">{activeBooking.studentName}</p>
                        <span className="text-[10px] text-slate-400 font-semibold">{activeBooking.studentPhone}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-app-border pt-2">
                        <div>
                          <span className="text-slate-500 font-medium">Plan duration:</span>
                          <p className="font-semibold text-slate-300">{activeBooking.planName}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Shift timing:</span>
                          <p className="font-semibold text-slate-300">{activeBooking.shiftName}</p>
                        </div>
                      </div>

                      <div className="text-[10px] leading-tight">
                        <span className="text-slate-500 font-medium">Valid until:</span>
                        <p className="font-bold text-amber-400">{new Date(activeBooking.endDate).toLocaleDateString()}</p>
                      </div>

                      <button
                        onClick={() => handleReleaseSeat(selectedSeat.id, activeBooking.id, selectedSeat.seatNumber)}
                        className="w-full mt-2 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-semibold py-2 rounded-xl transition-all"
                      >
                        Release Seat (Free space)
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status for {activeShiftObj?.name}</label>
                        <p className="text-xs font-bold text-emerald-400">AVAILABLE</p>
                      </div>
                      
                      {selectedSeat.bookings.length > 0 && (
                        <div className="bg-app-bg border border-app-border p-2.5 rounded-xl space-y-1.5 text-[10px]">
                          <span className="text-slate-400 font-semibold block">Booked in other shifts:</span>
                          {selectedSeat.bookings.map(b => (
                            <div key={b.id} className="flex justify-between border-b border-app-border/30 py-0.5 last:border-0 text-slate-300">
                              <span>{b.shiftName} ({formatTimeTo12h(b.shiftStartTime)}-{formatTimeTo12h(b.shiftEndTime)})</span>
                              <span className="font-medium text-slate-400">{b.studentName}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => setIsBookModalOpen(true)}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 rounded-xl text-xs transition-colors"
                      >
                        Book Seat for {activeShiftObj?.name}
                      </button>
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div className="h-48 flex flex-col justify-center items-center text-center text-xs text-slate-500">
                <Armchair className="w-10 h-10 opacity-20 mb-2" />
                <span>Select a seat from the layout to check details or assign bookings.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Book Seat Modal */}
      {isBookModalOpen && selectedSeat && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-app-bg/70 backdrop-blur-sm" onClick={() => setIsBookModalOpen(false)}>
          <div className="w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsBookModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-app-bg p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-base text-white mb-4">Book Seat - {selectedSeat.seatNumber}</h3>
            
            <form onSubmit={handleBookSeat} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Select Student</label>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="">-- Choose Available Student --</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>{st.name} ({st.phone})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="bookAllShiftsSeat"
                  checked={bookAllShiftsSeat}
                  onChange={(e) => setBookAllShiftsSeat(e.target.checked)}
                  className="accent-primary-600 rounded border-app-border focus:ring-primary-500"
                />
                <label htmlFor="bookAllShiftsSeat" className="text-[10px] font-semibold text-slate-400 cursor-pointer">
                  Book Full Seat (All Shifts)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {!bookAllShiftsSeat ? (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Select Shift</label>
                    <select
                      required
                      value={shiftId}
                      onChange={(e) => setShiftId(e.target.value)}
                      className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      {shifts.map((sh) => (
                        <option key={sh.id} value={sh.id}>{sh.name} ({formatTimeTo12h(sh.startTime)}-{formatTimeTo12h(sh.endTime)})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Select Shift</label>
                    <div className="w-full bg-app-bg/50 border border-app-border/50 rounded-xl px-3 py-2 text-xs text-slate-400 leading-normal">
                      All Shifts (Full)
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Select Plan</label>
                  <select
                    required
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="">-- Choose Plan --</option>
                    {plans.map((pl) => (
                      <option key={pl.id} value={pl.id}>{pl.name} (₹{pl.price})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {['UPI', 'CASH', 'CARD'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                        paymentMode === mode 
                          ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-600/10' 
                          : 'bg-app-bg text-slate-400 border-app-border hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => { setIsBookModalOpen(false); setSelectedSeat(null); }}
                  className="flex-1 bg-app-border hover:bg-app-border/70 text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={bookingSubmit}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 rounded-xl text-xs flex justify-center items-center"
                >
                  {bookingSubmit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Seat Modal */}
      {isAddSeatModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-app-bg/70 backdrop-blur-sm" onClick={() => setIsAddSeatModalOpen(false)}>
          <div className="w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsAddSeatModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-app-bg p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-base text-white mb-4">Add Library Seat</h3>
            
            <form onSubmit={handleCreateSeat} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Seat Code / Number</label>
                <input 
                  type="text" required placeholder="e.g. S-10, A-5" 
                  value={newSeatNumber} onChange={(e) => setNewSeatNumber(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Area / Room Name</label>
                <input 
                  type="text" required placeholder="e.g. Silent Hall, Discussion Room" 
                  value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsAddSeatModalOpen(false)}
                  className="flex-1 bg-app-border text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// VIEW 4: Plan & Shifts Configuration View
// ==========================================
function PlansAndShiftsView({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<'plans' | 'shifts'>('plans')

  // Modals state
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false)
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false)
  const [isEditShiftModalOpen, setIsEditShiftModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Plan creation fields
  const [planName, setPlanName] = useState('')
  const [durationDays, setDurationDays] = useState(30)
  const [price, setPrice] = useState('')
  const [planShiftId, setPlanShiftId] = useState('')

  // Shift creation fields
  const [shiftName, setShiftName] = useState('')
  const [startTime, setStartTime] = useState('06:00')
  const [endTime, setEndTime] = useState('11:00')

  // Plan edit fields
  const [editPlanId, setEditPlanId] = useState('')
  const [editPlanName, setEditPlanName] = useState('')
  const [editDurationDays, setEditDurationDays] = useState(30)
  const [editPrice, setEditPrice] = useState('')
  const [editPlanShiftId, setEditPlanShiftId] = useState('')

  // Shift edit fields
  const [editShiftId, setEditShiftId] = useState('')
  const [editShiftName, setEditShiftName] = useState('')
  const [editStartTime, setEditStartTime] = useState('06:00')
  const [editEndTime, setEditEndTime] = useState('11:00')

  const loadData = async (bypassCache = false) => {
    setLoading(true)
    try {
      const [pData, sData] = await Promise.all([
        loadCachedPlans(bypassCache),
        loadCachedShifts(bypassCache)
      ])
      setPlans(pData)
      setShifts(sData)
      
      if (sData.length > 0 && !planShiftId) {
        setPlanShiftId(sData[0].id)
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading pricing plans', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(false)
  }, [])

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!planShiftId) {
      showToast('You must create a Shift Timing first before adding a Plan!', 'error')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/plans', {
        name: planName,
        durationDays,
        price,
        shiftId: planShiftId,
      })
      showToast('Membership Plan created successfully!', 'success')
      setIsPlanModalOpen(false)
      setPlanName('')
      setDurationDays(30)
      setPrice('')
      loadData(true)
    } catch (err: any) {
      showToast(err.message || 'Failed to create plan', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePlan = async (id: string) => {
    if (!window.confirm('Delete this plan?')) return
    try {
      await api.delete(`/plans/${id}`)
      showToast('Plan deleted successfully', 'success')
      loadData(true)
    } catch (err: any) {
      showToast(err.message || 'Cannot delete plan: Busy bookings present.', 'error')
    }
  }

  const handleEditPlanClick = (p: Plan) => {
    setEditPlanId(p.id)
    setEditPlanName(p.name)
    setEditDurationDays(p.durationDays)
    setEditPrice(String(p.price))
    setEditPlanShiftId(p.shiftId)
    setIsEditPlanModalOpen(true)
  }

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.put(`/plans/${editPlanId}`, {
        name: editPlanName,
        durationDays: editDurationDays,
        price: editPrice,
        shiftId: editPlanShiftId,
      })
      showToast('Membership Plan updated successfully!', 'success')
      setIsEditPlanModalOpen(false)
      loadData(true)
    } catch (err: any) {
      showToast(err.message || 'Failed to update plan', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/shifts', {
        name: shiftName,
        startTime,
        endTime,
      })
      showToast(`Shift ${shiftName} created!`, 'success')
      setIsShiftModalOpen(false)
      setShiftName('')
      setStartTime('06:00')
      setEndTime('11:00')
      loadData(true)
    } catch (err: any) {
      showToast(err.message || 'Failed to create shift', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteShift = async (id: string) => {
    if (!window.confirm('Delete this Shift Timing? All plans linked to it must be deleted first.')) return
    try {
      await api.delete(`/shifts/${id}`)
      showToast('Shift deleted successfully', 'success')
      loadData(true)
    } catch (err: any) {
      showToast(err.message || 'Cannot delete: Ensure no plans or active students use this shift.', 'error')
    }
  }

  const handleEditShiftClick = (sh: Shift) => {
    setEditShiftId(sh.id)
    setEditShiftName(sh.name)
    setEditStartTime(sh.startTime)
    setEditEndTime(sh.endTime)
    setIsEditShiftModalOpen(true)
  }

  const handleUpdateShift = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.put(`/shifts/${editShiftId}`, {
        name: editShiftName,
        startTime: editStartTime,
        endTime: editEndTime,
      })
      showToast('Shift timing updated successfully!', 'success')
      setIsEditShiftModalOpen(false)
      loadData(true)
    } catch (err: any) {
      showToast(err.message || 'Failed to update shift', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Sub-tab selection bar */}
      <div className="flex justify-between items-center border-b border-app-border pb-3 flex-wrap gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSubTab('plans')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
              subTab === 'plans' 
                ? 'bg-violet-600/10 text-violet-400 border border-violet-500/30' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Membership Packages
          </button>
          <button
            type="button"
            onClick={() => setSubTab('shifts')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
              subTab === 'shifts' 
                ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Library Shifts Settings
          </button>
        </div>

        {subTab === 'plans' ? (
          <button 
            type="button"
            onClick={() => setIsPlanModalOpen(true)}
            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Membership Plan</span>
          </button>
        ) : (
          <button 
            type="button"
            onClick={() => setIsShiftModalOpen(true)}
            className="bg-[#10b981] hover:bg-[#10b981]/80 text-white font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#10b981]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Shift Timing</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><RefreshCw className="w-6 h-6 text-violet-500 animate-spin" /></div>
      ) : subTab === 'plans' ? (
        plans.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <CreditCard className="w-8 h-8 opacity-30" />
            <span>No subscription plans created yet.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => (
              <div key={p.id} className="backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl flex flex-col justify-between space-y-4 hover:border-violet-500/20 transition-colors">
                <div>
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-bold text-white leading-tight">{p.name}</h4>
                    <span className="text-[9px] font-bold text-violet-400 px-2 py-0.5 bg-violet-600/10 rounded-lg uppercase tracking-wider">
                      {p.shift?.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{p.durationDays} Days Membership</p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Timing: {p.shift && `${formatTimeTo12h(p.shift.startTime)} - ${formatTimeTo12h(p.shift.endTime)}`}</span>
                  </p>
                </div>

                <div className="flex justify-between items-end border-t border-app-border pt-4">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Pricing</span>
                    <p className="text-lg font-bold text-white">₹{p.price}</p>
                  </div>
                   <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleEditPlanClick(p)}
                      className="text-xs font-semibold text-violet-400 hover:text-violet-300 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(p.id)}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : shifts.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
          <Clock className="w-8 h-8 opacity-30" />
          <span>No shifts registered yet. Libraries require shifts to assign seat slots.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((sh) => (
            <div key={sh.id} className="backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl flex flex-col justify-between space-y-4 hover:border-emerald-500/20 transition-colors">
              <div>
                <h4 className="text-sm font-bold text-white leading-tight">{sh.name}</h4>
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-2 font-mono">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{formatTimeTo12h(sh.startTime)} to {formatTimeTo12h(sh.endTime)}</span>
                </p>
              </div>

              <div className="flex justify-end border-t border-app-border pt-4 gap-3">
                <button
                  type="button"
                  onClick={() => handleEditShiftClick(sh)}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteShift(sh.id)}
                  className="text-xs font-semibold text-red-400 hover:text-red-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Plan Modal */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-app-bg/70 backdrop-blur-sm" onClick={() => setIsPlanModalOpen(false)}>
          <div className="w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsPlanModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-app-bg p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-base text-white mb-4">Create Membership Plan</h3>
            
            {shifts.length === 0 ? (
              <div className="space-y-4 text-center py-2">
                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/30 text-amber-500 inline-block">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-xs text-white">No Shifts Timings Registered</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed px-2">
                  You must create at least one Library Shift timing before you can define pricing/membership plans.
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlanModalOpen(false)
                      setSubTab('shifts')
                      setIsShiftModalOpen(true)
                    }}
                    className="w-full bg-[#10b981] hover:bg-[#10b981]/80 text-white font-semibold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Go Create Library Shift
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPlanModalOpen(false)}
                    className="w-full bg-app-border hover:bg-app-border/85 text-white font-semibold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreatePlan} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Plan Display Name</label>
                  <input 
                    type="text" required placeholder="e.g. Monthly Standard" 
                    value={planName} onChange={(e) => setPlanName(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Duration (Days)</label>
                    <input 
                      type="number" required value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Price (INR)</label>
                    <input 
                      type="number" required placeholder="₹" value={price} onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Link to Shift Timing</label>
                  <select
                    required
                    value={planShiftId}
                    onChange={(e) => setPlanShiftId(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="">-- Choose Shift --</option>
                    {shifts.map((sh) => (
                      <option key={sh.id} value={sh.id}>{sh.name} ({formatTimeTo12h(sh.startTime)}-{formatTimeTo12h(sh.endTime)})</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 mt-6">
                  <button 
                    type="button" 
                    onClick={() => setIsPlanModalOpen(false)}
                    className="flex-1 bg-app-border text-white font-semibold py-2 rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 rounded-xl text-xs flex justify-center items-center cursor-pointer"
                  >
                    {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Create Plan'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {isEditPlanModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-app-bg/70 backdrop-blur-sm" onClick={() => setIsEditPlanModalOpen(false)}>
          <div className="w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsEditPlanModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-app-bg p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-base text-white mb-4">Edit Membership Plan</h3>
            
            <form onSubmit={handleUpdatePlan} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Plan Display Name</label>
                <input 
                  type="text" required placeholder="e.g. Monthly Standard" 
                  value={editPlanName} onChange={(e) => setEditPlanName(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Duration (Days)</label>
                  <input 
                    type="number" required value={editDurationDays} onChange={(e) => setEditDurationDays(Number(e.target.value))}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Price (INR)</label>
                  <input 
                    type="number" required placeholder="₹" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Link to Shift Timing</label>
                <select
                  required
                  value={editPlanShiftId}
                  onChange={(e) => setEditPlanShiftId(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {shifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>{sh.name} ({formatTimeTo12h(sh.startTime)}-{formatTimeTo12h(sh.endTime)})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsEditPlanModalOpen(false)}
                  className="flex-1 bg-app-border text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 rounded-xl text-xs flex justify-center items-center"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Shift Modal */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-app-bg/70 backdrop-blur-sm" onClick={() => setIsShiftModalOpen(false)}>
          <div className="w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsShiftModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-app-bg p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-base text-white mb-4">Create Library Shift</h3>
            
            <form onSubmit={handleCreateShift} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Shift Display Name</label>
                <input 
                  type="text" required placeholder="e.g. Shift A, Morning slot" 
                  value={shiftName} onChange={(e) => setShiftName(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Start Time</label>
                  <input 
                    type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">End Time</label>
                  <input 
                    type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsShiftModalOpen(false)}
                  className="flex-1 bg-app-border text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-xl text-xs flex justify-center items-center"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Shift Modal */}
      {isEditShiftModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-app-bg/70 backdrop-blur-sm" onClick={() => setIsEditShiftModalOpen(false)}>
          <div className="w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsEditShiftModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-app-bg p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-base text-white mb-4">Edit Library Shift</h3>
            
            <form onSubmit={handleUpdateShift} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Shift Display Name</label>
                <input 
                  type="text" required placeholder="e.g. Shift A, Morning slot" 
                  value={editShiftName} onChange={(e) => setEditShiftName(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Start Time</label>
                  <input 
                    type="time" required value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">End Time</label>
                  <input 
                    type="time" required value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsEditShiftModalOpen(false)}
                  className="flex-1 bg-app-border text-white font-semibold py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#10b981] hover:bg-[#10b981]/80 text-white font-semibold py-2 rounded-xl text-xs flex justify-center items-center"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// VIEW 5: WhatsApp Integration Component
// ==========================================
// ==========================================
// VIEW 5: Settings (Profile & WhatsApp Config) View
// ==========================================
interface SettingsViewProps {
  showToast: (msg: string, type?: 'success' | 'error') => void
  setTenantName: (name: string) => void
  setLogoUrl: (url: string | null) => void
}

function SettingsView({ showToast, setTenantName, setLogoUrl }: SettingsViewProps) {
  const [subTab, setSubTab] = useState<'profile' | 'whatsapp' | 'license'>('profile')
  const [loading, setLoading] = useState(true)

  // Profile States
  const [libName, setLibName] = useState('')
  const [libOwnerName, setLibOwnerName] = useState('')
  const [libPhone, setLibPhone] = useState('')
  const [libAddress, setLibAddress] = useState('')
  const [libLogoUrl, setLibLogoUrl] = useState('')
  const [libLastRegNo, setLibLastRegNo] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingRegNo, setSavingRegNo] = useState(false)

  // WhatsApp States
  const [config, setConfig] = useState<WhatsappConfig | null>(null)
  const [logs, setLogs] = useState<MessageLog[]>([])
  const [savingWhatsapp, setSavingWhatsapp] = useState(false)

  // WhatsApp Inputs
  const [apiUrl, setApiUrl] = useState('')
  const [token, setToken] = useState('')
  const [providerType, setProviderType] = useState('ULTRAMSG')
  const [templateWelcome, setTemplateWelcome] = useState('')
  const [templateExpiry, setTemplateExpiry] = useState('')
  const [expiryDaysAlert, setExpiryDaysAlert] = useState(3)

  const loadData = async () => {
    setLoading(true)
    try {
      const [profileData, whatsappData, messageLogs] = await Promise.all([
        api.get('/tenant/profile'),
        api.get('/whatsapp/config').catch(() => null),
        api.get('/whatsapp/logs').catch(() => [])
      ])

      // Populate profile
      setLibName(profileData.name || '')
      setLibOwnerName(profileData.ownerName || '')
      setLibPhone(profileData.phone || '')
      setLibAddress(profileData.address || '')
      setLibLogoUrl(profileData.logoUrl || '')
      setLibLastRegNo(profileData.lastRegNo || '')

      // Populate WhatsApp
      if (whatsappData) {
        setConfig(whatsappData)
        setApiUrl(whatsappData.apiUrl || '')
        setToken(whatsappData.token || '')
        setProviderType(whatsappData.providerType || 'ULTRAMSG')
        setTemplateWelcome(whatsappData.templateWelcome || '')
        setTemplateExpiry(whatsappData.templateExpiry || '')
        setExpiryDaysAlert(whatsappData.expiryDaysAlert || 3)
      }
      setLogs(messageLogs)

    } catch (err: any) {
      showToast(err.message || 'Error loading settings details', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const updated = await api.put('/tenant/profile', {
        name: libName,
        ownerName: libOwnerName,
        phone: libPhone,
        address: libAddress,
        logoUrl: libLogoUrl,
      })
      setTenantName(updated.name)
      setLogoUrl(updated.logoUrl)
      localStorage.setItem('lms_tenant_name', updated.name)
      showToast('Library Profile updated successfully!', 'success')
    } catch (err: any) {
      showToast(err.message || 'Error saving profile details', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveRegNo = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingRegNo(true)
    try {
      await api.put('/tenant/profile', {
        name: libName || 'Library', // Required field
        lastRegNo: libLastRegNo,
      })
      showToast(
        libLastRegNo.trim()
          ? `Reg. number saved! Next auto-number: ${getNextRegNoPreview(libLastRegNo)}`
          : 'Reg. number reset! Next auto-number will be: 1',
        'success'
      )
    } catch (err: any) {
      showToast(err.message || 'Error saving reg number settings', 'error')
    } finally {
      setSavingRegNo(false)
    }
  }

  const handleSaveWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingWhatsapp(true)
    try {
      const updated = await api.post('/whatsapp/config', {
        apiUrl,
        token,
        providerType,
        templateWelcome,
        templateExpiry,
        expiryDaysAlert,
      })
      setConfig(updated)
      showToast('WhatsApp Configuration updated!', 'success')
    } catch (err: any) {
      showToast(err.message || 'Error updating config', 'error')
    } finally {
      setSavingWhatsapp(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sub-tab selection bar */}
      <div className="flex justify-between items-center border-b border-app-border pb-3 flex-wrap gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSubTab('profile')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              subTab === 'profile' 
                ? 'bg-violet-600/10 text-violet-400 border border-violet-500/30' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Library Profile Details
          </button>
          <button
            onClick={() => setSubTab('whatsapp')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              subTab === 'whatsapp' 
                ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            WhatsApp Gateway Settings
          </button>
          <button
            onClick={() => setSubTab('license')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              subTab === 'license' 
                ? 'bg-amber-600/10 text-amber-400 border border-amber-500/30' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            System License
          </button>
        </div>
      </div>

      {subTab === 'profile' && (
        <React.Fragment>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl space-y-6">
            <div>
              <h3 className="font-bold text-white text-sm">Library Branding & Info</h3>
              <p className="text-xs text-slate-400">Configure identity tags shown on student registration slips and dashboards</p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Library / Study Hub Name</label>
                  <input 
                    type="text" required placeholder="Elite Library" value={libName} onChange={(e) => setLibName(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Owner Name</label>
                  <input 
                    type="text" placeholder="Owner Name" value={libOwnerName} onChange={(e) => setLibOwnerName(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Contact Phone Number</label>
                  <input 
                    type="text" placeholder="+91..." value={libPhone} onChange={(e) => setLibPhone(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Address / Location</label>
                  <input 
                    type="text" placeholder="Library Address" value={libAddress} onChange={(e) => setLibAddress(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Custom Brand Logo URL</label>
                <input 
                  type="text" placeholder="https://url-to-logo.png" value={libLogoUrl} onChange={(e) => setLibLogoUrl(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <button 
                type="submit"
                disabled={savingProfile}
                className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2.5 rounded-xl text-xs flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
              >
                {savingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save Profile branding'}
              </button>
            </form>
          </div>

          {/* Registration Number Settings Sidebar */}
          <div className="backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl space-y-6">
            <div>
              <h3 className="font-bold text-white text-sm">Reg. Number Setup</h3>
              <p className="text-xs text-slate-400">Configure how student registration numbers are auto-assigned</p>
            </div>

            <form onSubmit={handleSaveRegNo} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Owner Custom Starting Point</label>
                <input 
                  type="text" 
                  placeholder="e.g. LIB-500, or keep empty" 
                  value={libLastRegNo} 
                  onChange={(e) => setLibLastRegNo(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Keep empty to start registrations at <strong>1</strong>. Enter prefix-number like <strong>LIB-100</strong> to start at <strong>LIB-101</strong>.
                </p>
              </div>

              <div className="p-4 bg-app-bg/50 border border-app-border rounded-xl space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Smart Number Preview</h4>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-center">
                    <p className="text-[9px] text-slate-500 mb-1">Your Input</p>
                    <div className="px-3 py-1.5 bg-app-border/60 rounded-lg font-mono text-sm text-slate-300 min-w-[80px] text-center">
                      {libLastRegNo.trim() ? libLastRegNo.trim() : <span className="italic text-slate-500 text-xs">empty</span>}
                    </div>
                  </div>
                  <div className="text-violet-400 text-xl font-bold">→</div>
                  <div className="text-center">
                    <p className="text-[9px] text-slate-500 mb-1">Next Auto-Generated</p>
                    <div className="px-3 py-1.5 bg-violet-600/15 border border-violet-500/30 rounded-lg font-mono text-sm text-violet-300 font-bold min-w-[80px] text-center">
                      {getNextRegNoPreview(libLastRegNo)}
                    </div>
                  </div>
                </div>
                <div className="space-y-1 pt-2 border-t border-app-border">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Format Examples</p>
                  {[
                    { input: '500', next: '501' },
                    { input: 'LIB-001', next: 'LIB-002' },
                    { input: 'REG-099', next: 'REG-100' },
                  ].map((ex) => (
                    <div key={ex.input} className="flex items-center gap-2 text-[9px]">
                      <span className="font-mono text-slate-400">{ex.input}</span>
                      <span className="text-slate-600 mx-1">→</span>
                      <span className="font-mono text-emerald-500">{ex.next}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="submit"
                  disabled={savingRegNo}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2.5 rounded-xl text-xs flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {savingRegNo ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save Reg. Number Setting'}
                </button>
                {!libLastRegNo.trim() && (
                  <span className="text-[10px] text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Next student will get Reg. No. <strong className="ml-0.5">1</strong>
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
        </React.Fragment>
      )}

      {subTab === 'whatsapp' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Form Column */}
          <div className="lg:col-span-2 backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-white text-sm">WhatsApp API Setup</h3>
                <p className="text-xs text-slate-400">Configure your personal HTTP API parameters</p>
              </div>
              {config && config.apiUrl ? (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-lg">Connected</span>
              ) : (
                <span className="text-[10px] bg-rose-500/10 text-rose-400 font-bold px-2 py-0.5 rounded-lg">Not Configured</span>
              )}
            </div>

            <form onSubmit={handleSaveWhatsapp} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">API Provider</label>
                  <select
                    value={providerType}
                    onChange={(e) => setProviderType(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="ULTRAMSG">UltraMsg API</option>
                    <option value="WATI">Wati API</option>
                    <option value="GENERIC_HTTP">Generic HTTP Webhook</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Check Expiry Alert (Days)</label>
                  <input 
                    type="number" value={expiryDaysAlert} onChange={(e) => setExpiryDaysAlert(Number(e.target.value))}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Gateway Endpoint URL</label>
                <input 
                  type="text" placeholder="https://api.ultramsg.com/instance..." value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Auth Secret/Token</label>
                <input 
                  type="password" placeholder="Token" value={token} onChange={(e) => setToken(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="border-t border-app-border pt-4 space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Templates Configuration</h4>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Welcome Message</label>
                    <span className="text-[8px] text-slate-500 font-mono">Placeholders: {"{student_name}"}, {"{registration_no}"}, {"{library_name}"}</span>
                  </div>
                  <textarea 
                    rows={2} value={templateWelcome} onChange={(e) => setTemplateWelcome(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-3 text-xs text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Expiry Alert Message</label>
                    <span className="text-[8px] text-slate-500 font-mono">{"{student_name}"}, {"{seat_number}"}, {"{shift}"}, {"{expiry_date}"}, {"{due_amount}"}</span>
                  </div>
                  <textarea 
                    rows={3} value={templateExpiry} onChange={(e) => setTemplateExpiry(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-3 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={savingWhatsapp}
                className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2.5 rounded-xl text-xs flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
              >
                {savingWhatsapp ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save Parameters'}
              </button>
            </form>
          </div>

          {/* Message Logs Column */}
          <div className="backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl flex flex-col min-h-[400px]">
            <div className="flex items-center gap-2 mb-4 justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-500" />
                <div>
                  <h3 className="font-bold text-white text-sm">Message History</h3>
                  <p className="text-xs text-slate-400">WhatsApp dispatch logs</p>
                </div>
              </div>
              <button onClick={loadData} className="p-1 bg-app-border text-slate-400 hover:text-white rounded-lg">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 max-h-[350px]">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <Send className="w-10 h-10 text-slate-600 opacity-20 mb-2" />
                  <span className="text-xs text-slate-400">No sent history logged.</span>
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="bg-app-bg border border-app-border p-3 rounded-xl space-y-1.5 hover:border-violet-500/10 transition-all">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-mono text-violet-400 font-bold">{log.recipient}</span>
                      <span className="text-slate-400 font-medium">{new Date(log.sentAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-tight bg-app-surface/30 p-2 rounded-lg">{log.message}</p>
                    <div className="flex justify-end">
                      <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'license' && (
        <div className="max-w-2xl backdrop-blur-md bg-app-surface/40 border border-app-border p-5 rounded-2xl">
          <LicenseSettingsPanel showToast={showToast} />
        </div>
      )}
    </div>
  )
}

// ==========================================
// LICENSE PANEL & SYSTEM SCREENS
// ==========================================

function LicenseSettingsPanel({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [license, setLicense] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [key, setKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadLicense = async () => {
    setLoading(true)
    try {
      const data = await api.get('/license/status')
      setLicense(data)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLicense()
  }, [])

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await api.post('/license/activate', { licenseKey: key.trim() })
      showToast(res.message, 'success')
      setKey('')
      loadLicense()
    } catch (err: any) {
      setError(err.message || 'Failed to activate license key')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-24">
        <RefreshCw className="w-5 h-5 text-violet-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-app-bg border border-app-border space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold">License Status</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${license?.valid ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            <span className="text-sm font-bold text-white">{license?.valid ? 'Active' : 'Expired'}</span>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-app-bg border border-app-border space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold">License Type</span>
          <span className="text-sm font-bold text-white block mt-0.5">{license?.type}</span>
        </div>
        <div className="p-4 rounded-xl bg-app-bg border border-app-border space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Expiration Date</span>
          <span className="text-sm font-bold text-white block mt-0.5">
            {license?.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : 'Never'}
          </span>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300 flex gap-3">
        <Info className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
        <div>
          <span className="font-bold text-amber-200 block mb-1">Subscription Days Remaining: {license?.daysLeft} days</span>
          To renew or upgrade your license, please contact the developer with your library client workspace ID. Once you receive your renewal key, paste it below to extend your subscription.
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleActivate} className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Enter Renewal Key</label>
          <div className="flex gap-2">
            <input 
              type="text" required placeholder="LMS-eyJ0...-abcd..." value={key} onChange={(e) => setKey(e.target.value)}
              className="flex-1 bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
            <button 
              type="submit" disabled={submitting}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Activate
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

interface LicenseExpiredScreenProps {
  licenseStatus: any
  setLicenseStatus: (status: any) => void
  showToast: (msg: string, type?: 'success' | 'error') => void
  handleLogout: () => void
}

function LicenseExpiredScreen({ licenseStatus, setLicenseStatus, showToast, handleLogout }: LicenseExpiredScreenProps) {
  const [key, setKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await api.post('/license/activate', { licenseKey: key.trim() })
      showToast(res.message, 'success')
      setLicenseStatus({
        valid: true,
        type: res.type,
        expiresAt: res.expiresAt,
        daysLeft: 365
      })
    } catch (err: any) {
      setError(err.message || 'Failed to activate license key')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-app-bg text-slate-100 flex items-center justify-center p-4 relative font-sans">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl -z-10 animate-pulse delay-700"></div>

      <div className="w-full max-w-md backdrop-blur-xl bg-app-surface/80 border border-red-500/20 p-8 rounded-3xl shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full animate-bounce">
            <Shield className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-2">Workspace Locked</h1>
          <p className="text-sm text-slate-400">
            {licenseStatus?.type === 'TRIAL'
              ? 'Your 30-day trial subscription has expired.'
              : 'Your subscription license key has expired or is invalid.'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-app-bg/50 border border-app-border space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">License Status:</span>
            <span className="font-semibold text-red-400">Expired</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Expired On:</span>
            <span className="font-semibold text-white">
              {licenseStatus?.expiresAt ? new Date(licenseStatus.expiresAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">License Type:</span>
            <span className="font-semibold text-amber-400">{licenseStatus?.type}</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleActivate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Enter License Key</label>
            <input 
              type="text" required placeholder="LMS-eyJ0...-abcd..." value={key} onChange={(e) => setKey(e.target.value)}
              className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>

          <button 
            type="submit" disabled={submitting}
            className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-red-600/20 text-xs flex justify-center items-center gap-2"
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Activate License
          </button>
        </form>

        <div className="flex justify-between items-center text-xs border-t border-app-border pt-4">
          <span className="text-slate-400">Contact admin for renewals.</span>
          <button onClick={handleLogout} className="text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1">
            <LogOut className="w-3 h-3" /> Log Out
          </button>
        </div>
      </div>
    </div>
  )
}

interface AdminLoginProps {
  setAdminToken: (token: string | null) => void
  showToast: (msg: string, type?: 'success' | 'error') => void
  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void
  setIsAdminView: (val: boolean) => void
}

function AdminLoginView({ setAdminToken, showToast, theme, setTheme, setIsAdminView }: AdminLoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/admin/login', { username, password })
      localStorage.setItem('lms_admin_token', res.token)
      setAdminToken(res.token)
      showToast('Logged in as Developer Admin successfully!', 'success')
    } catch (err: any) {
      setError(err.message || 'Invalid developer credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-app-bg text-slate-100 flex items-center justify-center p-4 relative font-sans w-full">
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 bg-app-surface border border-app-border rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center shadow-lg"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
        </button>
      </div>

      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
      
      <div className="w-full max-w-md backdrop-blur-xl bg-app-surface/80 border border-amber-500/20 p-8 rounded-3xl shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-500/30 text-amber-400">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-2">Developer Admin Portal</h1>
          <p className="text-xs text-slate-400">Manage client library workspaces, licenses, and renewals</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Developer Username</label>
            <input 
              type="text" required placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Developer Password</label>
            <input 
              type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-amber-600/20 text-sm mt-6 flex justify-center items-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Authenticate Admin
          </button>
        </form>

        <div className="text-center text-[10px] text-slate-500">
          LMS licensing console. Unauthorized access is forbidden.
        </div>

        <div className="text-center text-xs pt-2 border-t border-app-border/40">
          <button 
            type="button"
            onClick={() => setIsAdminView(false)} 
            className="text-violet-400 hover:text-violet-300 font-semibold hover:underline flex items-center gap-1 mx-auto cursor-pointer"
          >
            ← Back to Library Login
          </button>
        </div>
      </div>
    </div>
  )
}

interface AdminDashboardProps {
  adminToken: string
  setAdminToken: (token: string | null) => void
  showToast: (msg: string, type?: 'success' | 'error') => void
  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void
}

interface TenantClient {
  id: string
  name: string
  ownerName: string
  phone: string
  address: string
  logoUrl?: string
  licenseKey?: string
  licenseExpiry: string
  licenseType: 'TRIAL' | '1YEAR' | '2YEAR'
  trialStartedAt: string
  studentCount: number
  daysLeft: number
  isExpired: boolean
}

function AdminDashboardView({ adminToken, setAdminToken, showToast, theme, setTheme }: AdminDashboardProps) {
  const [tenants, setTenants] = useState<TenantClient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTenant, setSelectedTenant] = useState<TenantClient | null>(null)
  const [licenseType, setLicenseType] = useState<'1YEAR' | '2YEAR'>('1YEAR')
  const [generatedKey, setGeneratedKey] = useState('')
  const [generating, setGenerating] = useState(false)

  const fetchTenants = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/tenants', {
        headers: { Authorization: `Bearer ${adminToken}` }
      })
      if (res.success) {
        setTenants(res.tenants)
      }
    } catch (err: any) {
      showToast(err.message || 'Error fetching client logs', 'error')
      if (err.message?.toLowerCase().includes('token') || err.message?.toLowerCase().includes('denied')) {
        handleLogout()
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTenants()
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('lms_admin_token')
    setAdminToken(null)
    showToast('Developer logged out', 'success')
  }

  const handleGenerateKey = async () => {
    if (!selectedTenant) return
    setGenerating(true)
    setGeneratedKey('')
    try {
      const res = await api.post('/admin/generate-license', 
        { tenantId: selectedTenant.id, type: licenseType },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      )
      if (res.success) {
        setGeneratedKey(res.licenseKey)
        showToast('License key generated and activated!', 'success')
        fetchTenants()
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to generate license key', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleSendWhatsApp = (tenant: TenantClient) => {
    const message = `Hello ${tenant.ownerName}, this is a reminder from LMS Developer Admin regarding your subscription for ${tenant.name}. ` +
      (tenant.isExpired 
        ? `Your license expired on ${new Date(tenant.licenseExpiry).toLocaleDateString()}. Please renew your subscription to reactivate your library portal.`
        : `Your current subscription is active and will expire on ${new Date(tenant.licenseExpiry).toLocaleDateString()} (${tenant.daysLeft} days remaining).`)

    const encoded = encodeURIComponent(message)
    window.open(`https://wa.me/${tenant.phone.replace(/[^0-9]/g, '')}?text=${encoded}`, '_blank')
  }

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.phone.includes(searchTerm)
  )

  return (
    <div className="min-h-screen bg-app-bg text-slate-100 flex flex-col font-sans w-full">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-4 border-b border-app-border bg-app-surface/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/30 text-amber-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold text-white leading-none">Developer License Console</h1>
            <span className="text-[10px] text-amber-400 font-medium mt-1 block">Developer Account Mode</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 bg-app-surface border border-app-border rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-red-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Stats Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Libraries</span>
            <h2 className="text-3xl font-extrabold text-white">{tenants.length}</h2>
          </div>
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Active Licenses</span>
            <h2 className="text-3xl font-extrabold text-white">
              {tenants.filter(t => !t.isExpired && t.licenseType !== 'TRIAL').length}
            </h2>
          </div>
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Active Trials</span>
            <h2 className="text-3xl font-extrabold text-white">
              {tenants.filter(t => !t.isExpired && t.licenseType === 'TRIAL').length}
            </h2>
          </div>
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-red-400">Expired Licenses</span>
            <h2 className="text-3xl font-extrabold text-white">
              {tenants.filter(t => t.isExpired).length}
            </h2>
          </div>
        </div>

        {/* Filters and List */}
        <div className="p-5 rounded-2xl bg-app-surface border border-app-border space-y-4">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div>
              <h3 className="font-bold text-white text-sm">Client Workspaces</h3>
              <p className="text-xs text-slate-400">Manage, extend subscription expiry, and communicate with library owners</p>
            </div>
            
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" placeholder="Search library, owner..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-app-bg border border-app-border rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-48">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-app-border rounded-xl">
              No library workspace clients found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-app-border text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-3 px-4">Library Name</th>
                    <th className="py-3 px-4">Owner Info</th>
                    <th className="py-3 px-4">License Info</th>
                    <th className="py-3 px-4">Expires On</th>
                    <th className="py-3 px-4">Days Left</th>
                    <th className="py-3 px-4">Students</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/40">
                  {filteredTenants.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-app-surface/20 transition-colors">
                      <td className="py-4 px-4 font-bold text-white">
                        {tenant.name}
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">{tenant.address}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-200">{tenant.ownerName}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{tenant.phone}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] border ${
                          tenant.isExpired
                            ? 'bg-red-500/10 border-red-500/20 text-red-400'
                            : tenant.licenseType === 'TRIAL'
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                          {tenant.licenseType}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-300">
                        {new Date(tenant.licenseExpiry).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        <span className={tenant.isExpired ? 'text-red-400 font-bold' : 'text-slate-200 font-medium'}>
                          {tenant.isExpired ? 'Expired' : `${tenant.daysLeft} days`}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-semibold text-white">
                        {tenant.studentCount}
                      </td>
                      <td className="py-4 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleSendWhatsApp(tenant)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20 transition-all font-semibold inline-flex items-center gap-1 border border-[#10b981]/20 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Message
                        </button>
                        <button
                          onClick={() => { setSelectedTenant(tenant); setGeneratedKey(''); }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all font-semibold inline-flex items-center gap-1 border border-amber-500/20 cursor-pointer"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          License
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* License Modal */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-app-surface border border-app-border rounded-3xl p-6 shadow-2xl relative space-y-6">
            <button 
              onClick={() => setSelectedTenant(null)}
              className="absolute top-4 right-4 p-1.5 bg-app-bg border border-app-border rounded-xl text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="font-bold text-white text-md">Manage License</h3>
              <p className="text-xs text-slate-400">Generate and activate a new license key for {selectedTenant.name}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Select Subscription Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLicenseType('1YEAR')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      licenseType === '1YEAR'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-app-bg border-app-border text-slate-400 hover:text-white'
                    }`}
                  >
                    1 Year Active
                  </button>
                  <button
                    onClick={() => setLicenseType('2YEAR')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      licenseType === '2YEAR'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-app-bg border-app-border text-slate-400 hover:text-white'
                    }`}
                  >
                    2 Years Active
                  </button>
                </div>
              </div>

              {!generatedKey ? (
                <button
                  onClick={handleGenerateKey} disabled={generating}
                  className="w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-medium py-2.5 rounded-xl transition-all shadow-lg shadow-amber-600/20 text-xs flex justify-center items-center gap-2 mt-4 cursor-pointer"
                >
                  {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Generate & Activate Key
                </button>
              ) : (
                <div className="space-y-2 pt-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-400">Generated License Key (Auto-Applied)</label>
                  <div className="p-3 bg-app-bg border border-app-border rounded-xl text-[11px] font-mono text-white select-all break-all select-text selection:bg-amber-600/30">
                    {generatedKey}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    This key has been automatically saved to the database. The client's workspace is now updated. You can copy this key to send it to them.
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedKey)
                      showToast('Copied key to clipboard!', 'success')
                    }}
                    className="w-full bg-app-bg hover:bg-app-surface text-white border border-app-border font-medium py-2 rounded-xl text-xs transition-colors mt-2"
                  >
                    Copy Key to Clipboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

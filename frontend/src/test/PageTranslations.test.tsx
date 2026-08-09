import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { AdminUsersPage } from '../pages/AdminUsersPage'
import { BookingsPage } from '../pages/BookingsPage'
import { CalendarPage } from '../pages/CalendarPage'
import { DashboardPage } from '../pages/DashboardPage'
import { DepartmentsPage } from '../pages/DepartmentsPage'
import { EmployeesPage } from '../pages/EmployeesPage'
import { HolidaysPage } from '../pages/HolidaysPage'
import { ReportsPage } from '../pages/ReportsPage'

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      profileId: 'profile-1', employeeCode: 'ADM001', fullName: 'ข้อมูล ทดสอบ', email: 'admin@example.test',
      departmentId: 'department-1', departmentCode: 'OPS', departmentName: 'ฝ่ายข้อมูลต้นฉบับ',
      roleCode: 'admin', roleName: 'Database role label', isActive: true,
      timezoneName: 'Asia/Tokyo', departmentTimezone: 'Asia/Tokyo',
      canManageUsers: true, canManageDepartments: true, canViewReports: true,
    },
  }),
}))

function renderPage(page: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('English page translations', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/api/departments/timezones') || url.endsWith('/api/admin/users/roles')
        ? []
        : { items: [], total: 0, page: 1, pageSize: 20 }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
  })

  it('translates the booking page', () => {
    renderPage(<BookingsPage />)
    expect(screen.getByRole('heading', { name: 'Office Booking' })).toBeInTheDocument()
    expect(screen.getByLabelText('Booking type')).toBeInTheDocument()
  })

  it('translates the calendar page and preserves its timezone', () => {
    renderPage(<CalendarPage />)
    expect(screen.getByRole('heading', { name: 'Office Calendar' })).toBeInTheDocument()
    expect(screen.getByText(/Asia\/Tokyo/)).toBeInTheDocument()
  })

  it('translates the department page', () => {
    renderPage(<DepartmentsPage />)
    expect(screen.getByRole('heading', { name: 'Departments' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add department' })).toBeInTheDocument()
  })

  it('translates the employee-management page', () => {
    renderPage(<EmployeesPage />)
    expect(screen.getByRole('heading', { name: 'Employees' })).toBeInTheDocument()
    expect(screen.getByLabelText('Search employees')).toBeInTheDocument()
  })

  it('translates the holiday-management page', () => {
    renderPage(<HolidaysPage />)
    expect(screen.getByRole('heading', { name: 'Holidays' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add holiday' })).toBeInTheDocument()
  })

  it('translates the user-management page', () => {
    renderPage(<AdminUsersPage />)
    expect(screen.getByRole('heading', { name: 'Users & Roles' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create user' })).toBeInTheDocument()
  })

  it('translates the reports page', () => {
    renderPage(<ReportsPage />)
    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Daily bookings by department' })).toBeInTheDocument()
  })

  it('localizes role and status labels while leaving database content unchanged', () => {
    renderPage(<DashboardPage />)
    expect(screen.getByText('Administrator')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByText('OPS · ฝ่ายข้อมูลต้นฉบับ')).toBeInTheDocument()
  })
})

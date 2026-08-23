import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { HolidaysPage } from '../pages/HolidaysPage'

const authState = vi.hoisted(() => ({ role: 'employee' as 'employee' | 'hr' | 'admin' }))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      profileId: 'profile-1', employeeCode: 'TEST001', fullName: 'Test User', email: 'test@example.test',
      departmentId: 'department-1', departmentCode: 'OPS', departmentName: 'Operations',
      roleCode: authState.role, roleName: authState.role, isActive: true,
      timezoneName: 'Asia/Bangkok', departmentTimezone: 'Asia/Bangkok',
      canManageUsers: authState.role === 'admin', canManageDepartments: authState.role !== 'employee',
      canViewReports: authState.role !== 'employee',
    },
  }),
}))

const activeHoliday = {
  holidayId: 'holiday-active', holidayDate: '2099-01-01', holidayName: 'Active holiday',
  holidayDescription: null, isActive: true, createdByProfileId: 'profile-1',
  createdAt: '2098-01-01T00:00:00Z', updatedAt: '2098-01-01T00:00:00Z',
}
const inactiveHoliday = {
  ...activeHoliday, holidayId: 'holiday-inactive', holidayDate: '2099-01-02',
  holidayName: 'Inactive holiday', isActive: false,
}

let fetchMock: ReturnType<typeof vi.fn>

function renderPage(role: 'employee' | 'hr' | 'admin') {
  authState.role = role
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><HolidaysPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('holiday role permissions', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const includeInactive = String(input).includes('includeInactive=true')
      const items = includeInactive ? [activeHoliday, inactiveHoliday] : [activeHoliday]
      return new Response(JSON.stringify({ items, total: items.length, page: 1, pageSize: 100 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('gives employees active holiday data without write controls', async () => {
    renderPage('employee')

    expect(await screen.findByText('Active holiday')).toBeInTheDocument()
    expect(screen.queryByText('Inactive holiday')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add holiday' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    await waitFor(() => expect(String(fetchMock.mock.calls[0]?.[0])).toContain('includeInactive=false'))
  })

  it('gives HR inactive data and create, edit, and deactivation controls', async () => {
    const user = userEvent.setup()
    renderPage('hr')

    expect(await screen.findByText('Inactive holiday')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add holiday' })).toBeInTheDocument()
    const editButtons = screen.getAllByRole('button', { name: 'Edit' })
    expect(editButtons).toHaveLength(2)
    await user.click(editButtons[0])
    expect(screen.getByRole('checkbox', { name: 'Enable' })).toBeInTheDocument()
    await waitFor(() => expect(String(fetchMock.mock.calls[0]?.[0])).toContain('includeInactive=true'))
  })

  it('preserves Admin holiday management controls and inactive data', async () => {
    renderPage('admin')

    expect(await screen.findByText('Inactive holiday')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add holiday' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2)
    await waitFor(() => expect(String(fetchMock.mock.calls[0]?.[0])).toContain('includeInactive=true'))
  })
})

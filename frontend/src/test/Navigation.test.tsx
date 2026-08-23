import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppNavigation } from '../layouts/AppLayout'
import i18n from '../i18n'

describe('role navigation', () => {
  it('shows holidays but hides report and user management menus from employee', () => {
    render(<MemoryRouter><AppNavigation role="employee" /></MemoryRouter>)
    expect(screen.queryByText('รายงาน')).not.toBeInTheDocument()
    expect(screen.queryByText('ผู้ใช้และสิทธิ์')).not.toBeInTheDocument()
    expect(screen.getByText('จองเข้าออฟฟิศ')).toBeInTheDocument()
    expect(screen.getByText('จัดการวันหยุด')).toBeInTheDocument()
  })
  it('shows reports and holidays but not user creation to HR', () => {
    render(<MemoryRouter><AppNavigation role="hr" /></MemoryRouter>)
    expect(screen.getByText('รายงาน')).toBeInTheDocument()
    expect(screen.getByText('จัดการวันหยุด')).toBeInTheDocument()
    expect(screen.queryByText('ผู้ใช้และสิทธิ์')).not.toBeInTheDocument()
  })
  it('shows admin user-management and holiday menus', () => {
    render(<MemoryRouter><AppNavigation role="admin" /></MemoryRouter>)
    expect(screen.getByText('ผู้ใช้และสิทธิ์')).toBeInTheDocument()
    expect(screen.getByText('จัดการวันหยุด')).toBeInTheDocument()
  })
  it('keeps employee permissions unchanged in English', async () => {
    await i18n.changeLanguage('en')
    render(<MemoryRouter><AppNavigation role="employee" /></MemoryRouter>)
    expect(screen.getByText('Office Booking')).toBeInTheDocument()
    expect(screen.getByText('Holidays')).toBeInTheDocument()
    expect(screen.queryByText('Reports')).not.toBeInTheDocument()
    expect(screen.queryByText('Users & Roles')).not.toBeInTheDocument()
  })
  it('keeps HR permissions unchanged in English', async () => {
    await i18n.changeLanguage('en')
    render(<MemoryRouter><AppNavigation role="hr" /></MemoryRouter>)
    expect(screen.getByText('Departments')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
    expect(screen.getByText('Holidays')).toBeInTheDocument()
    expect(screen.queryByText('Users & Roles')).not.toBeInTheDocument()
  })
  it('keeps admin permissions unchanged in English', async () => {
    await i18n.changeLanguage('en')
    render(<MemoryRouter><AppNavigation role="admin" /></MemoryRouter>)
    expect(screen.getByText('Users & Roles')).toBeInTheDocument()
    expect(screen.getByText('Holidays')).toBeInTheDocument()
  })
})

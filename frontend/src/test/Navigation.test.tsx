import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppNavigation } from '../layouts/AppLayout'

describe('role navigation', () => {
  it('hides report and user management menus from employee', () => {
    render(<MemoryRouter><AppNavigation role="employee" /></MemoryRouter>)
    expect(screen.queryByText('รายงาน')).not.toBeInTheDocument()
    expect(screen.queryByText('ผู้ใช้และสิทธิ์')).not.toBeInTheDocument()
    expect(screen.getByText('จองเข้าออฟฟิศ')).toBeInTheDocument()
  })
  it('shows reports but not user creation to HR', () => {
    render(<MemoryRouter><AppNavigation role="hr" /></MemoryRouter>)
    expect(screen.getByText('รายงาน')).toBeInTheDocument()
    expect(screen.queryByText('ผู้ใช้และสิทธิ์')).not.toBeInTheDocument()
  })
  it('shows admin user-management and holiday menus', () => {
    render(<MemoryRouter><AppNavigation role="admin" /></MemoryRouter>)
    expect(screen.getByText('ผู้ใช้และสิทธิ์')).toBeInTheDocument()
    expect(screen.getByText('จัดการวันหยุด')).toBeInTheDocument()
  })
})

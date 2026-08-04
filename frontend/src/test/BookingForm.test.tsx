import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BookingForm } from '../features/bookings/BookingForm'
import { admin, adminProfile, available, employee, profile } from './testData'

describe('booking form', () => {
  it('uses single-day fields by default and switches to date-time range fields', async () => {
    const user = userEvent.setup()
    render(<BookingForm user={employee} profiles={[profile]} onValidate={async () => available} onSave={async () => undefined} />)
    expect(screen.getByLabelText('วันที่จอง')).toBeInTheDocument()
    expect(screen.queryByLabelText('เวลาเริ่ม')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('รูปแบบการจอง'), 'date_time_range')
    expect(screen.getByLabelText('วันที่เริ่ม')).toBeInTheDocument()
    expect(screen.getByLabelText('เวลาเริ่ม')).toHaveValue('09:00')
    expect(screen.getByLabelText('วันที่สิ้นสุด')).toBeInTheDocument()
    expect(screen.getByLabelText('เวลาสิ้นสุด')).toHaveValue('17:00')
  })

  it('shows a booking conflict returned by validation', async () => {
    const user = userEvent.setup()
    render(<BookingForm user={employee} profiles={[profile]} onValidate={async () => ({ ...available, conflict: { hasConflict: true } })} onSave={async () => undefined} />)
    await user.click(screen.getByRole('button', { name: 'บันทึกการจอง' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ซ้อนกับรายการจองเดิม')
  })

  it('shows a capacity error returned by validation', async () => {
    const user = userEvent.setup()
    render(<BookingForm user={employee} profiles={[profile]} onValidate={async () => ({ ...available, capacity: { isAvailable: false, dates: [] } })} onSave={async () => undefined} />)
    await user.click(screen.getByRole('button', { name: 'บันทึกการจอง' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('เกินความจุของฝ่าย')
  })

  it('requires explicit holiday confirmation before save', async () => {
    const user = userEvent.setup(); const onSave = vi.fn(async () => undefined)
    render(<BookingForm user={employee} profiles={[profile]} onValidate={async () => ({ ...available, holidays: { hasHolidays: true, holidays: [{ holiday_id: 'h1', holiday_date: '2026-08-12', holiday_name: 'วันแม่แห่งชาติ' }] } })} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'บันทึกการจอง' }))
    expect(await screen.findByText('วันที่เลือกตรงกับวันหยุด')).toBeInTheDocument()
    expect(screen.getByText(/วันแม่แห่งชาติ/)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'ยืนยันและบันทึก' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ holidayWarningAcknowledged: true })))
  })

  it('rejects a range whose end is not after its start', async () => {
    const user = userEvent.setup(); const onValidate = vi.fn(async () => available)
    render(<BookingForm user={employee} profiles={[profile]} onValidate={onValidate} onSave={async () => undefined} />)
    await user.selectOptions(screen.getByLabelText('รูปแบบการจอง'), 'date_time_range')
    await user.clear(screen.getByLabelText('วันที่เริ่ม')); await user.type(screen.getByLabelText('วันที่เริ่ม'), '2030-01-02')
    await user.clear(screen.getByLabelText('วันที่สิ้นสุด')); await user.type(screen.getByLabelText('วันที่สิ้นสุด'), '2030-01-01')
    await user.click(screen.getByRole('button', { name: 'บันทึกการจอง' }))
    expect(await screen.findByText('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม')).toBeInTheDocument()
    expect(onValidate).not.toHaveBeenCalled()
  })

  it('allows a past cross-day range and emits Bangkok instants', async () => {
    const user = userEvent.setup(); const onSave = vi.fn(async () => undefined)
    render(<BookingForm user={employee} profiles={[profile]} onValidate={async () => available} onSave={onSave} />)
    await user.selectOptions(screen.getByLabelText('รูปแบบการจอง'), 'date_time_range')
    await user.clear(screen.getByLabelText('วันที่เริ่ม')); await user.type(screen.getByLabelText('วันที่เริ่ม'), '2020-01-01')
    await user.clear(screen.getByLabelText('เวลาเริ่ม')); await user.type(screen.getByLabelText('เวลาเริ่ม'), '22:00')
    await user.clear(screen.getByLabelText('วันที่สิ้นสุด')); await user.type(screen.getByLabelText('วันที่สิ้นสุด'), '2020-01-02')
    await user.clear(screen.getByLabelText('เวลาสิ้นสุด')); await user.type(screen.getByLabelText('เวลาสิ้นสุด'), '06:00')
    await user.click(screen.getByRole('button', { name: 'บันทึกการจอง' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      bookingMode: 'date_time_range', startAt: '2020-01-01T15:00:00.000Z', endAt: '2020-01-01T23:00:00.000Z'
    })))
  })

  it('lets an admin choose an active employee and follows that department', async () => {
    const user = userEvent.setup(); const onSave = vi.fn(async () => undefined)
    render(<BookingForm user={admin} profiles={[adminProfile, profile]} onValidate={async () => available} onSave={onSave} />)
    await user.selectOptions(screen.getByLabelText('พนักงาน'), profile.profileId)
    expect(screen.getByText(/OPS · ฝ่ายปฏิบัติการ/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'บันทึกการจอง' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ bookedForProfileId: profile.profileId })))
  })

  it('reset clears entered notes', async () => {
    const user = userEvent.setup()
    render(<BookingForm user={employee} profiles={[profile]} onValidate={async () => available} onSave={async () => undefined} />)
    const notes = screen.getByLabelText('หมายเหตุ')
    await user.type(notes, 'temporary note')
    await user.click(screen.getByRole('button', { name: 'ล้างค่า' }))
    expect(notes).toHaveValue('')
  })
})

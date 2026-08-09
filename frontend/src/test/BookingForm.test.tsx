import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BookingForm } from '../features/bookings/BookingForm'
import { admin, adminProfile, available, employee, profile } from './testData'
import i18n from '../i18n'

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

  it('converts range input using the selected department timezone', async () => {
    const user = userEvent.setup(); const onSave = vi.fn(async () => undefined)
    const tokyoProfile = {
      ...profile,
      profileId: '30000000-0000-0000-0000-000000000099',
      employeeCode: 'TYO001',
      departmentCode: 'TYO',
      departmentName: 'Tokyo',
      timezoneName: 'Asia/Tokyo',
      departmentTimezone: 'Asia/Tokyo',
    }
    render(<BookingForm user={admin} profiles={[adminProfile, tokyoProfile]} onValidate={async () => available} onSave={onSave} />)
    await user.selectOptions(screen.getByLabelText('พนักงาน'), tokyoProfile.profileId)
    await user.selectOptions(screen.getByLabelText('รูปแบบการจอง'), 'date_time_range')
    await user.clear(screen.getByLabelText('วันที่เริ่ม')); await user.type(screen.getByLabelText('วันที่เริ่ม'), '2030-01-02')
    await user.clear(screen.getByLabelText('เวลาเริ่ม')); await user.type(screen.getByLabelText('เวลาเริ่ม'), '00:30')
    await user.clear(screen.getByLabelText('วันที่สิ้นสุด')); await user.type(screen.getByLabelText('วันที่สิ้นสุด'), '2030-01-02')
    await user.clear(screen.getByLabelText('เวลาสิ้นสุด')); await user.type(screen.getByLabelText('เวลาสิ้นสุด'), '08:30')
    await user.click(screen.getByRole('button', { name: 'บันทึกการจอง' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      startAt: '2030-01-01T15:30:00.000Z', endAt: '2030-01-01T23:30:00.000Z'
    })))
  })

  it('reset clears entered notes', async () => {
    const user = userEvent.setup()
    render(<BookingForm user={employee} profiles={[profile]} onValidate={async () => available} onSave={async () => undefined} />)
    const notes = screen.getByLabelText('หมายเหตุ')
    await user.type(notes, 'temporary note')
    await user.click(screen.getByRole('button', { name: 'ล้างค่า' }))
    expect(notes).toHaveValue('')
  })

  it('translates validation messages into English', async () => {
    const user = userEvent.setup()
    render(<BookingForm user={employee} profiles={[profile]} onValidate={async () => available} onSave={async () => undefined} />)
    await user.clear(screen.getByLabelText('วันที่จอง'))
    await user.click(screen.getByRole('button', { name: 'บันทึกการจอง' }))
    expect(await screen.findByText('กรุณาเลือกวันที่')).toBeInTheDocument()
    await i18n.changeLanguage('en')
    expect(await screen.findByText('Select a date')).toBeInTheDocument()
  })

  it('translates the holiday dialog and keeps stored holiday names unchanged', async () => {
    await i18n.changeLanguage('en')
    const user = userEvent.setup()
    render(<BookingForm user={employee} profiles={[profile]} onValidate={async () => ({ ...available, holidays: { hasHolidays: true, holidays: [{ holiday_id: 'h1', holiday_date: '2026-08-12', holiday_name: 'วันแม่แห่งชาติ' }] } })} onSave={async () => undefined} />)
    await user.click(screen.getByRole('button', { name: 'Save booking' }))
    expect(await screen.findByText('The selected date is a holiday')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acknowledge and save' })).toBeInTheDocument()
    expect(screen.getByText(/วันแม่แห่งชาติ/)).toBeInTheDocument()
  })

  it('uses an English application-owned audit reason when editing in English', async () => {
    await i18n.changeLanguage('en')
    const user = userEvent.setup()
    const onSave = vi.fn(async () => undefined)
    const editing = {
      bookingId: '40000000-0000-0000-0000-000000000001',
      bookedForProfileId: profile.profileId,
      bookedForEmployeeCode: profile.employeeCode,
      bookedForName: profile.fullName,
      bookedByProfileId: profile.profileId,
      bookedByName: profile.fullName,
      departmentId: profile.departmentId,
      departmentCode: profile.departmentCode,
      departmentName: profile.departmentName,
      businessTimezone: 'Asia/Bangkok',
      bookingMode: 'single_day' as const,
      bookingDateStart: '2026-08-04',
      bookingDateEnd: '2026-08-04',
      startAt: '2026-08-03T17:00:00Z',
      endAt: '2026-08-04T17:00:00Z',
      holidayWarningAcknowledged: false,
      statusCode: 'booked' as const,
      noteText: null,
      cancelledAt: null,
      cancelledByProfileId: null,
      createdAt: '2026-08-01T02:00:00Z',
      updatedAt: '2026-08-01T02:00:00Z',
    }
    render(<BookingForm user={employee} profiles={[profile]} editing={editing} onValidate={async () => available} onSave={onSave} />)

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      actionReason: 'Updated through the CoDesk interface',
    })))
  })

  it('rejects a nonexistent DST wall time with a localized message', async () => {
    await i18n.changeLanguage('en')
    const user = userEvent.setup()
    const onValidate = vi.fn(async () => available)
    const newYorkUser = {
      ...employee,
      timezoneName: 'America/New_York',
      departmentTimezone: 'America/New_York',
    }
    const newYorkProfile = {
      ...profile,
      timezoneName: 'America/New_York',
      departmentTimezone: 'America/New_York',
    }
    render(<BookingForm user={newYorkUser} profiles={[newYorkProfile]} onValidate={onValidate} onSave={async () => undefined} />)
    await user.selectOptions(screen.getByLabelText('Booking type'), 'date_time_range')
    await user.clear(screen.getByLabelText('Start date')); await user.type(screen.getByLabelText('Start date'), '2026-03-08')
    await user.clear(screen.getByLabelText('Start time')); await user.type(screen.getByLabelText('Start time'), '02:30')
    await user.clear(screen.getByLabelText('End date')); await user.type(screen.getByLabelText('End date'), '2026-03-08')
    await user.clear(screen.getByLabelText('End time')); await user.type(screen.getByLabelText('End time'), '04:00')

    await user.click(screen.getByRole('button', { name: 'Save booking' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('does not exist in the department timezone')
    expect(onValidate).not.toHaveBeenCalled()
  })
})

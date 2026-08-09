import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:5080'
const ids = {
  admin: '30000000-0000-0000-0000-000000000001',
  hr: '30000000-0000-0000-0000-000000000002',
  employee: '30000000-0000-0000-0000-000000000003',
  employeeTwo: '30000000-0000-0000-0000-000000000004',
  employeeFour: '30000000-0000-0000-0000-000000000006',
}

async function selectDemo(page: Page, roleName: 'พนักงาน' | 'ฝ่ายทรัพยากรบุคคล' | 'ผู้ดูแลระบบ') {
  await page.goto('/auth')
  await page.getByText(roleName, { exact: true }).first().click()
}

test('Thai is default and English persists without writes or timezone changes', async ({ page }) => {
  const mutationRequests: string[] = []
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutationRequests.push(request.url())
  })
  await page.goto('/auth')
  await expect(page.locator('html')).toHaveAttribute('lang', 'th')
  await expect(page.getByText('เลือกบทบาทสำหรับการสาธิตระบบ')).toBeVisible()
  await page.getByRole('button', { name: 'EN' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Choose a role for the system demo')).toBeVisible()
  await page.getByText('Employee', { exact: true }).first().click()
  await expect(page.getByText('Office Booking', { exact: true })).toBeVisible()
  await expect(page.getByText('Reports', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Asia/Bangkok', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Overview', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('codesk.language'))).toBe('en')
  await page.getByRole('button', { name: 'ไทย' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'th')
  await expect(page.getByText('ภาพรวม', { exact: true })).toBeVisible()
  await expect(page.getByText('Asia/Bangkok', { exact: true })).toBeVisible()
  expect(mutationRequests).toEqual([])
})

test('department timezone controls remain usable after switching to English', async ({ page }) => {
  await selectDemo(page, 'ผู้ดูแลระบบ')
  await page.getByRole('button', { name: 'EN' }).click()
  await page.getByText('Departments', { exact: true }).first().click()
  await page.getByRole('button', { name: 'Add department' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Timezone').fill('Asia/Tokyo')
  await expect(dialog.getByLabel('Timezone')).toHaveValue('Asia/Tokyo')
  await dialog.getByLabel('Timezone').fill('Mars/Olympus')
  await expect(dialog.getByText('Select a supported timezone')).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

async function createSingleDay(request: APIRequestContext, targetId: string, date: string) {
  const response = await request.post(`${apiBase}/api/bookings`, {
    headers: { 'X-Demo-Profile-Id': ids.admin },
    data: {
      bookedForProfileId: targetId,
      bookingMode: 'single_day',
      bookingDateStart: date,
      holidayWarningAcknowledged: false,
      noteText: 'Playwright capacity fixture',
    },
  })
  expect(response.status()).toBe(201)
  const payload = await response.json() as { booking: { booking_id: string } }
  return payload.booking.booking_id
}

async function cancelAsAdmin(request: APIRequestContext, bookingId: string) {
  const response = await request.post(`${apiBase}/api/bookings/${bookingId}/cancel`, {
    headers: { 'X-Demo-Profile-Id': ids.admin },
    data: { reason: 'Playwright cleanup' },
  })
  expect(response.ok()).toBeTruthy()
}

test('employee demo exposes booking/calendar but not protected management', async ({ page }) => {
  await selectDemo(page, 'พนักงาน')
  await expect(page.getByText('จองเข้าออฟฟิศ', { exact: true })).toBeVisible()
  await expect(page.getByText('ปฏิทิน', { exact: true })).toBeVisible()
  await expect(page.getByText('รายงาน', { exact: true })).toHaveCount(0)
  await expect(page.getByText('จัดการฝ่ายงาน', { exact: true })).toHaveCount(0)
  await expect(page.getByText('ผู้ใช้และสิทธิ์', { exact: true })).toHaveCount(0)
})

test('HR demo exposes approved management and excludes admin-only menus', async ({ page }) => {
  await selectDemo(page, 'ฝ่ายทรัพยากรบุคคล')
  await expect(page.getByText('จัดการฝ่ายงาน', { exact: true })).toBeVisible()
  await expect(page.getByText('จัดการพนักงาน', { exact: true })).toBeVisible()
  await expect(page.getByText('รายงาน', { exact: true })).toBeVisible()
  await expect(page.getByText('จัดการวันหยุด', { exact: true })).toHaveCount(0)
  await expect(page.getByText('ผู้ใช้และสิทธิ์', { exact: true })).toHaveCount(0)
})

test('admin demo exposes all menus and demo role switching works', async ({ page }) => {
  await selectDemo(page, 'พนักงาน')
  await page.getByRole('button', { name: 'สลับบทบาทสาธิต' }).click()
  await expect(page.getByText('เลือกบทบาทสำหรับการสาธิตระบบ')).toBeVisible()
  await page.getByText('ผู้ดูแลระบบ', { exact: true }).first().click()
  await expect(page.getByText('ผู้ใช้และสิทธิ์', { exact: true })).toBeVisible()
  await expect(page.getByText('จัดการวันหยุด', { exact: true })).toBeVisible()
  await expect(page.getByText('โหมดสาธิต', { exact: true })).toBeVisible()
})

test('direct API calls enforce authentication, role, and department scope', async ({ request }) => {
  expect((await request.get(`${apiBase}/api/me`)).status()).toBe(401)
  const employeeHeaders = { 'X-Demo-Profile-Id': ids.employee }
  expect((await request.get(`${apiBase}/api/reports/daily-department-bookings`, { headers: employeeHeaders })).status()).toBe(403)
  expect((await request.post(`${apiBase}/api/departments`, {
    headers: employeeHeaders,
    data: { departmentCode: 'DENIED', departmentName: 'Denied', capacityMode: 'limited', defaultCapacityPerDay: 1, effectiveTimezone: 'Asia/Bangkok' },
  })).status()).toBe(403)
  expect((await request.get(`${apiBase}/api/bookings/40000000-0000-0000-0000-000000000004`, { headers: employeeHeaders })).status()).toBe(403)
  expect((await request.get(`${apiBase}/api/bookings/40000000-0000-0000-0000-000000000003`, { headers: employeeHeaders })).status()).toBe(200)
  expect((await request.post(`${apiBase}/api/bookings`, {
    headers: employeeHeaders,
    data: { bookedForProfileId: ids.employeeTwo, bookingMode: 'single_day', bookingDateStart: '2045-01-01', holidayWarningAcknowledged: false },
  })).status()).toBe(403)
  expect((await request.post(`${apiBase}/api/admin/users`, { headers: { 'X-Demo-Profile-Id': ids.hr }, data: {} })).status()).toBe(403)
  expect((await request.put(`${apiBase}/api/profiles/${ids.employee}`, {
    headers: { 'X-Demo-Profile-Id': ids.hr },
    data: {
      employeeCode: 'EMP001', fullName: 'นนท์ พนักงานหนึ่ง', email: 'non.employee@example.test',
      departmentId: '20000000-0000-0000-0000-000000000001',
      roleId: '10000000-0000-0000-0000-000000000003', isActive: true,
    },
  })).status()).toBe(403)
})

test('employee sees an overlapping booking rejection in the real UI', async ({ page }) => {
  await selectDemo(page, 'พนักงาน')
  await page.getByRole('button', { name: 'EN' }).click()
  await page.getByText('Office Booking', { exact: true }).first().click()
  await page.getByLabel('Booking date').fill('2026-08-04')
  await page.getByRole('button', { name: 'Save booking' }).click()
  await expect(page.getByRole('alert')).toContainText('overlaps an existing booking')
})

test('concurrent department occupancy produces a visible capacity rejection', async ({ page, request }) => {
  const date = '2041-02-17'
  const created: string[] = []
  try {
    created.push(await createSingleDay(request, ids.employee, date))
    created.push(await createSingleDay(request, ids.employeeTwo, date))
    created.push(await createSingleDay(request, ids.employeeFour, date))
    await selectDemo(page, 'ฝ่ายทรัพยากรบุคคล')
    await page.getByText('จองเข้าออฟฟิศ', { exact: true }).first().click()
    await page.getByLabel('วันที่จอง').fill(date)
    await page.getByRole('button', { name: 'บันทึกการจอง' }).click()
    await expect(page.getByRole('alert')).toContainText('เกินความจุของฝ่าย')
  } finally {
    for (const bookingId of created) await cancelAsAdmin(request, bookingId)
  }
})

test('employee creates, edits, and cancels a past cross-day booking', async ({ page }) => {
  await selectDemo(page, 'พนักงาน')
  await page.getByText('จองเข้าออฟฟิศ', { exact: true }).first().click()
  await page.getByLabel('รูปแบบการจอง').selectOption('date_time_range')
  await page.getByLabel('วันที่เริ่ม').fill('2020-02-01')
  await page.getByLabel('เวลาเริ่ม').fill('22:00')
  await page.getByLabel('วันที่สิ้นสุด').fill('2020-02-02')
  await page.getByLabel('เวลาสิ้นสุด').fill('06:00')
  const created = page.waitForResponse((response) => response.url().endsWith('/api/bookings') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'บันทึกการจอง' }).click()
  await expect(page.getByText('บันทึกรายการจองสำเร็จ')).toBeVisible()
  const payload = await (await created).json() as { booking: { booking_id: string } }
  const card = page.getByLabel(`รายการจอง ${payload.booking.booking_id}`)
  await expect(card).toContainText('2020-02-01 22:00')
  await card.getByRole('button', { name: 'แก้ไข' }).click()
  await page.getByLabel('เวลาสิ้นสุด').fill('07:00')
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click()
  await expect(page.getByText('แก้ไขรายการจองสำเร็จ')).toBeVisible()

  const updatedCard = page.getByLabel(`รายการจอง ${payload.booking.booking_id}`)
  await expect(updatedCard).toContainText('2020-02-02 07:00')
  page.once('dialog', (dialog) => dialog.accept())
  await updatedCard.getByRole('button', { name: 'ยกเลิก' }).click()
  await expect(page.getByText('ยกเลิกรายการจองแล้ว')).toBeVisible()
})

test('admin creates a booking in an unlimited department through the real API', async ({ page, request }) => {
  await selectDemo(page, 'ผู้ดูแลระบบ')
  await page.getByText('จองเข้าออฟฟิศ', { exact: true }).first().click()
  await page.getByLabel('วันที่จอง').fill('2042-03-10')
  const created = page.waitForResponse((response) => response.url().endsWith('/api/bookings') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'บันทึกการจอง' }).click()
  await expect(page.getByText('บันทึกรายการจองสำเร็จ')).toBeVisible()
  const payload = await (await created).json() as { booking: { booking_id: string, department_id: string } }
  expect(payload.booking.department_id).toBe('20000000-0000-0000-0000-000000000002')
  await cancelAsAdmin(request, payload.booking.booking_id)
})

test('holiday booking requires acknowledgement before save', async ({ page, request }) => {
  await selectDemo(page, 'ฝ่ายทรัพยากรบุคคล')
  await page.getByText('จองเข้าออฟฟิศ', { exact: true }).first().click()
  await page.getByLabel('วันที่จอง').fill('2026-10-23')
  await page.getByRole('button', { name: 'บันทึกการจอง' }).click()
  await expect(page.getByText('วันที่เลือกตรงกับวันหยุด')).toBeVisible()
  const created = page.waitForResponse((response) => response.url().endsWith('/api/bookings') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'ยืนยันและบันทึก' }).click()
  await expect(page.getByText('บันทึกรายการจองสำเร็จ')).toBeVisible()
  const payload = await (await created).json() as { booking: { booking_id: string } }
  await cancelAsAdmin(request, payload.booking.booking_id)
})

test('calendar navigation, booking details, and profile-timezone display work', async ({ page }) => {
  await selectDemo(page, 'พนักงาน')
  await page.getByText('ปฏิทิน', { exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'ก่อนหน้า' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'ถัดไป' })).toBeVisible()
  await page.getByRole('button', { name: 'ถัดไป' }).click()
  await page.getByRole('button', { name: 'วันนี้' }).click()
  await expect(page.getByText('นนท์ พนักงานหนึ่ง · OPS').first()).toBeVisible()
  await page.getByText('นนท์ พนักงานหนึ่ง · OPS').first().click()
  await expect(page.getByText('รายละเอียดการจอง')).toBeVisible()
  await expect(page.getByText(/2026-08-04 00:00/)).toBeVisible()
})

test('all five reports render backend rows, column filters, sorting, and source tables', async ({ page }) => {
  await selectDemo(page, 'ฝ่ายทรัพยากรบุคคล')
  await page.getByText('รายงาน', { exact: true }).first().click()
  for (const title of [
    'ยอดจองรายวันแยกฝ่าย',
    'การใช้ความจุของฝ่าย',
    'ความถี่การจองของพนักงาน',
    'การจองในวันหยุด',
    'สรุปการยกเลิก',
  ]) {
    await page.getByRole('button', { name: title }).click()
    await expect(page.locator('table')).toBeVisible()
  }
  await page.getByRole('button', { name: 'ยอดจองรายวันแยกฝ่าย' }).click()
  await page.getByLabel('กรอง department_code').fill('OPS')
  await expect(page.getByRole('cell', { name: 'OPS' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'วันที่' }).click()
  await expect(page.locator('tbody tr').first()).toBeVisible()
})

test('admin creates, edits timezone, sorts, and soft-deactivates a department', async ({ page }) => {
  const code = `PW${Date.now().toString().slice(-8)}`
  await selectDemo(page, 'ผู้ดูแลระบบ')
  await page.getByText('จัดการฝ่ายงาน', { exact: true }).first().click()
  await page.getByRole('button', { name: 'เพิ่มฝ่ายงาน' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('รหัสฝ่าย').fill(code)
  await dialog.getByLabel('ชื่อฝ่าย').fill('Playwright Audit Department')
  await dialog.getByLabel('รูปแบบความจุ').selectOption('unlimited')
  await dialog.getByLabel('เขตเวลา').fill('Mars/Olympus')
  await expect(dialog.getByRole('button', { name: 'บันทึก' })).toBeDisabled()
  await dialog.getByLabel('เขตเวลา').fill('Asia/Tokyo')
  await dialog.getByRole('button', { name: 'บันทึก' }).click()
  await expect(page.getByText('เพิ่มฝ่ายงานสำเร็จ')).toBeVisible()

  await page.getByLabel('ค้นหาฝ่ายงาน').fill(code)
  const row = page.getByRole('row').filter({ hasText: code })
  await expect(row).toContainText('ไม่จำกัด')
  await expect(row).toContainText('Asia/Tokyo')
  await page.getByLabel('เรียงฝ่ายงานตาม').selectOption('isActive')
  await page.getByRole('button', { name: 'น้อย → มาก' }).click()
  await row.getByRole('button', { name: 'แก้ไข' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('เขตเวลา').fill('America/New_York')
  await dialog.getByLabel('เปิดใช้งานฝ่าย').uncheck()
  await dialog.getByRole('button', { name: 'บันทึก' }).click()
  await expect(page.getByText('แก้ไขฝ่ายงานสำเร็จ')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: code })).toContainText('ปิดใช้งาน')
  await expect(page.getByRole('row').filter({ hasText: code })).toContainText('America/New_York')
})

test('admin edits an employee department, sees history, and restores the profile', async ({ page }) => {
  await selectDemo(page, 'ผู้ดูแลระบบ')
  await page.getByText('จัดการพนักงาน', { exact: true }).first().click()
  await page.getByLabel('ค้นหาพนักงาน').fill('EMP004')
  let row = page.getByRole('row').filter({ hasText: 'EMP004' })
  await row.getByRole('button', { name: 'แก้ไข' }).click()
  let dialog = page.getByRole('dialog')
  const nameInput = dialog.getByLabel('ชื่อ-นามสกุล')
  const originalName = await nameInput.inputValue()
  const department = dialog.getByLabel('ฝ่ายงาน')
  const originalDepartment = await department.inputValue()
  const alternateDepartment = originalDepartment === '20000000-0000-0000-0000-000000000002'
    ? '20000000-0000-0000-0000-000000000001'
    : '20000000-0000-0000-0000-000000000002'
  await nameInput.fill(`${originalName} Audit`)
  await department.selectOption(alternateDepartment)
  await dialog.getByRole('button', { name: 'บันทึก' }).click()
  await expect(page.getByText('แก้ไขข้อมูลพนักงานสำเร็จ')).toBeVisible()

  row = page.getByRole('row').filter({ hasText: 'EMP004' })
  await expect(row).toContainText(`${originalName} Audit`)
  await row.getByRole('button', { name: 'แก้ไข' }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByText('ประวัติฝ่ายงาน')).toBeVisible()
  await expect.poll(() => dialog.getByText(/· โดย/).count()).toBeGreaterThanOrEqual(2)
  await dialog.getByLabel('ชื่อ-นามสกุล').fill(originalName)
  await dialog.getByLabel('ฝ่ายงาน').selectOption(originalDepartment)
  await dialog.getByRole('button', { name: 'บันทึก' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'EMP004' })).toContainText(originalName)
})

test('admin creates, sorts, and soft-deactivates a holiday', async ({ page, request }) => {
  const response = await request.get(`${apiBase}/api/holidays?pageSize=500&includeInactive=true`, {
    headers: { 'X-Demo-Profile-Id': ids.admin },
  })
  const existing = await response.json() as { items: Array<{ holidayDate: string }> }
  const used = new Set(existing.items.map((holiday) => holiday.holidayDate))
  let date = ''
  for (let day = 1; day <= 28 && !date; day += 1) {
    const candidate = `2090-01-${String(day).padStart(2, '0')}`
    if (!used.has(candidate)) date = candidate
  }
  expect(date).not.toBe('')

  await selectDemo(page, 'ผู้ดูแลระบบ')
  await page.getByText('จัดการวันหยุด', { exact: true }).first().click()
  await page.getByRole('button', { name: 'เพิ่มวันหยุด' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('วันที่').fill(date)
  await dialog.getByLabel('ชื่อวันหยุด').fill(`Playwright Audit ${date}`)
  await dialog.getByLabel('รายละเอียด').fill('Live management verification')
  await dialog.getByRole('button', { name: 'บันทึก' }).click()
  await expect(page.getByText('เพิ่มวันหยุดสำเร็จ')).toBeVisible()

  await page.getByLabel('ค้นหาวันหยุด').fill(`Playwright Audit ${date}`)
  const row = page.getByRole('row').filter({ hasText: date })
  await page.getByLabel('เรียงวันหยุดตาม').selectOption('isActive')
  await row.getByRole('button', { name: 'แก้ไข' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('เปิดใช้งาน').uncheck()
  await dialog.getByRole('button', { name: 'บันทึก' }).click()
  await expect(page.getByText('แก้ไขวันหยุดสำเร็จ')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: date })).toContainText('ปิดใช้งาน')
})

test('mobile navigation remains keyboard-labelled and usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await selectDemo(page, 'พนักงาน')
  await page.getByRole('button', { name: 'EN' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.locator('a:visible').filter({ hasText: 'Office Booking' })).toBeVisible()
  await page.getByRole('button', { name: 'Close menu', exact: true }).click({
    position: { x: 360, y: 20 },
  })
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
})

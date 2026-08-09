/**
 * Chapter 4 Evidence Capture — Playwright Test
 *
 * Captures 13 missing UI screenshots using Demo Mode.
 * All bookings are cleaned up, capacity is restored.
 * No source code, Doc/, or schema modifications.
 *
 * Pattern: App starts in Thai → select role with Thai text → switch to EN → capture.
 * This matches the existing e2e test approach.
 */
import { expect, test, type Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:5080'
const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)
const EVIDENCE_DIR = path.resolve(currentDir, '../../Chapter4_Evidence/01_UI')

const ids = {
  admin: '30000000-0000-0000-0000-000000000001',
  hr: '30000000-0000-0000-0000-000000000002',
  employee: '30000000-0000-0000-0000-000000000003',
}

fs.mkdirSync(EVIDENCE_DIR, { recursive: true })

/**
 * Select a demo role using Thai text (the app default), then switch to English.
 * The Thai role names are: พนักงาน (Employee), ฝ่ายทรัพยากรบุคคล (HR), ผู้ดูแลระบบ (Admin)
 */
async function selectDemoThenEN(page: Page, thaiRoleName: 'พนักงาน' | 'ฝ่ายทรัพยากรบุคคล' | 'ผู้ดูแลระบบ') {
  await page.goto('/auth')
  await page.waitForLoadState('networkidle')
  await page.getByText(thaiRoleName, { exact: true }).first().click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
  // Switch to English after login
  await page.getByRole('button', { name: 'EN' }).click()
  await page.waitForTimeout(500)
}

/** Select a demo role staying in Thai */
async function selectDemoTH(page: Page, thaiRoleName: 'พนักงาน' | 'ฝ่ายทรัพยากรบุคคล' | 'ผู้ดูแลระบบ') {
  await page.goto('/auth')
  await page.waitForLoadState('networkidle')
  await page.getByText(thaiRoleName, { exact: true }).first().click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

async function capture(page: Page, filename: string) {
  const filepath = path.join(EVIDENCE_DIR, filename)
  await page.screenshot({ path: filepath, fullPage: false })
  const stat = fs.statSync(filepath)
  console.log(`  ✅ ${filename} (${stat.size} bytes)`)
  expect(stat.size).toBeGreaterThan(1000)
}

test.describe.serial('Chapter 4 Evidence Capture', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('19 — Booking success confirmation', async ({ page, request }) => {
    await selectDemoThenEN(page, 'พนักงาน')
    await page.getByText('Office Booking', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await page.getByLabel('Booking date').fill('2026-08-15')
    const resp = page.waitForResponse(
      (r) => r.url().includes('/api/bookings') && r.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Save booking' }).click()
    const response = await resp
    expect(response.status()).toBe(201)
    await page.waitForTimeout(800)
    await capture(page, 'CH4_UI_19_Booking_Success_EN.png')

    // Cleanup
    const payload = await response.json() as { booking: { booking_id: string } }
    await request.post(`${apiBase}/api/bookings/${payload.booking.booking_id}/cancel`, {
      headers: { 'X-Demo-Profile-Id': ids.admin },
      data: { reason: 'Evidence cleanup' },
    })
  })

  test('20 — Booking overlap rejection', async ({ page }) => {
    await selectDemoThenEN(page, 'พนักงาน')
    await page.getByText('Office Booking', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // EMP001 already has a booking on 2026-08-04
    await page.getByLabel('Booking date').fill('2026-08-04')
    await page.getByRole('button', { name: 'Save booking' }).click()
    await expect(page.getByRole('alert')).toContainText('overlaps', { timeout: 5000 })
    await page.waitForTimeout(300)
    await capture(page, 'CH4_UI_20_Booking_Overlap_Rejection_EN.png')
  })

  test('25 — Date/time-range form with 24-hour fields', async ({ page }) => {
    await selectDemoThenEN(page, 'พนักงาน')
    await page.getByText('Office Booking', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await page.getByLabel('Booking type').selectOption('date_time_range')
    await page.waitForTimeout(300)
    await page.getByLabel('Start date').fill('2026-08-20')
    await page.getByLabel('Start time').fill('09:00')
    await page.getByLabel('End date').fill('2026-08-21')
    await page.getByLabel('End time').fill('06:00')
    await page.waitForTimeout(300)
    await capture(page, 'CH4_UI_25_DateTime_Range_Form_EN.png')
  })

  test('21 — Capacity rejection', async ({ page }) => {
    await selectDemoThenEN(page, 'ผู้ดูแลระบบ')

    // Step 1: Set IT capacity to 1
    await page.getByText('Departments', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    const itRow = page.getByRole('row').filter({ hasText: 'IT' }).first()
    await itRow.getByRole('button', { name: 'Edit' }).click()
    await page.waitForTimeout(300)
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Maximum per day').fill('1')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)

    // Step 2: Book for HR user (IT dept) on date where EMP001 already booked
    await page.getByText('Office Booking', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await page.getByLabel('Employee').selectOption(ids.hr)
    await page.waitForTimeout(500)
    await page.getByLabel('Booking date').fill('2026-08-04')
    await page.getByRole('button', { name: 'Save booking' }).click()
    await expect(page.getByRole('alert')).toContainText('capacity', { timeout: 5000 })
    await page.waitForTimeout(300)
    await capture(page, 'CH4_UI_21_Capacity_Rejection_EN.png')

    // Step 3: Restore IT capacity to 3
    await page.getByText('Departments', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    const itRow2 = page.getByRole('row').filter({ hasText: 'IT' }).first()
    await itRow2.getByRole('button', { name: 'Edit' }).click()
    await page.waitForTimeout(300)
    await page.getByRole('dialog').getByLabel('Maximum per day').fill('3')
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(1000)
  })

  test('22 — Unlimited capacity success (DIGI booking)', async ({ page, request }) => {
    await selectDemoThenEN(page, 'ผู้ดูแลระบบ')
    await page.getByText('Office Booking', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Admin is DIGI (unlimited) - book for self on an open date
    await page.getByLabel('Booking date').fill('2026-08-25')
    const resp = page.waitForResponse(
      (r) => r.url().includes('/api/bookings') && r.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Save booking' }).click()
    const response = await resp
    expect(response.status()).toBe(201)
    await page.waitForTimeout(800)
    await capture(page, 'CH4_UI_22_Unlimited_Capacity_Success_EN.png')

    const payload = await response.json() as { booking: { booking_id: string } }
    await request.post(`${apiBase}/api/bookings/${payload.booking.booking_id}/cancel`, {
      headers: { 'X-Demo-Profile-Id': ids.admin },
      data: { reason: 'Evidence cleanup' },
    })
  })

  test('23 — Holiday warning dialog (2026-10-23)', async ({ page }) => {
    await selectDemoThenEN(page, 'ผู้ดูแลระบบ')
    await page.getByText('Office Booking', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await page.getByLabel('Booking date').fill('2026-10-23')
    await page.getByRole('button', { name: 'Save booking' }).click()
    await page.waitForTimeout(1500)
    await capture(page, 'CH4_UI_23_Holiday_Warning_EN.png')

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  test('24 — Holiday booking confirmed success', async ({ page, request }) => {
    await selectDemoThenEN(page, 'ผู้ดูแลระบบ')
    await page.getByText('Office Booking', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await page.getByLabel('Booking date').fill('2026-10-23')
    await page.getByRole('button', { name: 'Save booking' }).click()
    await page.waitForTimeout(1500)

    const resp = page.waitForResponse(
      (r) => r.url().includes('/api/bookings') && r.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Confirm and save' }).click()
    const response = await resp
    expect(response.status()).toBe(201)
    await page.waitForTimeout(800)
    await capture(page, 'CH4_UI_24_Holiday_Booking_Confirmed_EN.png')

    const payload = await response.json() as { booking: { booking_id: string } }
    await request.post(`${apiBase}/api/bookings/${payload.booking.booking_id}/cancel`, {
      headers: { 'X-Demo-Profile-Id': ids.admin },
      data: { reason: 'Evidence cleanup' },
    })
  })

  test('26 — Admin calendar showing all departments', async ({ page }) => {
    await selectDemoThenEN(page, 'ผู้ดูแลระบบ')
    await page.getByText('Calendar', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    await capture(page, 'CH4_UI_26_Admin_Calendar_All_Depts_EN.png')
  })

  test('27 — Department edit dialog', async ({ page }) => {
    await selectDemoThenEN(page, 'ผู้ดูแลระบบ')
    await page.getByText('Departments', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    const itRow = page.getByRole('row').filter({ hasText: 'IT' }).first()
    await itRow.getByRole('button', { name: 'Edit' }).click()
    await page.waitForTimeout(500)
    await capture(page, 'CH4_UI_27_Department_Edit_Dialog_EN.png')
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  })

  test('28 — Report with OPS department-code filter applied', async ({ page }) => {
    await selectDemoThenEN(page, 'ผู้ดูแลระบบ')
    await page.getByText('Reports', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    const filterInput = page.getByPlaceholder('Filter...').nth(1)
    await filterInput.fill('OPS')
    await page.waitForTimeout(800)
    await capture(page, 'CH4_UI_28_Report_OPS_Filter_EN.png')
  })

  test('29 — Thai booking page', async ({ page }) => {
    await selectDemoTH(page, 'ผู้ดูแลระบบ')
    await page.getByText('จองเข้าออฟฟิศ', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await capture(page, 'CH4_UI_29_Booking_Page_TH.png')
  })

  test('30 — Language persistence after refresh', async ({ page }) => {
    await selectDemoThenEN(page, 'ผู้ดูแลระบบ')
    await page.waitForTimeout(500)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByText('Overview', { exact: true })).toBeVisible()
    await capture(page, 'CH4_UI_30_Language_Persistence_EN.png')
  })

  test('31 — Invalid timezone rejection in department form', async ({ page }) => {
    await selectDemoThenEN(page, 'ผู้ดูแลระบบ')
    await page.getByText('Departments', { exact: true }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Add department' }).click()
    await page.waitForTimeout(300)
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Timezone').fill('Mars/Olympus')
    await page.waitForTimeout(500)
    await capture(page, 'CH4_UI_31_Invalid_Timezone_Rejection_EN.png')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
  })
})

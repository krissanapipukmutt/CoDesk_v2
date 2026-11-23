/**
 * CoDesk demo walkthrough + capture (Demo Mode, Thai UI).
 *
 * Walks the same 35-step story as the demo video against the REAL frontend + ASP.NET API + database,
 * asserts each business rule, and records:
 *   demo-capture/desktop/frames/*.jpg + meta.json   (screencast frames + step captions, for the video)
 *   demo-capture/mobile/frames/*.jpg  + meta.json
 *   demo-capture/shots/*.jpg                         (clean screenshots for the slides)
 *   demo-capture/run-info.json                       (dates picked, cleanup results)
 *
 * Data: dates are picked at run time from August 2026 so nothing collides with existing bookings.
 * Everything the test changes is put back in afterAll: its bookings are cancelled, OPS capacity is
 * restored, the added holiday is deactivated, and EMP004 returns to the original department.
 *
 * Run (backend on :5080 with DemoMode, frontend `npm run dev -- --mode test` on :5173):
 *   npx playwright test demo-walkthrough --workers=1 --reporter=list
 */
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type CDPSession, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:5080'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
const OUT = path.resolve(process.cwd(), 'demo-capture')
const ids = {
  admin: '30000000-0000-0000-0000-000000000001',
  hr: '30000000-0000-0000-0000-000000000002',
  employee: '30000000-0000-0000-0000-000000000003',
  emp003: '30000000-0000-0000-0000-000000000005',
  emp004: '30000000-0000-0000-0000-000000000006',
}

type Booking = { bookingId: string; bookedForProfileId: string; departmentId: string; bookingDateStart: string; bookingDateEnd: string; statusCode: string }
type Department = { departmentId: string; departmentCode: string; departmentName: string; capacityMode: 'limited' | 'unlimited'; defaultCapacityPerDay: number | null; isActive: boolean; effectiveTimezone: string }
type Holiday = { holidayId: string; holidayDate: string; holidayName: string; holidayDescription: string | null; isActive: boolean }
type Profile = { profileId: string; employeeCode: string; fullName: string; email: string; departmentId: string; roleId: string; isActive: boolean }

// Thai date/time pickers: the input format follows the browser process language
test.use({ actionTimeout: 20_000, navigationTimeout: 30_000, launchOptions: { args: ['--lang=th-TH'], env: { ...process.env, LANG: 'th_TH.UTF-8', LANGUAGE: 'th' } } })

const run: Record<string, unknown> = { startedAt: new Date().toISOString() }
const created: string[] = []          // booking ids to cancel
const boxes: Record<string, { focus: unknown[]; marks: unknown[] }> = {}
let opsOriginal: Department | undefined
let emp004Original: Profile | undefined
let addedHolidayId: string | undefined

// ---------------------------------------------------------------- API helpers
const H = (id: string) => ({ 'X-Demo-Profile-Id': id })
async function getJson<T>(request: APIRequestContext, url: string, as = ids.admin): Promise<T> {
  const r = await request.get(apiBase + url, { headers: H(as) })
  expect(r.ok(), `GET ${url} -> ${r.status()}`).toBeTruthy()
  return await r.json() as T
}
async function getAll<T>(request: APIRequestContext, url: string): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page < 50; page++) {
    const r = await getJson<{ items: T[]; total: number }>(request, `${url}${url.includes('?') ? '&' : '?'}page=${page}&pageSize=100`)
    out.push(...r.items)
    if (!r.items.length || out.length >= r.total) break
  }
  return out
}
async function restoreDepartment(request: APIRequestContext, d: Department) {
  const r = await request.put(`${apiBase}/api/departments/${d.departmentId}`, {
    headers: H(ids.admin),
    data: { departmentCode: d.departmentCode, departmentName: d.departmentName, capacityMode: d.capacityMode,
      defaultCapacityPerDay: d.capacityMode === 'limited' ? d.defaultCapacityPerDay : null, isActive: d.isActive, effectiveTimezone: d.effectiveTimezone },
  })
  return r.status()
}

// ---------------------------------------------------------------- date picking
function augustWeekdays() {
  const out: string[] = []
  for (let day = 10; day <= 28; day++) {
    const d = new Date(Date.UTC(2026, 7, day))
    if (d.getUTCDay() >= 1 && d.getUTCDay() <= 5) out.push(d.toISOString().slice(0, 10))
  }
  return out
}
const nextDay = (iso: string) => new Date(Date.parse(iso + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
const thaiDay = (iso: string) => `${Number(iso.slice(8, 10))} ส.ค.`

// ---------------------------------------------------------------- recorder (cursor overlay + screencast + captions)
const CURSOR_JS = `(() => {
  const css = '#__cur{position:fixed;left:0;top:0;width:28px;height:28px;z-index:2147483647;pointer-events:none;transform:translate(var(--x,720px),var(--y,460px));transition:transform var(--ms,600ms) cubic-bezier(.3,.1,.2,1)}'
    + '#__cur svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}'
    + '.__rip{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;z-index:2147483646;pointer-events:none;border:3px solid rgba(49,87,213,.85);background:rgba(49,87,213,.18);animation:__rip .55s ease-out forwards}'
    + '@keyframes __rip{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}'
    + '#__fakeconfirm{position:fixed;inset:0;z-index:2147483640;display:flex;justify-content:center;align-items:flex-start;padding-top:18px}'
    + '#__fakeconfirm .box{width:448px;background:#fff;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.28),0 0 0 1px rgba(0,0,0,.08);padding:20px 22px 16px;font:14px system-ui,sans-serif;color:#202124}'
    + '#__fakeconfirm .t{font-size:15px;font-weight:600;margin-bottom:12px}#__fakeconfirm .row{display:flex;justify-content:flex-end;gap:8px;margin-top:22px}'
    + '#__fakeconfirm button{font:inherit;font-weight:600;padding:7px 18px;border-radius:999px;border:1px solid #dadce0;background:#fff;color:#1a73e8}#__fakeconfirm button.ok{background:#1a73e8;color:#fff}';
  function boot(){ if (document.getElementById('__cur') || !document.body) return;
    const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
    const c=document.createElement('div'); c.id='__cur';
    c.innerHTML='<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3 L5 22 L10 17.5 L13.5 25 L17 23.5 L13.6 16.2 L20 16.2 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const p=JSON.parse(sessionStorage.getItem('__curpos')||'[720,460]'); c.style.setProperty('--ms','0ms'); c.style.setProperty('--x',p[0]+'px'); c.style.setProperty('--y',p[1]+'px'); }
  window.__curMove=(x,y,ms)=>{ boot(); const c=document.getElementById('__cur'); c.style.setProperty('--ms',ms+'ms'); c.style.setProperty('--x',(x-4)+'px'); c.style.setProperty('--y',(y-2)+'px'); sessionStorage.setItem('__curpos',JSON.stringify([x-4,y-2])); };
  window.__curClick=(x,y)=>{ const r=document.createElement('div'); r.className='__rip'; r.style.left=x+'px'; r.style.top=y+'px'; document.body.appendChild(r); setTimeout(()=>r.remove(),700); };
  window.__fakeConfirm=(o,m,ok,cancel)=>{ const d=document.createElement('div'); d.id='__fakeconfirm'; d.innerHTML='<div class="box"><div class="t">'+o+'</div><div>'+m+'</div><div class="row"><button class="cancel">'+cancel+'</button><button class="ok">'+ok+'</button></div></div>'; document.body.appendChild(d); };
  window.__fakeConfirmClose=()=>document.getElementById('__fakeconfirm')?.remove();
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();`

class Recorder {
  frames: [number, string][] = []
  marks: { t: number; kind: string; step?: string; text?: string; sub?: string | null }[] = []
  cdp?: CDPSession
  t0 = 0
  cx: number
  cy: number
  constructor(readonly page: Page, readonly dir: string, readonly mobile = false) {
    fs.mkdirSync(path.join(dir, 'frames'), { recursive: true })
    this.cx = mobile ? 195 : 720
    this.cy = mobile ? 500 : 460
  }
  async start() {
    this.cdp = await this.page.context().newCDPSession(this.page)
    this.cdp.on('Page.screencastFrame', (ev) => {
      const fn = path.join(this.dir, 'frames', `${String(this.frames.length).padStart(6, '0')}.jpg`)
      fs.writeFileSync(fn, Buffer.from(ev.data, 'base64'))
      this.frames.push([ev.metadata.timestamp ?? Date.now() / 1000, path.relative(this.dir, fn)])
      this.cdp?.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {})
    })
    const [w, h] = this.mobile ? [780, 1688] : [1920, 1080]
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: w, maxHeight: h, everyNthFrame: 1 })
    this.t0 = Date.now() / 1000
    this.marks.push({ t: this.t0, kind: 'start' })
  }
  async stop() {
    try { await this.cdp?.send('Page.stopScreencast') } catch { /* page closed */ }
    await new Promise((r) => setTimeout(r, 300))
    fs.writeFileSync(path.join(this.dir, 'meta.json'), JSON.stringify({ t0: this.t0, t_end: Date.now() / 1000, frames: this.frames, marks: this.marks }))
  }
  caption(step: string, text: string, sub?: string) { this.marks.push({ t: Date.now() / 1000, kind: 'caption', step, text, sub: sub ?? null }) }
  async wait(s: number) { await this.page.waitForTimeout(s * 1000) }
  /** Screenshot for the slides. focus = region the slide should zoom to, marks = elements to outline (CSS px, saved to shots/boxes.json). */
  async snap(name: string, settle = 0.5, focus?: Locator | Locator[], marks: Locator[] = []) {
    await this.wait(settle)
    const box = async (l: Locator) => { const b = await l.boundingBox({ timeout: 3000 }).catch(() => null); return b ? [b.x, b.y, b.width, b.height].map((v) => Math.round(v)) : null }
    const fl = focus ? (Array.isArray(focus) ? focus : [focus]) : []
    boxes[name] = { focus: (await Promise.all(fl.map(box))).filter(Boolean), marks: (await Promise.all(marks.map(box))).filter(Boolean) }
    await this.page.evaluate(() => { const c = document.getElementById('__cur'); if (c) c.style.visibility = 'hidden'; document.querySelectorAll('.__rip').forEach((e) => e.remove()) })
    await this.page.screenshot({ path: path.join(OUT, 'shots', `${name}.jpg`), type: 'jpeg', quality: 92 })
    await this.page.evaluate(() => { const c = document.getElementById('__cur'); if (c) c.style.visibility = 'visible' })
  }
  async moveXY(x: number, y: number, ms?: number) {
    const d = Math.hypot(x - this.cx, y - this.cy)
    const dur = ms ?? Math.round(Math.min(900, Math.max(280, d * 0.75)))
    await this.page.evaluate(([a, b, c]) => (window as unknown as { __curMove: (x: number, y: number, ms: number) => void }).__curMove(a, b, c), [x, y, dur])
    await this.wait(dur / 1000 + 0.06)
    await this.page.mouse.move(x, y)
    this.cx = x; this.cy = y
  }
  async move(loc: Locator, dx = 0, dy = 0) {
    await loc.scrollIntoViewIfNeeded()
    const bb = await loc.boundingBox()
    if (!bb) throw new Error('no bounding box')
    await this.moveXY(bb.x + bb.width / 2 + dx, bb.y + bb.height / 2 + dy)
    return bb
  }
  async ripple() { await this.page.evaluate(([x, y]) => (window as unknown as { __curClick: (x: number, y: number) => void }).__curClick(x, y), [this.cx, this.cy]) }
  async click(loc: Locator, after = 0.45, real = true, dx = 0) {
    await this.move(loc, dx)
    await this.wait(0.12)
    await this.ripple()
    if (real) await this.page.mouse.click(this.cx, this.cy)
    await this.wait(after)
  }
  async type(loc: Locator, text: string, clear = false) {
    await this.click(loc, 0.2)
    if (clear) await loc.fill('')
    await this.page.keyboard.type(text, { delay: 70 })
    await this.wait(0.35)
  }
  async fillAt(loc: Locator, value: string) {           // date/time inputs: click on the left, then set the value
    const bb = await loc.boundingBox()
    await this.click(loc, 0.15, false, bb ? -(bb.width / 2) + 22 : 0)
    await loc.fill(value)
    await loc.blur()
    await this.wait(0.45)
  }
  async select(loc: Locator, label: string) {
    await this.click(loc, 0.25, false)
    await loc.selectOption({ label })
    await this.wait(0.5)
  }
  async scrollTo(loc: Locator, block: 'center' | 'start' = 'center') {
    await loc.evaluate((e, b) => e.scrollIntoView({ behavior: 'smooth', block: b as ScrollLogicalPosition }), block)
    await this.wait(0.9)
  }
  async scrollTop() {
    await this.page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); document.querySelectorAll('main').forEach((e) => e.scrollTo?.({ top: 0, behavior: 'smooth' })) })
    await this.wait(0.8)
  }
}

async function newContext(browser: Browser, mobile: boolean): Promise<BrowserContext> {
  const ctx = mobile
    ? await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, locale: 'th-TH', timezoneId: 'Asia/Bangkok' })
    : await browser.newContext({ baseURL, viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3, locale: 'th-TH', timezoneId: 'Asia/Bangkok' })
  await ctx.addInitScript(CURSOR_JS)
  if (mobile) await ctx.addInitScript("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='#__cur{display:none!important}';document.head.appendChild(s);})")
  return ctx
}

const NAV = (p: Page, name: string) => p.getByRole('navigation').getByRole('link', { name, exact: true })
const item = (p: Page, bookingId: string) => p.getByLabel(`รายการจอง ${bookingId}`, { exact: true })
async function bookingFrom(p: Page, act: () => Promise<void>): Promise<string> {
  const resp = p.waitForResponse((r) => r.url().endsWith('/api/bookings') && r.request().method() === 'POST' && r.status() === 201)
  await act()
  const payload = await (await resp).json() as { booking: { booking_id: string } }
  created.push(payload.booking.booking_id)
  return payload.booking.booking_id
}
async function chooseRole(r: Recorder, label: string) {
  await r.click(r.page.getByRole('button', { name: new RegExp('^' + label) }), 1.4)
}
async function switchRole(r: Recorder) {
  await r.click(r.page.getByRole('button', { name: 'สลับบทบาทสาธิต' }), 1.2)
}

// ---------------------------------------------------------------- the walkthrough
test.describe.serial('CoDesk demo walkthrough (capture)', () => {
  test.setTimeout(20 * 60 * 1000)
  const plan: Record<string, string | number> = {}

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true })
    fs.writeFileSync(path.join(OUT, '.gitignore'), '*\n')
    const bookings = (await getAll<Booking>(request, '/api/calendar?dateFrom=2026-08-01&dateTo=2026-09-05')).filter((b) => b.statusCode === 'booked')
    const depts = await getAll<Department>(request, '/api/departments?includeInactive=true')
    const holidays = await getAll<Holiday>(request, '/api/holidays?includeInactive=true')
    const profiles = await getAll<Profile>(request, '/api/profiles?includeInactive=true')
    const ops = depts.find((d) => d.departmentCode === 'OPS')
    const digi = depts.find((d) => d.departmentCode === 'DIGI')
    expect(ops, 'department OPS').toBeTruthy(); expect(digi, 'department DIGI').toBeTruthy()
    opsOriginal = ops
    emp004Original = profiles.find((p) => p.profileId === ids.emp004)
    const emp003 = profiles.find((p) => p.profileId === ids.emp003)!
    const deptOf = (pid: string) => profiles.find((p) => p.profileId === pid)!.departmentId
    const activeHol = new Set(holidays.filter((h) => h.isActive).map((h) => h.holidayDate))
    const anyHol = new Set(holidays.map((h) => h.holidayDate))
    const covers = (b: Booking, d: string) => b.bookingDateStart <= d && b.bookingDateEnd >= d
    const free = (pid: string, d: string) => !bookings.some((b) => b.bookedForProfileId === pid && covers(b, d))
    const count = (deptId: string, d: string) => bookings.filter((b) => b.departmentId === deptId && covers(b, d)).length
    const room = (dept: Department, d: string, extra = 0) => dept.capacityMode !== 'limited' || count(dept.departmentId, d) + extra < (dept.defaultCapacityPerDay ?? 0)
    const reserve = (pid: string, deptId: string, a: string, b = a) => bookings.push({ bookingId: 'plan', bookedForProfileId: pid, departmentId: deptId, bookingDateStart: a, bookingDateEnd: b, statusCode: 'booked' })
    const days = augustWeekdays()
    const pick = (ok: (d: string) => boolean, prefer?: (a: string, b: string) => number) => {
      const c = days.filter(ok); if (prefer) c.sort(prefer)
      if (!c.length) throw new Error('no free date found in August 2026 for this step')
      return c[0]
    }
    // D1: employee single day; HR must also be free (capacity check later uses the same day)
    const d1 = pick((d) => !activeHol.has(d) && free(ids.employee, d) && free(ids.hr, d) && room(ops!, d),
      // a day where OPS already has exactly one booking, so the employee's booking makes it 2 and HR's makes 3 (> the reduced capacity)
      (a, b) => Math.abs(count(ops!.departmentId, a) - 1) - Math.abs(count(ops!.departmentId, b) - 1) || Number(b === '2026-08-18') - Number(a === '2026-08-18') || a.localeCompare(b))
    reserve(ids.employee, ops!.departmentId, d1)
    // D2: cross-day night shift d -> d+1 (both weekdays)
    const d2 = pick((d) => { const n = nextDay(d); return days.includes(n) && ![d, n].some((x) => activeHol.has(x) || !free(ids.employee, x) || !room(ops!, x)) })
    reserve(ids.employee, ops!.departmentId, d2, nextDay(d2))
    // Dh: new company holiday + HR booking on it
    const dh = pick((d) => !anyHol.has(d) && free(ids.hr, d) && room(ops!, d) && d !== d1, (a, b) => (b === '2026-08-28' ? 1 : 0) - (a === '2026-08-28' ? 1 : 0) || b.localeCompare(a))
    reserve(ids.hr, ops!.departmentId, dh)
    // Da: admin books for EMP003
    const emp003Dept = depts.find((d) => d.departmentId === deptOf(ids.emp003))!
    const da = pick((d) => !activeHol.has(d) && d !== dh && free(ids.emp003, d) && room(emp003Dept, d), (a, b) => b.localeCompare(a))
    reserve(ids.emp003, emp003Dept.departmentId, da)
    // Dm: mobile booking for the employee
    const dm = pick((d) => !activeHol.has(d) && d !== dh && free(ids.employee, d) && room(ops!, d), (a, b) => b.localeCompare(a))
    const k = count(ops!.departmentId, d1)      // OPS bookings on D1 including the employee's (reserved above)
    Object.assign(plan, { d1, d2, d2end: nextDay(d2), dh, da, dm, opsCapacityForDemo: k, emp003: `${emp003.employeeCode} · ${emp003.fullName}`, digiLabel: `${digi!.departmentCode} · ${digi!.departmentName}`, opsLabel: `${ops!.departmentCode} · ${ops!.departmentName}` })
    run.plan = plan
    run.original = { ops, emp004: emp004Original ? { departmentId: emp004Original.departmentId } : null }
  })

  test.afterAll(async ({ request }) => {
    const cleanup: Record<string, unknown> = {}
    for (const id of created) {
      const r = await request.post(`${apiBase}/api/bookings/${id}/cancel`, { headers: H(ids.admin), data: { reason: 'Demo walkthrough cleanup' } })
      cleanup[`cancel ${id}`] = r.status()
    }
    if (opsOriginal) cleanup.restoreOps = await restoreDepartment(request, opsOriginal)
    if (addedHolidayId) {
      const h = (await getAll<Holiday>(request, '/api/holidays?includeInactive=true')).find((x) => x.holidayId === addedHolidayId)
      if (h) {
        const r = await request.put(`${apiBase}/api/holidays/${h.holidayId}`, { headers: H(ids.admin), data: { holidayDate: h.holidayDate, holidayName: h.holidayName, holidayDescription: h.holidayDescription, isActive: false } })
        cleanup.deactivateHoliday = r.status()
      }
    }
    if (emp004Original) {
      const now = await getJson<Profile>(request, `/api/profiles/${ids.emp004}`)
      if (now.departmentId !== emp004Original.departmentId) {
        const r = await request.put(`${apiBase}/api/profiles/${ids.emp004}`, { headers: H(ids.admin), data: { employeeCode: now.employeeCode, fullName: now.fullName, email: now.email, departmentId: emp004Original.departmentId, roleId: now.roleId, isActive: now.isActive } })
        cleanup.restoreEmp004 = r.status()
      }
    }
    run.cleanup = cleanup
    fs.writeFileSync(path.join(OUT, 'shots', 'boxes.json'), JSON.stringify(boxes, null, 1))
    run.finishedAt = new Date().toISOString()
    fs.writeFileSync(path.join(OUT, 'run-info.json'), JSON.stringify(run, null, 2))
  })

  test('desktop walkthrough: employee → HR → admin → language', async ({ browser, request }) => {
    const ctx = await newContext(browser, false)
    const p = await ctx.newPage()
    p.on('dialog', (d) => { void d.accept() })
    const r = new Recorder(p, path.join(OUT, 'desktop'))
    const { d1, d2, d2end, dh, da, opsCapacityForDemo: k } = plan as Record<string, string> & { opsCapacityForDemo: number }
    try {
      await p.goto('/auth'); await p.evaluate(() => localStorage.clear()); await p.goto('/auth')
      await expect(p.getByText('เลือกบทบาทสำหรับการสาธิตระบบ')).toBeVisible()
      await r.start(); await r.wait(1)

      // ---------- roles
      r.caption('roles', 'เข้าสู่โหมดสาธิต — เลือกบทบาทผู้ใช้งาน', 'พนักงาน · ฝ่ายทรัพยากรบุคคล · ผู้ดูแลระบบ')
      await r.snap('S01_roles')
      for (const n of ['พนักงาน', 'ฝ่ายทรัพยากรบุคคล', 'ผู้ดูแลระบบ']) { await r.move(p.getByRole('button', { name: new RegExp('^' + n) }), 0, -20); await r.wait(1) }
      r.caption('emp', 'บทบาทพนักงาน (Employee)', 'นนท์ พนักงานหนึ่ง · ฝ่ายปฏิบัติการ (OPS)')
      await chooseRole(r, 'พนักงาน')

      // ---------- employee: dashboard
      r.caption('dash', 'หน้าภาพรวม', 'แสดงบทบาท ฝ่ายงาน และรายการจองที่ยังใช้งาน')
      await r.move(p.getByRole('heading', { name: 'รายการจองที่ยังใช้งาน' }), 200, 60)
      await r.snap('S02_emp_dash'); await r.wait(1.5)

      // single day
      await r.click(NAV(p, 'จองเข้าออฟฟิศ'), 1.2)
      r.caption('single', 'จองแบบรายวัน (เต็มวัน)', 'เลือกวันที่ ระบบแสดงฝ่ายและเขตเวลาให้อัตโนมัติ')
      await r.move(p.locator('form strong').first()); await r.wait(0.8)
      await r.fillAt(p.getByLabel('วันที่จอง'), d1)
      await r.type(p.getByLabel('หมายเหตุ'), 'ประชุมทีมประจำสัปดาห์')
      await r.snap('S03_single_form', 0.5, p.locator('form').first(), [p.getByLabel('วันที่จอง'), p.getByLabel('หมายเหตุ')])
      const idSingle = await bookingFrom(p, () => r.click(p.getByRole('button', { name: 'บันทึกการจอง' }), 0.3))
      await expect(p.getByText('บันทึกรายการจองสำเร็จ')).toBeVisible()
      r.caption('single_ok', 'บันทึกสำเร็จ', 'รายการใหม่ปรากฏในรายการจองทันที พร้อมเก็บ Audit Log')
      await r.snap('S04_single_ok', 0.5, [p.getByText('บันทึกรายการจองสำเร็จ').first(), item(p, idSingle)], [p.getByText('บันทึกรายการจองสำเร็จ').first(), item(p, idSingle)]); await r.wait(1)
      await r.scrollTo(item(p, idSingle)); await r.move(item(p, idSingle), -200); await r.wait(1.8); await r.scrollTop()

      // cross-day range
      r.caption('range', 'จองแบบช่วงวันและเวลา (ข้ามวัน)', `เช่น กะกลางคืน ${thaiDay(d2)} 22:00 ถึง ${thaiDay(d2end)} 06:00`)
      await r.select(p.getByLabel('รูปแบบการจอง'), 'ช่วงวันและเวลา')
      await r.fillAt(p.getByLabel('วันที่เริ่ม'), d2)
      await r.fillAt(p.getByLabel('เวลาเริ่ม'), '22:00')
      await r.fillAt(p.getByLabel('วันที่สิ้นสุด'), d2end)
      await r.fillAt(p.getByLabel('เวลาสิ้นสุด'), '06:00')
      await r.type(p.getByLabel('หมายเหตุ'), 'ดูแลระบบปิดงวดช่วงกลางคืน', true)
      await r.snap('S05_range_form', 0.5, p.locator('form').first(), [p.getByLabel('รูปแบบการจอง'), p.getByLabel('วันที่เริ่ม'), p.getByLabel('เวลาสิ้นสุด')])
      const idNight = await bookingFrom(p, () => r.click(p.getByRole('button', { name: 'บันทึกการจอง' }), 0.3))
      await expect(p.getByText('บันทึกรายการจองสำเร็จ')).toBeVisible()
      await r.wait(1)
      await r.scrollTo(item(p, idNight)); await r.move(item(p, idNight), -200); await r.snap('S06_range_ok', 0.5, item(p, idNight), [item(p, idNight)]); await r.wait(1.8); await r.scrollTop()

      // overlap
      r.caption('overlap', 'ระบบป้องกันการจองซ้อนช่วงเวลา', `ลองจองวันที่ ${thaiDay(d1)} ซ้ำ — ฐานข้อมูลปฏิเสธด้วย Exclusion Constraint`)
      await r.select(p.getByLabel('รูปแบบการจอง'), 'รายวัน (เต็มวัน)')
      await r.fillAt(p.getByLabel('วันที่จอง'), d1)
      await r.type(p.getByLabel('หมายเหตุ'), 'ลองจองซ้ำ', true)
      await r.click(p.getByRole('button', { name: 'บันทึกการจอง' }), 0.3)
      await expect(p.getByText('ช่วงเวลานี้ซ้อนกับรายการจองเดิมของพนักงาน')).toBeVisible()
      await r.move(p.getByRole('alert').first()); await r.snap('S07_overlap', 0.5, p.locator('form').first(), [p.getByRole('alert').first()]); await r.wait(2.6)
      await r.click(p.getByRole('button', { name: 'ล้างค่า' }), 0.8)

      // edit
      r.caption('edit', 'แก้ไขรายการจอง', 'เปลี่ยนเวลาสิ้นสุดของกะกลางคืนเป็น 07:00')
      await r.scrollTo(item(p, idNight))
      await r.click(item(p, idNight).getByRole('button', { name: 'แก้ไข' }), 0.8)
      await r.scrollTop(); await r.wait(0.5)
      await r.fillAt(p.getByLabel('เวลาสิ้นสุด'), '07:00')
      await r.snap('S08_edit_form', 0.5, p.locator('form').first(), [p.getByLabel('เวลาสิ้นสุด')])
      await r.click(p.getByRole('button', { name: 'บันทึกการแก้ไข' }), 0.3)
      await expect(p.getByText('แก้ไขรายการจองสำเร็จ')).toBeVisible()
      await r.wait(1)
      await expect(item(p, idNight)).toContainText(`${d2end} 07:00`)
      await r.scrollTo(item(p, idNight)); await r.move(item(p, idNight), -150); await r.snap('S09_edit_ok', 0.5, item(p, idNight), [item(p, idNight)]); await r.wait(1.6)

      // calendar
      await r.click(NAV(p, 'ปฏิทิน'), 1.6)
      r.caption('cal_emp', 'ปฏิทินรายเดือน', 'พนักงานเห็นเฉพาะการจองของสมาชิกในฝ่ายเดียวกัน (OPS)')
      await r.snap('S12_cal_emp', 1.0, p.locator('.fc').first()); await r.wait(1)
      const ev = p.locator('.fc-event').filter({ hasText: 'นนท์' }).first()
      await r.move(ev); await r.wait(0.5); await r.click(ev, 1.2)
      r.caption('cal_detail', 'ดูรายละเอียดการจอง', 'พนักงาน ฝ่าย เวลาเริ่ม–สิ้นสุด และเขตเวลาของการจอง')
      await expect(p.getByText('รายละเอียดการจอง')).toBeVisible()
      await r.snap('S13_cal_detail', 0.5, p.getByRole('dialog')); await r.wait(2.4)
      await p.keyboard.press('Escape'); await r.wait(0.8)

      // cancel the night shift (the browser confirm is drawn as an overlay: screen capture cannot see native dialogs)
      await r.click(NAV(p, 'จองเข้าออฟฟิศ'), 1.2)
      r.caption('cancel', 'ยกเลิกรายการจอง', 'ระบบถามยืนยันก่อนยกเลิก และบันทึกประวัติการยกเลิก')
      const night = item(p, idNight)
      await r.scrollTo(night)
      const cancelBtn = night.getByRole('button', { name: 'ยกเลิก' })
      await r.click(cancelBtn, 0.25, false)
      await p.evaluate(() => (window as unknown as { __fakeConfirm: (...a: string[]) => void }).__fakeConfirm(location.host + ' บอกว่า', 'ยืนยันการยกเลิกรายการนี้?', 'ตกลง', 'ยกเลิก'))
      await r.snap('S10_cancel_confirm', 0.3, [p.locator('#__fakeconfirm .box'), night], [p.locator('#__fakeconfirm .box')]); await r.wait(1)
      await r.click(p.locator('#__fakeconfirm button.ok'), 0.1, false)
      await p.evaluate(() => (window as unknown as { __fakeConfirmClose: () => void }).__fakeConfirmClose())
      await cancelBtn.click()
      await expect(p.getByText('ยกเลิกรายการจองแล้ว')).toBeVisible()
      await r.wait(1); await r.move(night, -150); await r.snap('S11_cancel_done', 0.5, night, [night]); await r.wait(1.6)

      // holidays read-only
      await r.click(NAV(p, 'จัดการวันหยุด'), 1.2)
      r.caption('hol_emp', 'วันหยุดองค์กร', 'พนักงานดูได้อย่างเดียว — เพิ่ม/แก้ไขได้เฉพาะ HR และผู้ดูแลระบบ')
      await expect(p.getByRole('button', { name: 'เพิ่มวันหยุด' })).toHaveCount(0)
      await r.snap('S14_hol_emp', 0.5, p.locator('main')); await r.wait(2.4)
      await switchRole(r)

      // ---------- HR
      r.caption('hr', 'บทบาทฝ่ายทรัพยากรบุคคล (HR)', 'ปวีณา ฝ่ายบุคคล · มีเมนูจัดการฝ่าย พนักงาน วันหยุด และรายงาน')
      await chooseRole(r, 'ฝ่ายทรัพยากรบุคคล')
      await r.snap('S15_hr_dash', 1.0); await r.wait(1)

      await r.click(NAV(p, 'จัดการฝ่ายงาน'), 1.2)
      r.caption('dept', 'จัดการฝ่ายงาน', 'กำหนดความจุต่อวัน (จำกัด/ไม่จำกัด) และเขตเวลา IANA ของแต่ละฝ่าย')
      await r.snap('S16_dept_list', 0.8, p.getByRole('table').first(), [p.getByRole('row').filter({ hasText: 'OPS' })]); await r.wait(1)
      const opsRow = p.getByRole('row').filter({ hasText: 'OPS' })
      await r.click(opsRow.getByRole('button', { name: 'แก้ไข' }), 1.0)
      r.caption('dept_edit', `ปรับความจุฝ่าย OPS เป็น ${k} คนต่อวัน`, `วันที่ ${thaiDay(d1)} ฝ่าย OPS มีผู้จองแล้ว ${k} คน`)
      const dlg = p.getByRole('dialog')
      if (opsOriginal?.capacityMode !== 'limited') await r.select(dlg.getByLabel('รูปแบบความจุ'), 'จำกัด')
      await r.type(dlg.getByLabel('จำนวนสูงสุดต่อวัน'), String(k), true)
      await r.snap('S17_dept_edit', 0.5, dlg, [dlg.getByLabel('จำนวนสูงสุดต่อวัน')])
      await r.click(dlg.getByRole('button', { name: 'บันทึก', exact: true }), 0.3)
      await expect(p.getByText('แก้ไขฝ่ายงานสำเร็จ')).toBeVisible()
      await r.move(opsRow); await r.wait(1.6)

      await r.click(NAV(p, 'จองเข้าออฟฟิศ'), 1.2)
      r.caption('cap', 'ระบบควบคุมความจุของฝ่าย', `วันที่ ${thaiDay(d1)} ฝ่าย OPS มีผู้จองครบ ${k} คนแล้ว — ระบบไม่ให้จองเพิ่ม`)
      await r.fillAt(p.getByLabel('วันที่จอง'), d1)
      await r.click(p.getByRole('button', { name: 'บันทึกการจอง' }), 0.3)
      await expect(p.getByText('ไม่สามารถจองได้ เนื่องจากจำนวนผู้จองของฝ่ายนี้')).toBeVisible()
      await r.move(p.getByRole('alert').first()); await r.snap('S18_cap_error', 0.5, p.locator('form').first(), [p.getByRole('alert').first()]); await r.wait(2.8)
      await r.click(p.getByRole('button', { name: 'ล้างค่า' }), 0.6)
      run.restoreOpsAfterCapacityStep = await restoreDepartment(request, opsOriginal!)   // put the real capacity back right away

      await r.click(NAV(p, 'จัดการวันหยุด'), 1.2)
      r.caption('hol_add', 'เพิ่มวันหยุดองค์กร', `HR เพิ่มวันหยุดพิเศษของบริษัทในวันที่ ${thaiDay(dh)} 2026`)
      await r.click(p.getByRole('button', { name: 'เพิ่มวันหยุด' }), 1.0)
      const hd = p.getByRole('dialog')
      await r.fillAt(hd.locator('input[type=date]'), dh)
      await r.type(hd.getByLabel('ชื่อวันหยุด'), 'วันหยุดพิเศษประจำปีของบริษัท (สาธิต)')
      await r.type(hd.getByLabel('รายละเอียด'), 'กิจกรรมสัมมนาประจำปี')
      await r.snap('S19_hol_dialog', 0.5, hd, [hd.locator('input[type=date]'), hd.getByLabel('ชื่อวันหยุด')])
      const holResp = p.waitForResponse((x) => x.url().endsWith('/api/holidays') && x.request().method() === 'POST')
      await r.click(hd.getByRole('button', { name: 'บันทึก', exact: true }), 0.3)
      const hj = await (await holResp).json() as { holidayId: string }
      addedHolidayId = hj.holidayId
      await expect(p.getByText('เพิ่มวันหยุดสำเร็จ')).toBeVisible()
      await r.wait(1); await r.move(p.getByRole('row').filter({ hasText: dh })); await r.snap('S20_hol_ok', 0.5, p.getByRole('table').first(), [p.getByRole('row').filter({ hasText: dh })]); await r.wait(1.8)

      await r.click(NAV(p, 'จองเข้าออฟฟิศ'), 1.2)
      r.caption('hol_book', 'จองตรงวันหยุด', 'ระบบแจ้งเตือนและให้ยืนยันก่อนบันทึก')
      await r.fillAt(p.getByLabel('วันที่จอง'), dh)
      await r.type(p.getByLabel('หมายเหตุ'), 'เตรียมงานสัมมนา')
      await r.click(p.getByRole('button', { name: 'บันทึกการจอง' }), 1.0)
      await expect(p.getByText('วันที่เลือกตรงกับวันหยุด')).toBeVisible()
      await r.move(p.getByRole('dialog').getByText(dh).first()); await r.snap('S21_hol_confirm', 0.5, p.getByRole('dialog'), [p.getByRole('dialog').getByText(dh).first()]); await r.wait(2.2)
      const idHol = await bookingFrom(p, () => r.click(p.getByRole('button', { name: 'ยืนยันและบันทึก' }), 0.3))
      await expect(p.getByText('บันทึกรายการจองสำเร็จ')).toBeVisible()
      await r.wait(1); await r.scrollTo(item(p, idHol)); await r.move(item(p, idHol), -150); await r.snap('S22_hol_book_ok', 0.5, item(p, idHol), [item(p, idHol)]); await r.wait(1.6); await r.scrollTop()

      await r.click(NAV(p, 'จัดการพนักงาน'), 1.2)
      r.caption('emp_mgmt', 'จัดการพนักงาน', 'HR แก้ไขข้อมูลพนักงานได้ แต่เปลี่ยนบทบาทไม่ได้')
      await r.snap('S23_emp_list', 0.8, p.getByRole('table').first(), [p.getByRole('row').filter({ hasText: 'EMP004' })]); await r.wait(1)
      const empRow = p.getByRole('row').filter({ hasText: 'EMP004' })
      await r.click(empRow.getByRole('button', { name: 'แก้ไข' }), 1.0)
      const target = emp004Original?.departmentId === (await getAll<Department>(request, '/api/departments')).find((d) => d.departmentCode === 'DIGI')?.departmentId ? plan.opsLabel as string : plan.digiLabel as string
      r.caption('transfer', `ย้ายพนักงานไปฝ่าย ${target.split(' · ')[0]}`, 'เขตเวลาโปรไฟล์อัปเดตตามฝ่ายใหม่อัตโนมัติ')
      const ed = p.getByRole('dialog')
      await r.select(ed.getByLabel('ฝ่ายงาน'), target)
      await r.snap('S24_transfer', 0.5, ed, [ed.getByLabel('ฝ่ายงาน')]); await r.wait(0.8)
      await r.click(ed.getByRole('button', { name: 'บันทึก', exact: true }), 0.3)
      await expect(p.getByText('แก้ไขข้อมูลพนักงานสำเร็จ')).toBeVisible()
      await r.wait(1); await r.click(empRow.getByRole('button', { name: 'แก้ไข' }), 1.2)
      r.caption('history', 'ประวัติฝ่ายงาน', 'Trigger ในฐานข้อมูลปิดช่วงฝ่ายเดิมและเปิดช่วงฝ่ายใหม่ให้อัตโนมัติ')
      const hist = p.getByRole('dialog').getByText('ประวัติฝ่ายงาน')
      await expect(hist).toBeVisible()
      await r.scrollTo(hist, 'start'); await r.move(hist, 0, 60); await r.snap('S25_history', 0.5, p.getByRole('dialog'), [hist.locator('xpath=..')]); await r.wait(2.6)
      await p.keyboard.press('Escape'); await r.wait(0.8)

      await r.click(NAV(p, 'รายงาน'), 1.5)
      r.caption('reports', 'รายงานจาก PostgreSQL Views', 'เลือกช่วงวันที่ เดือนสิงหาคม 2026')
      await r.fillAt(p.getByLabel('ตั้งแต่วันที่'), '2026-08-01')
      await r.fillAt(p.getByLabel('ถึงวันที่'), '2026-08-31')
      await r.wait(1.5); await r.snap('S26_rep_daily', 0.5, p.locator('main'), [p.getByLabel('ตั้งแต่วันที่'), p.getByLabel('ถึงวันที่')])
      const tabs = ['การจองและความจุของฝ่าย', 'ความถี่การจองของพนักงาน', 'การจองในวันหยุด', 'สรุปการยกเลิก']
      const subs = ['กราฟเปรียบเทียบจำนวนที่จองกับความจุของแต่ละฝ่ายรายวัน', 'จำนวนการจองทั้งหมด ใช้งาน และยกเลิก ของพนักงานแต่ละคน', 'รายการที่จองตรงวันหยุด พร้อมสถานะการยืนยัน', 'ใครยกเลิก เมื่อไร และด้วยเหตุผลอะไร — นับตามวันที่กดยกเลิก']
      for (const [i, t] of tabs.entries()) {
        await r.click(p.getByRole('button', { name: t, exact: true }), 1.0)
        r.caption('rep_' + i, 'รายงาน: ' + t, subs[i])
        if (i === 0) {
          await r.wait(1.2); await r.snap('S27_rep_capacity', 0.5, p.locator('main'))
          const f = p.getByLabel('กรอง department_code')
          await r.scrollTo(f); await r.click(f, 0.2)
          await f.fill('OPS')                     // one change event: typing key by key races the table reload
          await expect(f).toHaveValue('OPS')
          r.caption('rep_filter', 'กรองรายคอลัมน์แบบ Excel', 'กรองเฉพาะรหัสฝ่าย OPS')
          await r.wait(1.2)                       // the table reloads from the API, which can reset the scroll
          await r.scrollTo(f, 'start'); await p.evaluate(() => { window.scrollBy({ top: -150 }); document.querySelectorAll('main').forEach((e) => e.scrollBy?.({ top: -150 })) })
          await r.wait(0.4); await r.move(f)
          await r.snap('S28_rep_filter', 0.6, p.getByRole('table').first(), [f]); await r.wait(2); await r.scrollTop()
        } else {
          if (i === 3) {                          // cancellations are dated by the day they were cancelled: widen the range to this month
            const now = new Date()
            const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
            await r.fillAt(p.getByLabel('ถึงวันที่'), monthEnd); await r.wait(1.2)
          }
          await r.snap(`S${28 + i}_rep_${i}`, 1.0, p.getByRole('table').first()); await r.wait(2.2)
        }
      }
      await switchRole(r)

      // ---------- admin
      r.caption('admin', 'บทบาทผู้ดูแลระบบ (Admin)', 'อริสา ผู้ดูแลระบบ · เข้าถึงข้อมูลทุกฝ่าย')
      await chooseRole(r, 'ผู้ดูแลระบบ')
      await r.wait(1)
      await r.click(NAV(p, 'ปฏิทิน'), 1.6)
      r.caption('cal_admin', 'ปฏิทินของผู้ดูแลระบบ', 'เห็นการจองของทุกฝ่าย ทั้ง OPS และ DIGI')
      await r.wait(1); await r.snap('S32_cal_admin', 0.5, p.locator('.fc').first())
      for (const n of ['วายุ', 'อริสา', 'ลลิน']) { const e = p.locator('.fc-event').filter({ hasText: n }).first(); if (await e.count()) { await r.move(e); await r.wait(0.8) } }

      await r.click(NAV(p, 'จองเข้าออฟฟิศ'), 1.2)
      r.caption('on_behalf', 'จองแทนพนักงานคนอื่น', 'เฉพาะผู้ดูแลระบบเลือกพนักงานได้ — ฝ่ายและเขตเวลาเปลี่ยนตามพนักงาน')
      await r.select(p.getByRole('combobox', { name: 'พนักงาน' }), plan.emp003 as string)
      await r.move(p.locator('form strong').first()); await r.wait(0.8)
      await r.fillAt(p.getByLabel('วันที่จอง'), da)
      await r.type(p.getByLabel('หมายเหตุ'), 'จองแทน: ประชุมกับลูกค้า')
      await r.snap('S33_onbehalf_form', 0.5, p.locator('form').first(), [p.getByRole('combobox', { name: 'พนักงาน' }), p.locator('form strong').first()])
      const idBehalf = await bookingFrom(p, () => r.click(p.getByRole('button', { name: 'บันทึกการจอง' }), 0.3))
      await expect(p.getByText('บันทึกรายการจองสำเร็จ')).toBeVisible()
      await r.scrollTo(item(p, idBehalf)); await r.move(item(p, idBehalf), -150); await r.snap('S34_onbehalf_ok', 0.5, item(p, idBehalf), [item(p, idBehalf)]); await r.wait(1.8); await r.scrollTop()

      await r.click(NAV(p, 'ผู้ใช้และสิทธิ์'), 1.4)
      r.caption('users', 'ผู้ใช้และสิทธิ์', 'สร้างบัญชีผ่าน Backend + Supabase Admin API — Secret key ไม่ถูกส่งไปเบราว์เซอร์')
      await r.wait(1.4); await r.snap('S35_users', 0.5, p.locator('main'))
      await r.click(p.getByRole('button', { name: 'สร้างผู้ใช้' }), 1.0)
      const ud = p.getByRole('dialog')
      await r.type(ud.getByLabel('รหัสพนักงาน'), 'EMP005')
      await r.type(ud.getByLabel('ชื่อ-นามสกุล'), 'ภูมิ พนักงานใหม่')
      await r.type(ud.getByLabel('อีเมล'), 'phum.new@example.test')
      await r.snap('S36_users_dialog', 0.5, ud); await r.wait(1.2)
      r.caption('users_note', 'ตัวอย่างฟอร์มสร้างบัญชี', 'ในการสาธิตจะไม่สร้างบัญชีจริง จึงกดยกเลิก')
      await r.wait(1.6)
      await r.click(ud.getByRole('button', { name: 'ยกเลิก', exact: true }), 0.8)

      // ---------- language
      await r.click(NAV(p, 'ภาพรวม'), 1.0)
      r.caption('lang', 'สลับภาษา ไทย / English', 'ทุกหน้าจอเปลี่ยนภาษาได้ทันที')
      await r.click(p.getByRole('banner').getByRole('button', { name: 'EN' }), 1.6)
      await expect(p.locator('html')).toHaveAttribute('lang', 'en')
      await r.snap('S37_en_dash')
      await r.click(NAV(p, 'Office Booking'), 1.6); await r.snap('S38_en_booking')
      await r.click(NAV(p, 'Calendar'), 2.0); await r.snap('S39_en_calendar')
      await r.click(NAV(p, 'Reports'), 1.4)
      await r.fillAt(p.getByLabel('From date'), '2026-08-01'); await r.fillAt(p.getByLabel('To date'), '2026-08-31'); await r.wait(1.2)
      await r.snap('S40_en_reports')
      await r.click(p.getByRole('banner').getByRole('button', { name: 'ไทย' }), 1.6)
      await r.wait(1)
    } finally {
      await r.stop()
      await ctx.close()
    }
  })

  test('mobile walkthrough', async ({ browser }) => {
    const ctx = await newContext(browser, true)
    const p = await ctx.newPage()
    const r = new Recorder(p, path.join(OUT, 'mobile'), true)
    const dm = plan.dm as string
    try {
      await p.goto('/auth'); await p.evaluate(() => localStorage.clear()); await p.goto('/auth')
      await r.start(); await r.wait(1.2)
      await r.snap('M1_roles')
      await r.click(p.getByRole('button', { name: /^พนักงาน/ }), 1.6); await r.wait(1.2)
      await r.snap('M2_dash')
      await r.click(p.getByRole('button', { name: 'เปิดเมนู' }), 1.2)
      await r.snap('M3_menu')
      await r.click(NAV(p, 'จองเข้าออฟฟิศ'), 1.4)
      await r.fillAt(p.getByLabel('วันที่จอง'), dm)
      await r.type(p.getByLabel('หมายเหตุ'), 'ทำงานที่ออฟฟิศ')
      await r.snap('M4_form')
      const idMobile = await bookingFrom(p, () => r.click(p.getByRole('button', { name: 'บันทึกการจอง' }), 0.4))
      await expect(p.getByText('บันทึกรายการจองสำเร็จ')).toBeVisible()
      await r.wait(1.6)
      await r.scrollTo(item(p, idMobile)); await r.snap('M5_list'); await r.wait(2)
      await r.scrollTop()
      await r.click(p.getByRole('button', { name: 'เปิดเมนู' }), 1.2)
      await r.click(NAV(p, 'ปฏิทิน'), 2.5)
      await r.snap('M6_calendar'); await r.wait(1.5)
    } finally {
      await r.stop()
      await ctx.close()
    }
  })
})

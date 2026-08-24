import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { ReportsPage } from '../pages/ReportsPage'

type ChartDatum = Record<string, unknown>
type InjectedChartProps = { chartData?: ChartDatum[] }

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
  BarChart: ({
    children,
    data,
    layout,
  }: {
    children: ReactNode
    data: ChartDatum[]
    layout: string
  }) => (
    <div data-testid="capacity-chart" data-layout={layout}>
      {Children.map(children, (child) =>
        isValidElement(child)
          ? cloneElement(child as ReactElement<InjectedChartProps>, { chartData: data })
          : child,
      )}
    </div>
  ),
  XAxis: () => null,
  YAxis: ({ chartData = [], dataKey }: InjectedChartProps & { dataKey: string }) => (
    <div>
      {chartData.map((row, index) => (
        <span key={index}>{String(row[dataKey])}</span>
      ))}
    </div>
  ),
  Tooltip: ({
    chartData = [],
    content,
  }: InjectedChartProps & { content: ReactElement<Record<string, unknown>> }) => (
    <div>
      {chartData.map((row, index) => (
        <div key={index} data-testid={`capacity-tooltip-${index}`}>
          {cloneElement(content, { active: true, payload: [{ payload: row }] })}
        </div>
      ))}
    </div>
  ),
  Bar: ({
    chartData = [],
    shape,
  }: InjectedChartProps & { shape: ReactElement<Record<string, unknown>> }) => (
    <svg>
      {chartData.map((row, index) =>
        cloneElement(shape, {
          key: index,
          payload: row,
          x: 200,
          y: index * 30,
          width: 20,
          height: 18,
          background: { x: 200, y: index * 30, width: 240, height: 18 },
        }),
      )}
    </svg>
  ),
}))

const capacityRows = [
  {
    business_date: '2026-08-24', department_code: 'DIGI', department_name: 'Digital',
    capacity_mode: 'limited', capacity_per_day: 1, booked_count: 1,
    remaining_capacity: 0, utilization_percentage: 100,
  },
  {
    business_date: '2026-08-25', department_code: 'IT', department_name: 'Information Technology',
    capacity_mode: 'limited', capacity_per_day: 3, booked_count: 1,
    remaining_capacity: 2, utilization_percentage: 33.33,
  },
  {
    business_date: '2026-08-26', department_code: 'HR', department_name: 'Human Resources',
    capacity_mode: 'unlimited', capacity_per_day: null, booked_count: 1,
    remaining_capacity: null, utilization_percentage: null,
  },
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><ReportsPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('department capacity utilization chart', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.includes('/api/departments')
        ? { items: [], total: 0, page: 1, pageSize: 100 }
        : url.includes('/api/reports/department-capacity-utilization')
          ? { items: capacityRows, total: capacityRows.length, page: 1, pageSize: 20 }
          : { items: [], total: 0, page: 1, pageSize: 20 }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('shows horizontal limited utilization and an honest unlimited row', async () => {
    const user = userEvent.setup()
    const { container } = renderPage()

    await user.click(screen.getByRole('button', { name: 'Department capacity utilization' }))

    expect(await screen.findByTestId('capacity-chart')).toHaveAttribute('data-layout', 'vertical')
    expect(screen.getByText('DIGI · 24/08/2026')).toBeInTheDocument()
    expect(screen.getByText('IT · 25/08/2026')).toBeInTheDocument()
    expect(screen.getByText('HR · 26/08/2026')).toBeInTheDocument()
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByText('Booked 1 · Unlimited')).toBeInTheDocument()
    expect(screen.queryByText('1 / 0')).not.toBeInTheDocument()

    const filledBars = [...container.querySelectorAll('rect[fill="#3157d5"]')]
    expect(filledBars).toHaveLength(2)
    expect(Number(filledBars[0].getAttribute('width'))).toBe(240)
    expect(Number(filledBars[1].getAttribute('width'))).toBeCloseTo(79.99, 1)

    const limitedTooltip = within(screen.getByTestId('capacity-tooltip-1'))
    expect(limitedTooltip.getByText('33.33%')).toBeInTheDocument()
    expect(limitedTooltip.getByText('2')).toBeInTheDocument()
    const unlimitedTooltip = within(screen.getByTestId('capacity-tooltip-2'))
    expect(unlimitedTooltip.getByText('Unlimited')).toBeInTheDocument()
    expect(unlimitedTooltip.queryByText('Used (%)')).not.toBeInTheDocument()
  })
})

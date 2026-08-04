import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { DemoSelectionPage } from '../pages/DemoSelectionPage'
import { profile } from './testData'

describe('demo role selection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      return new Response(JSON.stringify(url.endsWith('/api/me') ? { ...profile, roleId: undefined, timezoneName: undefined } : [profile]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
  })
  it('loads seeded demo identities and stores the selected profile', async () => {
    const user = userEvent.setup(); const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/auth']}><AuthProvider><Routes><Route path="/auth" element={<DemoSelectionPage />} /><Route path="/" element={<div>หน้าหลัก</div>} /></Routes></AuthProvider></MemoryRouter></QueryClientProvider>)
    const name = await screen.findByText(profile.fullName)
    await user.click(name.closest('button')!)
    await waitFor(() => expect(localStorage.getItem('codesk.demoProfileId')).toBe(profile.profileId))
    expect(await screen.findByText('หน้าหลัก')).toBeInTheDocument()
  })
})


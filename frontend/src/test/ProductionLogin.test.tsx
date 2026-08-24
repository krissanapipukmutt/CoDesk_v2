import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthValue } from '../auth/AuthState'
import i18n from '../i18n'
import { DemoSelectionPage } from '../pages/DemoSelectionPage'

vi.mock('../api/client', () => ({
  apiFetch: vi.fn(),
  isDemoMode: false,
}))

function renderLogin(signIn = vi.fn<AuthValue['signIn']>()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const auth: AuthValue = {
    user: null,
    loading: false,
    error: null,
    selectDemoProfile: vi.fn(),
    signIn,
    signOut: vi.fn(),
    refresh: vi.fn(),
  }
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AuthContext.Provider value={auth}>
          <DemoSelectionPage />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { signIn }
}

describe('production login', () => {
  it('toggles password visibility without submitting the form', async () => {
    await i18n.changeLanguage('en')
    const user = userEvent.setup()
    const { signIn } = renderLogin()
    const password = screen.getByLabelText('Password', { selector: 'input' })

    expect(password).toHaveAttribute('type', 'password')
    const showButton = screen.getByRole('button', { name: 'Show password' })
    expect(showButton).toHaveAttribute('type', 'button')

    await user.click(showButton)
    expect(password).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')
    expect(signIn).not.toHaveBeenCalled()
  })
})

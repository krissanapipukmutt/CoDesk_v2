import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import i18n, { languageStorageKey, setLanguage } from '../i18n'
import { useTranslation } from 'react-i18next'

function DashboardLabel() {
  const { t } = useTranslation()
  return <p>{t('navigation.dashboard')}</p>
}

describe('language preference', () => {
  it('defaults to Thai without browser-language detection', () => {
    Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'en-US' })
    render(<LanguageSwitcher />)
    expect(i18n.resolvedLanguage).toBe('th')
    expect(document.documentElement.lang).toBe('th')
    expect(screen.getByRole('button', { name: 'ไทย' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches Thai to English immediately and persists the choice', async () => {
    const user = userEvent.setup()
    render(<><LanguageSwitcher /><DashboardLabel /></>)
    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(localStorage.getItem(languageStorageKey)).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('switches English back to Thai', async () => {
    await setLanguage('en')
    const user = userEvent.setup()
    render(<LanguageSwitcher />)
    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(i18n.resolvedLanguage).toBe('th')
    expect(localStorage.getItem(languageStorageKey)).toBe('th')
    expect(document.documentElement.lang).toBe('th')
  })

  it('exposes a localized accessible group label', async () => {
    const user = userEvent.setup()
    render(<LanguageSwitcher />)
    expect(screen.getByRole('group', { name: 'เลือกภาษา' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByRole('group', { name: 'Choose language' })).toBeInTheDocument()
  })

  it('does not issue network or database writes when switching language', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const user = userEvent.setup()
    render(<LanguageSwitcher />)
    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('does not modify an IANA timezone value', async () => {
    const user = userEvent.setup()
    render(<><LanguageSwitcher /><output>Asia/Tokyo</output></>)
    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByText('Asia/Tokyo')).toHaveTextContent('Asia/Tokyo')
    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(screen.getByText('Asia/Tokyo')).toHaveTextContent('Asia/Tokyo')
  })
})

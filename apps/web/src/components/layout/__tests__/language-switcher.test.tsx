import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageSwitcher } from '../language-switcher'

const mockPush = vi.fn()
const mockPathname = '/en/jobs'

// Mock next-intl
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}))

// Mock Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

// Mock DropdownMenu components
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} data-testid="dropdown-item" {...props}>
      {children}
    </button>
  ),
}))

// Mock lucide-react Globe icon
vi.mock('lucide-react', () => ({
  Globe: () => <span data-testid="globe-icon">Globe</span>,
}))

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render language switcher button', () => {
    render(<LanguageSwitcher />)

    expect(screen.getByTestId('globe-icon')).toBeInTheDocument()
  })

  it('should have proper aria-label', () => {
    render(<LanguageSwitcher />)

    const button = screen.getByLabelText(/Change language, current: English/)
    expect(button).toBeInTheDocument()
  })

  it('should display current language flag', () => {
    render(<LanguageSwitcher />)

    const flags = screen.getAllByText('🇬🇧')
    expect(flags.length).toBeGreaterThan(0)
  })

  it('should render all language options', () => {
    render(<LanguageSwitcher />)

    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Deutsch')).toBeInTheDocument()
    expect(screen.getByText('Čeština')).toBeInTheDocument()
    expect(screen.getByText('Slovenčina')).toBeInTheDocument()
    expect(screen.getByText('Polski')).toBeInTheDocument()
  })

  it('should render all language flags', () => {
    render(<LanguageSwitcher />)

    expect(screen.getAllByText('🇬🇧')).toHaveLength(2) // One in button, one in menu
    expect(screen.getByText('🇩🇪')).toBeInTheDocument()
    expect(screen.getByText('🇨🇿')).toBeInTheDocument()
    expect(screen.getByText('🇸🇰')).toBeInTheDocument()
    expect(screen.getByText('🇵🇱')).toBeInTheDocument()
  })

  it('should call router.push when language is selected', () => {
    render(<LanguageSwitcher />)

    const germanOption = screen.getByText('Deutsch').closest('button')
    if (germanOption) {
      fireEvent.click(germanOption)
    }

    expect(mockPush).toHaveBeenCalledWith('/de/jobs')
  })

  it('should correctly build path for different languages', () => {
    render(<LanguageSwitcher />)

    // Test Czech
    const czechOption = screen.getByText('Čeština').closest('button')
    if (czechOption) {
      fireEvent.click(czechOption)
    }
    expect(mockPush).toHaveBeenCalledWith('/cs/jobs')

    // Test Slovak
    const slovakOption = screen.getByText('Slovenčina').closest('button')
    if (slovakOption) {
      fireEvent.click(slovakOption)
    }
    expect(mockPush).toHaveBeenCalledWith('/sk/jobs')

    // Test Polish
    const polishOption = screen.getByText('Polski').closest('button')
    if (polishOption) {
      fireEvent.click(polishOption)
    }
    expect(mockPush).toHaveBeenCalledWith('/pl/jobs')
  })

  it('should have 5 language options', () => {
    render(<LanguageSwitcher />)

    const dropdownItems = screen.getAllByTestId('dropdown-item')
    expect(dropdownItems).toHaveLength(5)
  })

  it('should render dropdown content', () => {
    render(<LanguageSwitcher />)

    expect(screen.getByTestId('dropdown-content')).toBeInTheDocument()
  })

  it('should have aria-label for each language option', () => {
    render(<LanguageSwitcher />)

    expect(screen.getByLabelText('Switch to English')).toBeInTheDocument()
    expect(screen.getByLabelText('Switch to Deutsch')).toBeInTheDocument()
    expect(screen.getByLabelText('Switch to Čeština')).toBeInTheDocument()
    expect(screen.getByLabelText('Switch to Slovenčina')).toBeInTheDocument()
    expect(screen.getByLabelText('Switch to Polski')).toBeInTheDocument()
  })

  it('should have menuitem role for language options', () => {
    render(<LanguageSwitcher />)

    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems).toHaveLength(5)
  })
})

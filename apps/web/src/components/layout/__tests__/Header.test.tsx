import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from '../Header'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'nav.home': 'Home',
      'nav.jobs': 'Jobs',
      'nav.forEmployers': 'For Employers',
      'nav.pricing': 'Pricing',
      'nav.login': 'Log In',
      'nav.signup': 'Sign Up',
    }
    return translations[key] || key
  },
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/en',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock LanguageSwitcher
vi.mock('../language-switcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">Language Switcher</div>,
}))

// Mock Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, asChild, ...props }: any) => {
    if (asChild) {
      return <div {...props}>{children}</div>
    }
    return <button {...props}>{children}</button>
  },
}))

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render header with logo', () => {
    render(<Header />)

    const job = screen.getByText('Job')
    const sphere = screen.getByText('Sphere')
    expect(job).toBeInTheDocument()
    expect(sphere).toBeInTheDocument()
  })

  it('should have proper ARIA attributes', () => {
    render(<Header />)

    const header = screen.getByRole('banner')
    expect(header).toHaveAttribute('aria-label', 'Site header')
  })

  it('should render main navigation links', () => {
    render(<Header />)

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Jobs')).toBeInTheDocument()
    expect(screen.getByText('For Employers')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
  })

  it('should render language switcher', () => {
    render(<Header />)

    expect(screen.getByTestId('language-switcher')).toBeInTheDocument()
  })

  it('should render login and signup buttons', () => {
    render(<Header />)

    expect(screen.getByText('Log In')).toBeInTheDocument()
    expect(screen.getByText('Sign Up')).toBeInTheDocument()
  })

  it('should have correct href for navigation links', () => {
    render(<Header />)

    const homeLink = screen.getByText('Home').closest('a')
    expect(homeLink).toHaveAttribute('href', '/en')

    const jobsLink = screen.getByText('Jobs').closest('a')
    expect(jobsLink).toHaveAttribute('href', '/en/jobs')

    const employersLink = screen.getByText('For Employers').closest('a')
    expect(employersLink).toHaveAttribute('href', '/en/for-employers')

    const pricingLink = screen.getByText('Pricing').closest('a')
    expect(pricingLink).toHaveAttribute('href', '/en/pricing')
  })

  it('should have correct href for login button', () => {
    render(<Header />)

    const loginLink = screen.getByText('Log In').closest('a')
    expect(loginLink).toHaveAttribute('href', '/en/login')
  })

  it('should have correct href for signup button', () => {
    render(<Header />)

    const signupLink = screen.getByText('Sign Up').closest('a')
    expect(signupLink).toHaveAttribute('href', '/en/signup')
  })

  it('should have navigation with proper aria-label', () => {
    render(<Header />)

    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(mainNav).toBeInTheDocument()

    const userActions = screen.getByRole('navigation', { name: 'User actions' })
    expect(userActions).toBeInTheDocument()
  })

  it('should render logo with proper aria-label', () => {
    render(<Header />)

    const logoLink = screen.getByLabelText('JobSphere home')
    expect(logoLink).toBeInTheDocument()
    expect(logoLink).toHaveAttribute('href', '/en')
  })

  it('should render login button with aria-label', () => {
    render(<Header />)

    const loginButton = screen.getByLabelText('Log in to your account')
    expect(loginButton).toBeInTheDocument()
  })

  it('should render signup button with aria-label', () => {
    render(<Header />)

    const signupButton = screen.getByLabelText('Create a new account')
    expect(signupButton).toBeInTheDocument()
  })
})

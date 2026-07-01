/**
 * Central inventory of app routes for E2E page coverage.
 *
 * `minRole` = the lowest role that can view the page WITHOUT being redirected.
 * Paths are locale-less (helpers prepend `/en`). Dynamic routes ([id]) are
 * covered by journey specs (they need real seeded ids), not the static smoke loop.
 */

export type Role = 'anon' | 'candidate' | 'employer' | 'admin'

export interface RouteDef {
  /** Path without locale prefix, e.g. '/jobs'. */
  path: string
  area: 'public' | 'auth' | 'dashboard' | 'employer' | 'admin'
  minRole: Role
  /** Include in the visual-regression baseline set. */
  visual?: boolean
}

/** Public marketing / content / discovery pages (anon). */
export const PUBLIC_ROUTES: RouteDef[] = [
  { path: '/', area: 'public', minRole: 'anon', visual: true },
  { path: '/jobs', area: 'public', minRole: 'anon', visual: true },
  { path: '/companies', area: 'public', minRole: 'anon', visual: true },
  { path: '/freelancers', area: 'public', minRole: 'anon' },
  { path: '/freelancer', area: 'public', minRole: 'anon' },
  { path: '/gigs', area: 'public', minRole: 'anon' },
  { path: '/pricing', area: 'public', minRole: 'anon', visual: true },
  { path: '/features', area: 'public', minRole: 'anon' },
  { path: '/for-employers', area: 'public', minRole: 'anon' },
  { path: '/about', area: 'public', minRole: 'anon' },
  { path: '/contact', area: 'public', minRole: 'anon' },
  { path: '/blog', area: 'public', minRole: 'anon' },
  { path: '/career-advice', area: 'public', minRole: 'anon' },
  { path: '/academy', area: 'public', minRole: 'anon' },
  { path: '/api-docs', area: 'public', minRole: 'anon' },
  { path: '/privacy', area: 'public', minRole: 'anon' },
  { path: '/terms', area: 'public', minRole: 'anon' },
  { path: '/gdpr', area: 'public', minRole: 'anon' },
]

/** Auth entry pages (anon). */
export const AUTH_ROUTES: RouteDef[] = [
  { path: '/login', area: 'auth', minRole: 'anon', visual: true },
  { path: '/signup', area: 'auth', minRole: 'anon' },
  { path: '/forgot-password', area: 'auth', minRole: 'anon' },
  { path: '/reset-password', area: 'auth', minRole: 'anon' },
  { path: '/auth/error', area: 'auth', minRole: 'anon' },
]

/** Candidate dashboard (login required). */
export const DASHBOARD_ROUTES: RouteDef[] = [
  { path: '/dashboard', area: 'dashboard', minRole: 'candidate', visual: true },
  { path: '/dashboard/profile', area: 'dashboard', minRole: 'candidate' },
  { path: '/dashboard/saved', area: 'dashboard', minRole: 'candidate' },
  { path: '/dashboard/cv', area: 'dashboard', minRole: 'candidate' },
  { path: '/dashboard/cv/upload', area: 'dashboard', minRole: 'candidate' },
]

/** Employer area (login + orgId required). */
export const EMPLOYER_ROUTES: RouteDef[] = [
  { path: '/employer', area: 'employer', minRole: 'employer', visual: true },
  { path: '/employer/analytics', area: 'employer', minRole: 'employer' },
  { path: '/employer/applicants', area: 'employer', minRole: 'employer' },
  { path: '/employer/calendar', area: 'employer', minRole: 'employer' },
  { path: '/employer/pipeline', area: 'employer', minRole: 'employer', visual: true },
  { path: '/employer/gigs', area: 'employer', minRole: 'employer' },
  { path: '/employer/sequences', area: 'employer', minRole: 'employer' },
  { path: '/employer/settings', area: 'employer', minRole: 'employer' },
  { path: '/employer/settings/team', area: 'employer', minRole: 'employer' },
  { path: '/employer/jobs/new', area: 'employer', minRole: 'employer', visual: true },
  { path: '/employer/assessments/builder', area: 'employer', minRole: 'employer', visual: true },
]

/** Superadmin area (login + isGlobalAdmin required). */
export const ADMIN_ROUTES: RouteDef[] = [
  { path: '/admin', area: 'admin', minRole: 'admin', visual: true },
  { path: '/admin/users', area: 'admin', minRole: 'admin' },
  { path: '/admin/organizations', area: 'admin', minRole: 'admin' },
  { path: '/admin/jobs', area: 'admin', minRole: 'admin' },
  { path: '/admin/subscriptions', area: 'admin', minRole: 'admin' },
  { path: '/admin/settings', area: 'admin', minRole: 'admin' },
]

/** Protected prefixes for the auth-redirect matrix. */
export const PROTECTED_PREFIXES: { path: string; needs: Role }[] = [
  { path: '/dashboard', needs: 'candidate' },
  { path: '/employer', needs: 'employer' },
  { path: '/admin', needs: 'admin' },
]

export const ALL_STATIC_ROUTES: RouteDef[] = [
  ...PUBLIC_ROUTES,
  ...AUTH_ROUTES,
  ...DASHBOARD_ROUTES,
  ...EMPLOYER_ROUTES,
  ...ADMIN_ROUTES,
]

export const VISUAL_ROUTES: RouteDef[] = ALL_STATIC_ROUTES.filter((r) => r.visual)

/** Prepend the locale segment. `/` stays `/en`. */
export function withLocale(path: string, locale = 'en'): string {
  return `/${locale}${path === '/' ? '' : path}`
}

import { describe, it, expect } from 'vitest'
import { deriveActiveContext, isMemberOfOrg, type OrgMembership } from '../auth-context'

const orgs: OrgMembership[] = [
  { orgId: 'org-1', orgName: 'Acme', role: 'ORG_ADMIN' },
  { orgId: 'org-2', orgName: 'Globex', role: 'RECRUITER' },
]

describe('deriveActiveContext', () => {
  it('falls back to the first membership when no activeOrgId is set', () => {
    const ctx = deriveActiveContext(orgs, null)
    expect(ctx.activeOrgId).toBe('org-1')
    expect(ctx.orgId).toBe('org-1')
    expect(ctx.orgName).toBe('Acme')
    expect(ctx.role).toBe('ORG_ADMIN')
  })

  it('honours a valid persisted activeOrgId and re-derives role/orgId/orgName', () => {
    const ctx = deriveActiveContext(orgs, 'org-2')
    expect(ctx.activeOrgId).toBe('org-2')
    expect(ctx.orgId).toBe('org-2')
    expect(ctx.orgName).toBe('Globex')
    expect(ctx.role).toBe('RECRUITER')
  })

  it('ignores a foreign/stale activeOrgId and falls back to the first org (switch-authz)', () => {
    const ctx = deriveActiveContext(orgs, 'org-999')
    expect(ctx.activeOrgId).toBe('org-1')
    expect(ctx.role).toBe('ORG_ADMIN')
  })

  it('returns the candidate default when the user belongs to no org', () => {
    const ctx = deriveActiveContext([], 'org-1')
    expect(ctx.activeOrgId).toBeNull()
    expect(ctx.orgId).toBeNull()
    expect(ctx.orgName).toBeNull()
    expect(ctx.role).toBe('candidate')
  })

  it('keeps backward compat for a single-org user (active == first)', () => {
    const single: OrgMembership[] = [{ orgId: 'org-x', orgName: 'Solo', role: 'HIRING_MANAGER' }]
    const ctx = deriveActiveContext(single, null)
    expect(ctx.orgId).toBe('org-x')
    expect(ctx.role).toBe('HIRING_MANAGER')
  })
})

describe('isMemberOfOrg (switch-authz guard)', () => {
  it('accepts an org the user is a member of', () => {
    expect(isMemberOfOrg(orgs, 'org-2')).toBe(true)
  })

  it('rejects a foreign org id', () => {
    expect(isMemberOfOrg(orgs, 'org-999')).toBe(false)
  })

  it('rejects non-string / empty inputs', () => {
    expect(isMemberOfOrg(orgs, null)).toBe(false)
    expect(isMemberOfOrg(orgs, undefined)).toBe(false)
    expect(isMemberOfOrg(orgs, 123)).toBe(false)
    expect(isMemberOfOrg([], 'org-1')).toBe(false)
  })
})

/**
 * Simulates the jwt() update-branch switch logic end-to-end against the pure
 * helpers: a valid switch re-derives, a foreign switch is a no-op.
 */
describe('context switch (jwt update branch semantics)', () => {
  function applySwitch(
    token: {
      orgs: OrgMembership[]
      activeOrgId: string | null
      role: string
      orgId: string | null
    },
    requested: unknown,
  ) {
    if (isMemberOfOrg(token.orgs, requested)) {
      const ctx = deriveActiveContext(token.orgs, requested as string)
      token.activeOrgId = ctx.activeOrgId
      token.role = ctx.role
      token.orgId = ctx.orgId
    }
    return token
  }

  it('switches to a valid org and re-derives role/orgId', () => {
    const token = { orgs, activeOrgId: 'org-1', role: 'ORG_ADMIN', orgId: 'org-1' }
    applySwitch(token, 'org-2')
    expect(token.activeOrgId).toBe('org-2')
    expect(token.role).toBe('RECRUITER')
    expect(token.orgId).toBe('org-2')
  })

  it('ignores a foreign orgId (no switch, no privilege leak)', () => {
    const token = { orgs, activeOrgId: 'org-1', role: 'ORG_ADMIN', orgId: 'org-1' }
    applySwitch(token, 'org-attacker')
    expect(token.activeOrgId).toBe('org-1')
    expect(token.role).toBe('ORG_ADMIN')
    expect(token.orgId).toBe('org-1')
  })
})

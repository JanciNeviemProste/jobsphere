/**
 * Dual-role active-context derivation (PR7).
 *
 * A JobSphere user can simultaneously be a company member (of one or more orgs)
 * AND a candidate/freelancer. The JWT carries the full list of memberships
 * (`orgs`) plus the currently active org (`activeOrgId`). From that we derive the
 * *flat* `role` / `orgId` / `orgName` fields.
 *
 * Backward compatibility: those flat fields mirror the ACTIVE org, so the ~40
 * existing "take the first org" call-sites that read `session.user.orgId` /
 * `session.user.role` keep working unchanged. For a single-org user the active
 * org is the first (and only) one, i.e. identical to the previous behaviour.
 *
 * This logic is a pure function on purpose so it can be unit-tested without
 * standing up NextAuth or Prisma.
 */

export interface OrgMembership {
  orgId: string
  orgName: string | null
  role: string
}

export interface ActiveContext {
  /** The org that is active for this session (null when the user has no orgs). */
  activeOrgId: string | null
  /** Role in the active org, or 'candidate' when the user belongs to no org. */
  role: string
  /** Mirrors activeOrgId — kept as `orgId` for legacy `session.user.orgId` readers. */
  orgId: string | null
  /** Name of the active org, or null. */
  orgName: string | null
}

/**
 * Resolve the active-org context.
 *
 * The requested `activeOrgId` is honoured ONLY when it names an org the user is
 * actually a member of (switch-authz: never let a session point at a foreign
 * org). Anything else — a stale id from a revoked membership, a null, or an
 * outright forged id — falls back to the first membership.
 */
export function deriveActiveContext(
  orgs: OrgMembership[],
  requestedActiveOrgId: string | null | undefined,
): ActiveContext {
  const isMember = !!requestedActiveOrgId && orgs.some((o) => o.orgId === requestedActiveOrgId)
  const activeOrgId = (isMember ? requestedActiveOrgId : orgs[0]?.orgId) ?? null
  const active = orgs.find((o) => o.orgId === activeOrgId)

  return {
    activeOrgId,
    role: active?.role ?? 'candidate',
    orgId: active?.orgId ?? null,
    orgName: active?.orgName ?? null,
  }
}

/**
 * Switch-authz guard for the `useSession().update({ activeOrgId })` flow.
 * Returns true only when the requested org is a real membership, so the jwt
 * callback can safely re-derive + persist. A foreign/unknown id returns false
 * and the caller must ignore the switch entirely.
 */
export function isMemberOfOrg(orgs: OrgMembership[], requestedActiveOrgId: unknown): boolean {
  return (
    typeof requestedActiveOrgId === 'string' && orgs.some((o) => o.orgId === requestedActiveOrgId)
  )
}

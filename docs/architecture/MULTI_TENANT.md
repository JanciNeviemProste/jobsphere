# Multi-Tenant Architecture

## Overview

JobSphere is built as a **multi-tenant SaaS application** where multiple organizations (companies/employers) share the same application infrastructure while maintaining complete data isolation. Each organization has its own workspace with separate jobs, candidates, assessments, and team members.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
│  (Next.js App - Shared Infrastructure)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              Authentication & Authorization                 │
│                    (NextAuth v5)                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Session: { userId, email, role }                    │  │
│  │  Middleware: Extract user → Verify org membership    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                Data Isolation Layer                         │
│  (Prisma ORM with Organization Scoping)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  All queries filtered by: orgId                      │  │
│  │  Example: WHERE orgId = session.user.orgId           │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ↓            ↓            ↓
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Org A Data  │ │ Org B Data  │ │ Org C Data  │
│             │ │             │ │             │
│ • Jobs      │ │ • Jobs      │ │ • Jobs      │
│ • Candidates│ │ • Candidates│ │ • Candidates│
│ • Apps      │ │ • Apps      │ │ • Apps      │
│ • Team      │ │ • Team      │ │ • Team      │
└─────────────┘ └─────────────┘ └─────────────┘
```

## Database Schema

### Core Multi-Tenant Models

#### Organization Model

```prisma
model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  domain      String?  @unique
  logo        String?
  website     String?
  description String?

  // Multi-tenant relationships
  jobs            Job[]
  candidates      Candidate[]
  applications    Application[]
  assessments     Assessment[]
  emailSequences  EmailSequence[]
  members         UserOrgRole[]

  // Subscription & billing
  subscription    Subscription?
  stripeCustomerId String? @unique

  // Audit fields
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([slug])
  @@index([domain])
}
```

**Key Points:**

- `slug`: URL-friendly identifier (e.g., `tech-corp`)
- `domain`: Custom domain for SSO (e.g., `techcorp.com`)
- All tenant-scoped data references `orgId`

---

#### UserOrgRole Junction Table

**Purpose:** Connect users to organizations with specific roles

```prisma
model UserOrgRole {
  id        String   @id @default(cuid())
  userId    String
  orgId     String
  role      OrgRole

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, orgId])
  @@index([userId])
  @@index([orgId])
  @@index([orgId, role])
}

enum OrgRole {
  ORG_ADMIN        // Full access to org settings, billing, team management
  RECRUITER        // Manage jobs, candidates, applications
  HIRING_MANAGER   // View applications, leave feedback
  AGENCY           // External recruiter with limited access
}
```

**Design Rationale:**

- **Many-to-many relationship**: Users can belong to multiple organizations
- **Role-based access**: Different permissions per organization
- **Unique constraint**: User can only have one role per organization
- **Cascade delete**: Remove membership when user or org is deleted

---

#### Example: Job Model (Tenant-Scoped)

```prisma
model Job {
  id              String      @id @default(cuid())
  orgId           String      // ← Tenant identifier

  title           String
  description     String
  location        String?
  remote          WorkMode    @default(hybrid)
  type            JobType     @default(fullTime)
  seniority       Seniority   @default(mid)
  salaryMin       Int?
  salaryMax       Int?
  status          JobStatus   @default(draft)

  // Relationships
  organization    Organization  @relation(fields: [orgId], references: [id], onDelete: Cascade)
  applications    Application[]

  // Audit
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([orgId])
  @@index([orgId, status])
  @@index([status])
}
```

**Critical:** Every tenant-scoped model has `orgId` field with index

---

## Data Isolation Patterns

### Pattern 1: Query-Level Scoping (Recommended)

**Always include `orgId` filter in Prisma queries:**

```typescript
// ✅ CORRECT - Scoped to organization
const jobs = await prisma.job.findMany({
  where: {
    orgId: session.user.orgId,
    status: 'PUBLISHED',
  },
})

// ❌ WRONG - No org scoping (security vulnerability!)
const jobs = await prisma.job.findMany({
  where: {
    status: 'PUBLISHED',
  },
})
```

### Pattern 2: Middleware Enforcement

**Automatically inject `orgId` into all queries:**

```typescript
// apps/web/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { auth } from '@/lib/auth'

const prisma = new PrismaClient()

// Middleware to enforce organization scoping
prisma.$use(async (params, next) => {
  // Only apply to tenant-scoped models
  const scopedModels = ['Job', 'Candidate', 'Application', 'Assessment', 'EmailSequence']

  if (scopedModels.includes(params.model)) {
    const session = await auth()

    if (!session?.user?.orgId) {
      throw new Error('No organization context')
    }

    // Inject orgId into WHERE clause
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = {
        ...params.args.where,
        orgId: session.user.orgId,
      }
    }

    // Inject orgId into CREATE/UPDATE data
    if (params.action === 'create') {
      params.args.data = {
        ...params.args.data,
        orgId: session.user.orgId,
      }
    }
  }

  return next(params)
})

export { prisma }
```

**Benefits:**

- Prevents accidental cross-tenant data leaks
- Reduces boilerplate in API routes
- Centralized security enforcement

**Drawbacks:**

- Can cause confusion if orgId is needed explicitly
- Debugging is harder (implicit filters)

**Recommendation:** Use middleware for critical production apps, but keep explicit filters in development for clarity.

---

### Pattern 3: Row-Level Security (RLS)

**PostgreSQL-native data isolation:**

```sql
-- Enable RLS on tenant-scoped tables
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see jobs from their organization
CREATE POLICY org_isolation_policy ON "Job"
  USING (orgId = current_setting('app.current_org_id')::text);

-- Set org context in application
SET app.current_org_id = 'org_abc123';
```

**Usage in Prisma:**

```typescript
// Set organization context before queries
await prisma.$executeRaw`SET app.current_org_id = ${session.user.orgId}`

// Now all queries are automatically scoped
const jobs = await prisma.job.findMany() // Only returns jobs for current org
```

**Benefits:**

- Database-level enforcement (can't be bypassed)
- Works with any client (not just Prisma)
- Additional security layer

**Drawbacks:**

- More complex setup
- Requires PostgreSQL 9.5+
- Connection pooling complications

---

## Authorization Patterns

### Role-Based Access Control (RBAC)

**Role Hierarchy:**

```
ORG_ADMIN (Full Access)
  ├── Can manage team members
  ├── Can change organization settings
  ├── Can view billing and subscription
  ├── All RECRUITER permissions
  │
  ├─→ RECRUITER (Job Management)
  │     ├── Can create/edit/delete jobs
  │     ├── Can view all applications
  │     ├── Can search candidates
  │     ├── Can send assessments
  │     ├── Can create email sequences
  │     │
  │     ├─→ HIRING_MANAGER (Read-Only + Feedback)
  │     │     ├── Can view applications for specific jobs
  │     │     ├── Can leave feedback/notes
  │     │     ├── Cannot create jobs
  │     │     │
  │     │     └─→ AGENCY (External Recruiter)
  │     │           ├── Limited candidate access
  │     │           ├── Cannot view other recruiters' data
  │     │           ├── Commission-based access
```

### Permission Check Helper

```typescript
// apps/web/src/lib/permissions.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function requireRole(
  minRole: 'ORG_ADMIN' | 'RECRUITER' | 'HIRING_MANAGER' | 'AGENCY',
): Promise<{ userId: string; orgId: string; role: string }> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new UnauthorizedError('Not authenticated')
  }

  // Get user's role in organization
  const membership = await prisma.userOrgRole.findFirst({
    where: {
      userId: session.user.id,
      // orgId determined from session or context
    },
  })

  if (!membership) {
    throw new ForbiddenError('Not a member of this organization')
  }

  const roleHierarchy = {
    ORG_ADMIN: 4,
    RECRUITER: 3,
    HIRING_MANAGER: 2,
    AGENCY: 1,
  }

  if (roleHierarchy[membership.role] < roleHierarchy[minRole]) {
    throw new ForbiddenError(`Requires ${minRole} role or higher`)
  }

  return {
    userId: session.user.id,
    orgId: membership.orgId,
    role: membership.role,
  }
}
```

**Usage in API routes:**

```typescript
// apps/web/src/app/api/jobs/route.ts
export async function POST(req: Request) {
  // Require RECRUITER role or higher
  const { userId, orgId } = await requireRole('RECRUITER')

  const data = await req.json()

  const job = await prisma.job.create({
    data: {
      ...data,
      orgId, // Automatically use user's organization
      createdBy: userId,
    },
  })

  return NextResponse.json({ job })
}
```

---

### Resource-Level Authorization

**Verify user can access specific resource:**

```typescript
// apps/web/src/lib/authorization.ts
export async function canAccessJob(userId: string, jobId: string): Promise<boolean> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { orgId: true },
  })

  if (!job) return false

  const membership = await prisma.userOrgRole.findFirst({
    where: {
      userId,
      orgId: job.orgId,
    },
  })

  return !!membership
}

// Usage
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()

  if (!(await canAccessJob(session.user.id, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const job = await prisma.job.findUnique({
    where: { id: params.id },
  })

  return NextResponse.json({ job })
}
```

---

## Organization Onboarding Flow

### New User Signup

```
┌─────────────────────────────────────────┐
│  1. User signs up                       │
│     POST /api/auth/signup               │
│     { email, password, name }           │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  2. Create User record                  │
│     prisma.user.create()                │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  3. Create Organization                 │
│     prisma.organization.create({        │
│       name: "New Org",                  │
│       slug: generateSlug(name)          │
│     })                                  │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  4. Create UserOrgRole                  │
│     prisma.userOrgRole.create({         │
│       userId,                           │
│       orgId,                            │
│       role: 'ORG_ADMIN'                 │
│     })                                  │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  5. Set session with orgId              │
│     session.user.orgId = orgId          │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  6. Redirect to onboarding              │
│     /onboarding                         │
└─────────────────────────────────────────┘
```

### Implementation

```typescript
// apps/web/src/app/api/auth/signup/route.ts
export async function POST(req: Request) {
  const { email, password, name, companyName } = await req.json()

  // 1. Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: await hashPassword(password),
      name,
    },
  })

  // 2. Create organization
  const slug = generateSlug(companyName)
  const org = await prisma.organization.create({
    data: {
      name: companyName,
      slug,
    },
  })

  // 3. Create admin membership
  await prisma.userOrgRole.create({
    data: {
      userId: user.id,
      orgId: org.id,
      role: 'ORG_ADMIN',
    },
  })

  // 4. Create session with org context
  const session = await signIn('credentials', {
    email,
    password,
    redirect: false,
  })

  // Add orgId to session
  session.user.orgId = org.id

  return NextResponse.json({
    user,
    org,
    redirectTo: '/onboarding',
  })
}
```

---

## Team Management

### Invite Team Member

**Endpoint:** `POST /api/organizations/current/members`

**Flow:**

```
┌─────────────────────────────────────────┐
│  1. Admin invites user                  │
│     POST /api/.../members               │
│     { email: "new@example.com",         │
│       role: "RECRUITER" }               │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  2. Check if user exists                │
│     prisma.user.findUnique()            │
└────────────────┬────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
         ↓               ↓
    ┌─────────┐    ┌──────────┐
    │ Exists  │    │ New User │
    └────┬────┘    └─────┬────┘
         │               │
         │               ↓
         │         ┌─────────────────────┐
         │         │ 3a. Send invite     │
         │         │     email with      │
         │         │     signup link     │
         │         └─────────────────────┘
         │
         ↓
┌─────────────────────────────────────────┐
│  3b. Create UserOrgRole                 │
│      (if user exists)                   │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│  4. Send notification email             │
│     "You've been added to [Org]"        │
└─────────────────────────────────────────┘
```

**Implementation:**

```typescript
// apps/web/src/app/api/organizations/current/members/route.ts
export async function POST(req: Request) {
  const { orgId } = await requireRole('ORG_ADMIN')
  const { email, role } = await req.json()

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (user) {
    // User exists - add to org directly
    await prisma.userOrgRole.create({
      data: {
        userId: user.id,
        orgId,
        role,
      },
    })

    // Send notification email
    await sendEmail({
      to: email,
      template: 'team-invite',
      data: { orgName, role },
    })
  } else {
    // User doesn't exist - send signup invite
    const token = generateInviteToken(email, orgId, role)

    await sendEmail({
      to: email,
      template: 'signup-invite',
      data: {
        inviteLink: `${BASE_URL}/signup?token=${token}`,
        orgName,
        role,
      },
    })
  }

  return NextResponse.json({ success: true })
}
```

---

### Change Member Role

**Endpoint:** `PATCH /api/organizations/current/members/{userId}`

**Authorization:**

- Only ORG_ADMIN can change roles
- Cannot change own role (prevent lockout)
- Cannot change role if only admin (prevent lockout)

```typescript
export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
  const { userId: currentUserId, orgId } = await requireRole('ORG_ADMIN')
  const { role: newRole } = await req.json()

  // Prevent self-role-change
  if (params.userId === currentUserId) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
  }

  // Check if last admin
  const adminCount = await prisma.userOrgRole.count({
    where: { orgId, role: 'ORG_ADMIN' },
  })

  const targetMember = await prisma.userOrgRole.findUnique({
    where: {
      userId_orgId: {
        userId: params.userId,
        orgId,
      },
    },
  })

  if (targetMember.role === 'ORG_ADMIN' && adminCount === 1) {
    return NextResponse.json({ error: 'Cannot remove last admin' }, { status: 400 })
  }

  // Update role
  await prisma.userOrgRole.update({
    where: {
      userId_orgId: {
        userId: params.userId,
        orgId,
      },
    },
    data: { role: newRole },
  })

  return NextResponse.json({ success: true })
}
```

---

### Remove Member

**Endpoint:** `DELETE /api/organizations/current/members/{userId}`

**Authorization:**

- Only ORG_ADMIN can remove members
- Cannot remove self (use leave org endpoint instead)
- Cannot remove last admin

```typescript
export async function DELETE(req: Request, { params }: { params: { userId: string } }) {
  const { userId: currentUserId, orgId } = await requireRole('ORG_ADMIN')

  // Prevent self-removal
  if (params.userId === currentUserId) {
    return NextResponse.json(
      { error: 'Cannot remove yourself. Use "Leave Organization" instead.' },
      { status: 400 },
    )
  }

  // Check if last admin
  const member = await prisma.userOrgRole.findUnique({
    where: {
      userId_orgId: {
        userId: params.userId,
        orgId,
      },
    },
  })

  if (member.role === 'ORG_ADMIN') {
    const adminCount = await prisma.userOrgRole.count({
      where: { orgId, role: 'ORG_ADMIN' },
    })

    if (adminCount === 1) {
      return NextResponse.json({ error: 'Cannot remove last admin' }, { status: 400 })
    }
  }

  // Remove membership
  await prisma.userOrgRole.delete({
    where: {
      userId_orgId: {
        userId: params.userId,
        orgId,
      },
    },
  })

  return NextResponse.json({ success: true })
}
```

---

## Organization Switching

### User with Multiple Organizations

**Session structure:**

```typescript
interface Session {
  user: {
    id: string
    email: string
    name: string
    currentOrgId: string // Active organization
    organizations: Array<{
      orgId: string
      orgName: string
      role: string
    }>
  }
}
```

### Switch Organization Endpoint

**Endpoint:** `POST /api/user/switch-org`

```typescript
export async function POST(req: Request) {
  const session = await auth()
  const { orgId } = await req.json()

  // Verify user is member of target org
  const membership = await prisma.userOrgRole.findUnique({
    where: {
      userId_orgId: {
        userId: session.user.id,
        orgId,
      },
    },
    include: {
      org: true,
    },
  })

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })
  }

  // Update session with new orgId
  session.user.currentOrgId = orgId
  session.user.currentOrgName = membership.org.name
  session.user.currentRole = membership.role

  await updateSession(session)

  return NextResponse.json({
    success: true,
    org: membership.org,
  })
}
```

### UI Component

```typescript
// apps/web/src/components/nav/OrgSwitcher.tsx
export function OrgSwitcher() {
  const { data: session } = useSession()
  const [switchOrg] = useMutation('/api/user/switch-org')

  return (
    <Select
      value={session.user.currentOrgId}
      onValueChange={async (orgId) => {
        await switchOrg({ orgId })
        router.refresh() // Reload page with new org context
      }}
    >
      {session.user.organizations.map(org => (
        <SelectItem key={org.orgId} value={org.orgId}>
          {org.orgName} ({org.role})
        </SelectItem>
      ))}
    </Select>
  )
}
```

---

## Data Migration Between Organizations

### Use Case: Agency Transferring Candidate

**Scenario:** Agency recruited candidate for Company A, now wants to transfer to Company B

**Challenge:** Candidate data is scoped to Agency's organization, Company B can't see it

**Solution: Data Transfer API**

```typescript
// POST /api/candidates/{id}/transfer
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await requireRole('ORG_ADMIN')
  const { targetOrgId } = await req.json()

  // Verify source candidate belongs to current org
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id, orgId },
    include: { resumes: true },
  })

  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  // Verify target org exists and user has permission
  const targetMembership = await prisma.userOrgRole.findFirst({
    where: { userId, orgId: targetOrgId, role: 'ORG_ADMIN' },
  })

  if (!targetMembership) {
    return NextResponse.json({ error: 'No permission on target org' }, { status: 403 })
  }

  // Create copy in target org (not move - keep history)
  const newCandidate = await prisma.candidate.create({
    data: {
      orgId: targetOrgId,
      email: candidate.email,
      cvEmbedding: candidate.cvEmbedding,
      resumes: {
        create: candidate.resumes.map((resume) => ({
          parsedText: resume.parsedText,
          isPrimary: resume.isPrimary,
        })),
      },
    },
  })

  // Log transfer for audit
  await prisma.auditLog.create({
    data: {
      action: 'CANDIDATE_TRANSFER',
      userId,
      sourceOrgId: orgId,
      targetOrgId,
      resourceId: candidate.id,
      metadata: { newCandidateId: newCandidate.id },
    },
  })

  return NextResponse.json({ newCandidateId: newCandidate.id })
}
```

---

## Best Practices

### 1. Always Scope Queries

```typescript
// ✅ GOOD
const jobs = await prisma.job.findMany({
  where: { orgId: session.user.orgId },
})

// ❌ BAD
const jobs = await prisma.job.findMany()
```

### 2. Use TypeScript for Role Checks

```typescript
type RequiredRole = 'ORG_ADMIN' | 'RECRUITER'

function checkPermission(userRole: string, requiredRole: RequiredRole) {
  // TypeScript ensures only valid roles are passed
}
```

### 3. Audit Trail

```typescript
// Log all sensitive operations
await prisma.auditLog.create({
  data: {
    action: 'DELETE_CANDIDATE',
    userId: session.user.id,
    orgId: session.user.orgId,
    resourceId: candidateId,
    timestamp: new Date(),
  },
})
```

### 4. Prevent Enumeration Attacks

```typescript
// ❌ BAD - Reveals if candidate exists in DB
const candidate = await prisma.candidate.findUnique({
  where: { id: candidateId },
})

if (!candidate) {
  return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
}

if (candidate.orgId !== session.user.orgId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ✅ GOOD - Returns same error for both cases
const candidate = await prisma.candidate.findFirst({
  where: {
    id: candidateId,
    orgId: session.user.orgId,
  },
})

if (!candidate) {
  return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
}
```

---

## Testing Multi-Tenancy

### Unit Tests

```typescript
// tests/unit/organization.test.ts
describe('Organization Scoping', () => {
  it('should only return jobs from user organization', async () => {
    const org1 = await createOrg('Org 1')
    const org2 = await createOrg('Org 2')

    await createJob({ orgId: org1.id, title: 'Job 1' })
    await createJob({ orgId: org2.id, title: 'Job 2' })

    const user = await createUser({ orgId: org1.id })
    const session = await loginAs(user)

    const response = await fetch('/api/jobs', {
      headers: { Cookie: session.cookie },
    })

    const { jobs } = await response.json()

    expect(jobs).toHaveLength(1)
    expect(jobs[0].title).toBe('Job 1')
  })
})
```

### E2E Tests

```typescript
// tests/e2e/multi-tenant.spec.ts
test('User cannot access other organization data', async ({ page }) => {
  // Create two orgs with separate data
  const org1 = await setupOrg('Tech Corp')
  const org2 = await setupOrg('Design Studio')

  // Login as Org 1 user
  await loginAs(page, org1.adminUser)

  // Try to access Org 2 job (should fail)
  await page.goto(`/jobs/${org2.job.id}`)

  await expect(page.locator('text=Not found')).toBeVisible()
})
```

---

## Troubleshooting

### Common Issues

**Issue:** User sees data from wrong organization

**Cause:** Session `orgId` not set correctly

**Solution:** Verify session structure and middleware logic

---

**Issue:** "Unique constraint violation" on UserOrgRole

**Cause:** Trying to add user to org twice

**Solution:** Use `upsert` instead of `create`:

```typescript
await prisma.userOrgRole.upsert({
  where: {
    userId_orgId: { userId, orgId },
  },
  update: { role },
  create: { userId, orgId, role },
})
```

---

**Issue:** Last admin removed, org locked

**Cause:** No validation before removing admin

**Solution:** Always check admin count before removal (see Remove Member section)

---

## Security Considerations

1. **Never trust client-provided orgId** - Always get from session
2. **Validate org membership** on every protected route
3. **Use database transactions** for multi-step operations
4. **Log all role changes** for audit trail
5. **Implement rate limiting** on team invite endpoints
6. **Encrypt sensitive org data** at rest

---

## References

- **Multi-Tenancy Patterns**: [AWS SaaS Architecture](https://aws.amazon.com/partners/saas-factory/)
- **RBAC Design**: [NIST RBAC Model](https://csrc.nist.gov/projects/role-based-access-control)
- **Prisma Multi-Tenancy**: [Prisma Docs](https://www.prisma.io/docs/guides/deployment/multi-tenant)

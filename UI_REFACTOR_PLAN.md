# 🎨 UI Refactoring Plan: Schema Alignment

**Status:** Ready to Execute
**Estimated Time:** 3-4 hours
**Impact:** +4% (94% → 98%)
**Prerequisite:** Database migration completed

---

## 🎯 Objective

Update all UI code (pages, API routes, services, workers) to match the updated Prisma schema. Remove temporary TypeScript excludes to achieve 100% type coverage.

---

## 📊 Scope

**Total Files:** 38
- **Employer Pages:** 4 files
- **API Routes:** 21 files
- **Services:** 7 files
- **Workers:** 4 files
- **Libraries:** 2 files

---

## 🔍 Common Issues & Fixes

### Issue 1: Model Names
```typescript
// ❌ OLD (doesn't exist)
prisma.userOrgRole.findFirst()

// ✅ NEW
prisma.orgMember.findFirst()
```

### Issue 2: Field Names
```typescript
// ❌ OLD
application.stage          // doesn't exist
application.activities     // doesn't exist
user.contacts              // doesn't exist
job.city, job.region       // don't exist
job.remote, job.hybrid     // don't exist
job.employmentType         // doesn't exist

// ✅ NEW
application.status         // PENDING, REVIEWING, INTERVIEWED, ACCEPTED, REJECTED
application.events         // ApplicationEvent[]
user.email, user.name, user.phone  // direct fields
job.location               // single string field
job.workMode               // REMOTE, HYBRID, ONSITE
job.type                   // FULL_TIME, PART_TIME, CONTRACT
```

### Issue 3: Missing Includes
```typescript
// ❌ OLD (will cause errors)
const application = await prisma.application.findFirst({
  where: { id }
})
// application.job is undefined!
// application.candidate is undefined!

// ✅ NEW (with includes)
const application = await prisma.application.findFirst({
  where: { id },
  include: {
    job: {
      include: { organization: true }
    },
    candidate: true,  // User with email, name, phone
    events: {         // was 'activities'
      orderBy: { createdAt: 'asc' }
    }
  }
})
```

---

## 📋 File-by-File Refactoring Guide

### **Employer Pages** (4 files)

#### 1. `src/app/[locale]/employer/applicants/[id]/page.tsx`
**Errors:** 28 TypeScript errors

**Changes needed:**
```typescript
// Line 13: Fix model name
- const userOrgRole = await prisma.userOrgRole.findFirst
+ const orgMember = await prisma.orgMember.findFirst({
+   where: { userId }
+ })

// Line 26: Fix reference
- orgId: userOrgRole.orgId,
+ orgId: orgMember.orgId,

// Line 36-42: Remove invalid includes
- candidate: {
-   include: {
-     contacts: { where: { isPrimary: true }, take: 1 }
-   }
- },
+ candidate: true,

// Line 43: Rename activities -> events
- activities: {
+ events: {
    orderBy: { createdAt: 'asc' }
  }

// Line 71-78: Update status badge function
function getStatusBadge(status: string) {
  switch (status) {
-   case 'NEW': return <Badge variant="secondary">Nová prihláška</Badge>
-   case 'SCREENING': return <Badge variant="default">Screening</Badge>
-   case 'PHONE': return <Badge variant="default">Telefonát</Badge>
+   case 'PENDING': return <Badge variant="secondary">Čaká</Badge>
+   case 'REVIEWING': return <Badge variant="default">V procese</Badge>
+   case 'INTERVIEWED': return <Badge variant="default">Interview</Badge>
+   case 'ACCEPTED': return <Badge variant="success">Prijatý</Badge>
+   case 'REJECTED': return <Badge variant="destructive">Zamietnutý</Badge>
    default: return <Badge>{status}</Badge>
  }
}

// Line 109: Fix property
- {getStatusBadge(application.stage)}
+ {getStatusBadge(application.status)}

// Line 116: Fix job location
- {application.job.city}{application.job.region && `, ${application.job.region}`}
+ {application.job.location}

// Line 129: Fix work mode
- {application.job.remote ? 'Remote' : application.job.hybrid ? 'Hybrid' : 'On-site'}
+ {application.job.workMode}

// Line 134: Fix employment type
- {application.job.employmentType}
+ {application.job.type}

// Line 162: Fix activities -> events
- {application.activities.map((event) => (
+ {application.events.map((event) => (

// Line 166: Fix length check
- {index !== application.activities.length - 1 && (
+ {index !== application.events.length - 1 && (

// Line 171: Fix event type display
  <p className="font-medium">{event.type}</p>
- <p className="text-sm text-muted-foreground">{event.description}</p>
+ <p className="text-sm text-muted-foreground">{event.title}</p>

// Line 194: Fix candidate contact
- {application.candidate.contacts?.[0]?.fullName || 'Bez mena'}
+ {application.candidate.name || application.candidate.email}

// Line 197-205: Fix email
- {application.candidate.contacts?.[0]?.email && (
+ {application.candidate.email && (
    <Mail className="h-4 w-4" />
-   <a href={`mailto:${application.candidate.contacts[0].email}`}>
-     {application.candidate.contacts[0].email}
+   <a href={`mailto:${application.candidate.email}`}>
+     {application.candidate.email}
    </a>
  )}

// Line 208-216: Fix phone
- {application.candidate.contacts?.[0]?.phone && (
+ {application.candidate.phone && (
    <Phone className="h-4 w-4" />
-   <a href={`tel:${application.candidate.contacts[0].phone}`}>
-     {application.candidate.contacts[0].phone}
+   <a href={`tel:${application.candidate.phone}`}>
+     {application.candidate.phone}
    </a>
  )}

// Line 232-250: Fix action buttons
- {application.stage === 'NEW' && (
+ {application.status === 'PENDING' && (
    <Button>Začať screening</Button>
  )}
- {application.stage === 'SCREENING' && (
+ {application.status === 'REVIEWING' && (
    <Button>Naplánovať Interview</Button>
  )}
- {application.stage === 'PHONE' && (
+ {application.status === 'INTERVIEWED' && (
    <>
      <Button className="bg-green-600">Prijať kandidáta</Button>
      <Button variant="destructive">Zamietnuť</Button>
    </>
  )}
```

#### 2. `src/app/[locale]/employer/applicants/page.tsx`
**Errors:** 8 TypeScript errors

**Similar fixes as above:**
- Line 12: `userOrgRole` → `orgMember`
- Line 35: Remove `contacts` include
- Line 67-69: `application.stage` → `application.status`
- Line 153, 163, 165: `candidate.contacts[0]` → direct `candidate` properties
- Line 169: `application.job` needs include
- Line 175: `application.stage` → `application.status`

#### 3. `src/app/[locale]/employer/page.tsx`
**Errors:** 6 TypeScript errors

**Similar fixes:**
- Line 12: `userOrgRole` → `orgMember`
- Line 52: Remove `contacts` include
- Line 115: `application.stage` → `application.status`
- Line 285-286: `candidate.contacts` → direct properties
- Line 288: Missing `job` include

#### 4. `src/app/[locale]/employer/settings/page.tsx`
**Errors:** 2 TypeScript errors

**Fix:**
- Line 14: `prisma.userOrgRole` → `prisma.orgMember`

---

### **API Routes** (21 files)

#### Common Pattern for ALL API Routes:

**1. Fix orgMember references:**
```typescript
// ❌ OLD
const userOrgRole = await prisma.userOrgRole.findFirst({ ... })

// ✅ NEW
const orgMember = await prisma.orgMember.findFirst({ ... })
```

**2. Add missing includes:**
```typescript
const application = await prisma.application.findFirst({
  where: { id },
  include: {
    job: true,
    candidate: true,
    events: true
  }
})
```

**3. Fix Stripe field names:**
```typescript
// In checkout/portal/webhook routes
// ❌ OLD
orgCustomer.providerCustomerId

// ✅ NEW
orgCustomer.stripeCustomerId
```

**4. Fix Email OAuth:**
```typescript
// In email/oauth routes
// ❌ OLD
emailAccount.name
emailAccount.oauthJson

// ✅ NEW
emailAccount.displayName
emailAccount.oauthTokens
```

**5. Fix GDPR routes:**
```typescript
// ❌ OLD
user.organizations
user.avatar

// ✅ NEW
user.orgMembers (with include: { organization: true })
user.image
```

#### Files to fix:
1. `src/app/api/applications/[id]/route.ts` - 6 errors
2. `src/app/api/applications/route.ts` - 8 errors
3. `src/app/api/assessments/[id]/submit/route.ts` - 2 errors
4. `src/app/api/cv/parse/route.ts` - 2 errors
5. `src/app/api/email/oauth/gmail/callback/route.ts` - 3 errors
6. `src/app/api/email/oauth/gmail/route.ts` - 3 errors
7. `src/app/api/email/oauth/microsoft/callback/route.ts` - 3 errors
8. `src/app/api/email/oauth/microsoft/route.ts` - 3 errors
9. `src/app/api/gdpr/dsar/route.ts` - 2 errors
10. `src/app/api/gdpr/export/route.ts` - 6 errors
11. `src/app/api/stripe/checkout/route.ts` - 4 errors
12. `src/app/api/stripe/portal/route.ts` - 2 errors
13. `src/app/api/stripe/webhook/route.ts` - 6 errors

*Other 8 API routes have minor/no errors*

---

### **Services** (7 files)

#### Files in `src/services/`:
1. **application.service.ts** - Model/field mismatches
2. **user.service.ts** - VerificationToken usage
3. **job.service.ts** - Location filter
4. **email.service.ts** - Check for issues
5. **assessment.service.ts** - Check for issues
6. **stripe.service.ts** - Check for issues
7. **gdpr.service.ts** - Check for issues

**Common fixes:**
- Update `organizationId` → `orgId` (if any remain)
- Fix includes for relations
- Update field references

---

### **Workers** (4 files)

#### Files in `src/workers/`:
1. **assessment-grading.worker.ts**
2. **email-sequence.worker.ts**
3. **embedding-generation.worker.ts**
4. **index.ts** (master)

**Likely issues:**
- `organizationId` references
- Missing includes in queries
- Field name mismatches

---

### **Libraries** (2 files)

#### 1. `src/lib/embeddings.ts`
**Status:** ✅ Already excluded but likely working

**Potential issues:**
- None found (uses orgId correctly)

#### 2. `src/lib/semantic-search.ts`
**Status:** ✅ Already excluded

**Check for:**
- Correct field names in queries
- Proper includes

---

## 🚀 Execution Strategy

### Phase 1: Employer Pages (1 hour)
Fix all 4 employer pages first - most visible to users.

### Phase 2: Critical API Routes (1 hour)
Fix application routes, assessment routes - core functionality.

### Phase 3: Remaining API Routes (1 hour)
Fix OAuth, Stripe, GDPR routes.

### Phase 4: Services & Workers (45 min)
Fix all service files and workers.

### Phase 5: Final Cleanup (15 min)
1. Remove all excludes from `tsconfig.json`
2. Run `yarn typecheck` - should be 0 errors
3. Run `yarn test` - should be 241 passing
4. Test locally

---

## ✅ Verification Checklist

After all fixes:

- [ ] `yarn typecheck` passes with 0 errors
- [ ] No files in tsconfig.json excludes (except tests)
- [ ] All 241 unit tests passing
- [ ] Build succeeds: `yarn build`
- [ ] Manual testing:
  - [ ] Can view employer dashboard
  - [ ] Can see application details
  - [ ] Can update application status
  - [ ] API routes respond correctly

---

## 📝 Template for Each File

```typescript
// 1. Fix imports if needed
import { prisma } from '@/lib/prisma'

// 2. Fix model names
- prisma.userOrgRole
+ prisma.orgMember

// 3. Fix field names
- application.stage
+ application.status

- application.activities
+ application.events

- user.contacts
+ user.email, user.name, user.phone

// 4. Add includes
const data = await prisma.application.findFirst({
  where: { id },
  include: {
    job: { include: { organization: true } },
    candidate: true,
    events: true
  }
})

// 5. Update property access
- data.job.city
+ data.job.location

- data.job.remote
+ data.job.workMode

- data.job.employmentType
+ data.job.type
```

---

## 🎯 Expected Outcome

After completing all refactoring:

**Before:**
- TypeScript: 95/100 (with excludes)
- Working files: 62%
- Project score: 94/100

**After:**
- TypeScript: 100/100 (no excludes)
- Working files: 100%
- Project score: 98/100

---

**Status:** ⏳ Ready to execute
**Priority:** 🟡 HIGH (not blocking, but high impact)
**Estimated Time:** 3-4 hours focused work
**Dependencies:** Database migration must be complete

---

*Created: 2025-10-08*
*Author: Claude Code*

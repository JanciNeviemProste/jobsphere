import { faker } from '@faker-js/faker'

export const createMockUser = (overrides = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  emailVerified: null,
  image: null,
  password: null,
  phone: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockOrgMember = (overrides = {}) => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  organizationId: faker.string.uuid(),
  role: 'MEMBER',
  ...overrides,
})

export const createMockEntitlement = (overrides = {}) => ({
  id: faker.string.uuid(),
  orgId: faker.string.uuid(),
  featureKey: 'MAX_JOBS',
  limitInt: 5,
  remainingInt: 5,
  resetAt: null,
  updatedAt: new Date(),
  ...overrides,
})

export const createMockEmailSequence = (overrides = {}) => ({
  id: faker.string.uuid(),
  orgId: faker.string.uuid(),
  name: faker.commerce.productName(),
  description: faker.commerce.productDescription(),
  active: false,
  createdBy: faker.string.uuid(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockEmailStep = (overrides = {}) => ({
  id: faker.string.uuid(),
  sequenceId: faker.string.uuid(),
  order: faker.number.int({ min: 0, max: 10 }),
  dayOffset: faker.number.int({ min: 0, max: 30 }),
  subject: faker.lorem.sentence(),
  bodyTemplate: faker.lorem.paragraphs(3),
  conditions: null,
  abVariant: null,
  ...overrides,
})

export const createMockAuditLog = (overrides = {}) => ({
  id: faker.string.uuid(),
  orgId: faker.string.uuid(),
  userId: faker.string.uuid(),
  action: 'USER_LOGIN',
  entityType: 'USER',
  entityId: faker.string.uuid(),
  changes: {},
  ipAddress: faker.internet.ip(),
  userAgent: faker.internet.userAgent(),
  createdAt: new Date(),
  ...overrides,
})

export const createMockJob = (overrides = {}) => ({
  id: faker.string.uuid(),
  title: faker.person.jobTitle(),
  location: faker.location.city(),
  description: faker.lorem.paragraphs(2),
  requirements: faker.lorem.paragraph(),
  benefits: faker.lorem.paragraph(),
  salaryMin: faker.number.int({ min: 40000, max: 80000 }),
  salaryMax: faker.number.int({ min: 80000, max: 150000 }),
  workMode: 'HYBRID' as const,
  type: 'FULL_TIME' as const,
  seniority: 'MEDIOR' as const,
  status: 'ACTIVE' as const,
  organizationId: faker.string.uuid(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockOrganization = (overrides = {}) => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  slug: faker.helpers.slugify(faker.company.name()),
  logo: faker.image.url(),
  website: faker.internet.url(),
  description: faker.company.catchPhrase(),
  industry: faker.company.buzzNoun(),
  size: '50-200',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockOrgCustomer = (overrides = {}) => ({
  id: faker.string.uuid(),
  orgId: faker.string.uuid(),
  stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
  stripePaymentMethod: null,
  vatId: null,
  taxExempt: false,
  address: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockApplication = (overrides = {}) => ({
  id: faker.string.uuid(),
  jobId: faker.string.uuid(),
  candidateId: faker.string.uuid(),
  status: 'PENDING' as const,
  cvUrl: faker.internet.url(),
  coverLetter: faker.lorem.paragraph(),
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockCandidate = (overrides = {}) => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email(),
  phone: faker.phone.number(),
  location: faker.location.city(),
  resume: faker.internet.url(),
  skills: [],
  experience: faker.number.int({ min: 0, max: 15 }),
  education: faker.lorem.sentence(),
  bio: faker.person.bio(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})
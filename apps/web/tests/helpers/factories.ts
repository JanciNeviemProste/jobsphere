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
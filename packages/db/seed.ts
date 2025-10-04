import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Slovak regions and cities for Sub-HR model
const REGIONS = {
  BA: { name: 'Bratislava', cities: ['Bratislava', 'Pezinok', 'Malacky', 'Senec'] },
  ZA: { name: 'Žilina', cities: ['Žilina', 'Martin', 'Čadca', 'Dolný Kubín'] },
  KE: { name: 'Košice', cities: ['Košice', 'Prešov', 'Michalovce', 'Spišská Nová Ves'] },
  REMOTE: { name: 'Remote', cities: ['Remote'] }
}

async function seed() {
  console.log('🌱 Starting seed...')

  // Clear existing data
  await prisma.$executeRaw`TRUNCATE TABLE organizations CASCADE`

  // Create demo organization
  const org = await prisma.organization.create({
    data: {
      name: 'TechCorp Slovakia',
      slug: 'techcorp-sk',
      website: 'https://techcorp.sk',
      description: 'Leading tech company in Slovakia',
      industry: 'Technology',
      size: '100-500',
      founded: 2015,
      regions: ['BA', 'ZA', 'KE', 'REMOTE'],
      settings: {
        defaultLocale: 'sk',
        timeZone: 'Europe/Bratislava',
        weekStartsOn: 1
      }
    }
  })

  // Create users
  const hashedPassword = await bcrypt.hash('demo123', 12)

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@techcorp.sk',
      password: hashedPassword,
      name: 'Admin User',
      locale: 'sk',
      emailVerified: new Date()
    }
  })

  const recruiterUser = await prisma.user.create({
    data: {
      email: 'recruiter@techcorp.sk',
      password: hashedPassword,
      name: 'Jana Nováková',
      locale: 'sk',
      emailVerified: new Date()
    }
  })

  const hiringManager = await prisma.user.create({
    data: {
      email: 'hiring@techcorp.sk',
      password: hashedPassword,
      name: 'Peter Kováč',
      locale: 'sk',
      emailVerified: new Date()
    }
  })

  const agencyUser = await prisma.user.create({
    data: {
      email: 'agency@partner.sk',
      password: hashedPassword,
      name: 'Agency Partner',
      locale: 'sk',
      emailVerified: new Date()
    }
  })

  // Assign roles
  await prisma.userOrgRole.createMany({
    data: [
      { userId: adminUser.id, orgId: org.id, role: 'ORG_ADMIN' },
      { userId: recruiterUser.id, orgId: org.id, role: 'RECRUITER' },
      { userId: hiringManager.id, orgId: org.id, role: 'HIRING_MANAGER' },
      { userId: agencyUser.id, orgId: org.id, role: 'AGENCY', assignedJobs: [] }
    ]
  })

  // Create products and plans for billing
  const starterProduct = await prisma.product.create({
    data: {
      name: 'Starter',
      description: 'Perfect for small teams',
      prices: {
        create: [
          { currency: 'EUR', amount: 4900, interval: 'MONTH', providerPriceId: 'price_starter_eur' },
          { currency: 'USD', amount: 5900, interval: 'MONTH', providerPriceId: 'price_starter_usd' }
        ]
      },
      plans: {
        create: {
          key: 'starter',
          name: 'Starter Plan',
          description: 'For small teams just getting started',
          features: {
            create: [
              { featureKey: 'job_slots', limitInt: 3 },
              { featureKey: 'seats', limitInt: 3 },
              { featureKey: 'assessments_per_month', limitInt: 1 },
              { featureKey: 'email_sends_per_month', limitInt: 500 }
            ]
          }
        }
      }
    }
  })

  const proProduct = await prisma.product.create({
    data: {
      name: 'Pro',
      description: 'For growing companies',
      prices: {
        create: [
          { currency: 'EUR', amount: 19900, interval: 'MONTH', providerPriceId: 'price_pro_eur' },
          { currency: 'USD', amount: 24900, interval: 'MONTH', providerPriceId: 'price_pro_usd' }
        ]
      },
      plans: {
        create: {
          key: 'pro',
          name: 'Pro Plan',
          description: 'For growing teams with more hiring needs',
          features: {
            create: [
              { featureKey: 'job_slots', limitInt: 15 },
              { featureKey: 'seats', limitInt: 10 },
              { featureKey: 'assessments_per_month', limitInt: 10 },
              { featureKey: 'email_sends_per_month', limitInt: 5000 }
            ]
          }
        }
      }
    }
  })

  const enterpriseProduct = await prisma.product.create({
    data: {
      name: 'Enterprise',
      description: 'Custom solution for large organizations',
      prices: {
        create: [
          { currency: 'EUR', amount: 99900, interval: 'MONTH', providerPriceId: 'price_enterprise_eur' }
        ]
      },
      plans: {
        create: {
          key: 'enterprise',
          name: 'Enterprise Plan',
          description: 'Unlimited everything with premium support',
          features: {
            create: [
              { featureKey: 'job_slots', limitInt: null },
              { featureKey: 'seats', limitInt: null },
              { featureKey: 'assessments_per_month', limitInt: null },
              { featureKey: 'email_sends_per_month', limitInt: null },
              { featureKey: 'sso', limitBool: true }
            ]
          }
        }
      }
    }
  })

  // Create subscription for demo org
  await prisma.subscription.create({
    data: {
      orgId: org.id,
      productId: proProduct.id,
      providerSubId: 'sub_demo_' + faker.string.alphanumeric(16),
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  })

  // Create entitlements
  await prisma.entitlement.createMany({
    data: [
      { orgId: org.id, featureKey: 'job_slots', limitInt: 15, remainingInt: 12 },
      { orgId: org.id, featureKey: 'seats', limitInt: 10, remainingInt: 6 },
      { orgId: org.id, featureKey: 'assessments_per_month', limitInt: 10, remainingInt: 8 },
      { orgId: org.id, featureKey: 'email_sends_per_month', limitInt: 5000, remainingInt: 4500 }
    ]
  })

  // Create jobs in different regions
  const jobs = []
  for (const [regionCode, region] of Object.entries(REGIONS)) {
    for (let i = 0; i < 2; i++) {
      const city = faker.helpers.arrayElement(region.cities)
      const job = await prisma.job.create({
        data: {
          orgId: org.id,
          title: faker.helpers.arrayElement([
            'Senior Full Stack Developer',
            'DevOps Engineer',
            'Product Manager',
            'UX Designer',
            'Data Scientist',
            'QA Engineer'
          ]),
          description: faker.lorem.paragraphs(3),
          requirements: faker.lorem.paragraphs(2),
          responsibilities: faker.lorem.paragraphs(2),
          benefits: faker.lorem.paragraphs(1),
          city: city,
          region: regionCode,
          remote: regionCode === 'REMOTE',
          hybrid: faker.datatype.boolean(),
          employmentType: faker.helpers.arrayElement(['FULL_TIME', 'CONTRACT']),
          seniority: faker.helpers.arrayElement(['MID', 'SENIOR', 'LEAD']),
          salaryMin: faker.number.int({ min: 2000, max: 4000 }),
          salaryMax: faker.number.int({ min: 4000, max: 8000 }),
          salaryCurrency: 'EUR',
          salaryPeriod: 'MONTH',
          locale: faker.helpers.arrayElement(['sk', 'en']),
          status: faker.helpers.arrayElement(['PUBLISHED', 'PUBLISHED', 'DRAFT']),
          publishedAt: faker.date.recent({ days: 30 }),
          createdBy: recruiterUser.id,
          slug: faker.helpers.slugify(faker.lorem.words(3))
        }
      })
      jobs.push(job)
    }
  }

  // Update agency user with assigned jobs
  await prisma.userOrgRole.update({
    where: { userId_orgId: { userId: agencyUser.id, orgId: org.id } },
    data: { assignedJobs: jobs.slice(0, 3).map(j => j.id) }
  })

  // Create candidates with CVs
  for (let i = 0; i < 20; i++) {
    const candidate = await prisma.candidate.create({
      data: {
        orgId: org.id,
        source: faker.helpers.arrayElement(['WEBSITE', 'LINKEDIN', 'REFERRAL', 'IMPORT']),
        tags: faker.helpers.arrayElements(['javascript', 'typescript', 'react', 'node', 'python', 'java'], 3),
        contacts: {
          create: {
            fullName: faker.person.fullName(),
            email: faker.internet.email(),
            phone: faker.phone.number(),
            location: faker.helpers.arrayElement(Object.values(REGIONS).flatMap(r => r.cities)),
            primaryLocale: faker.helpers.arrayElement(['sk', 'en', 'cs']),
            salaryExpectation: faker.number.int({ min: 2000, max: 6000 })
          }
        }
      }
    })

    // Create resume
    const resume = await prisma.resume.create({
      data: {
        candidateId: candidate.id,
        language: faker.helpers.arrayElement(['sk', 'en']),
        summary: faker.lorem.paragraph(),
        yearsOfExperience: faker.number.float({ min: 1, max: 15, multipleOf: 0.5 }),
        skills: faker.helpers.arrayElements([
          'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java',
          'Docker', 'Kubernetes', 'AWS', 'PostgreSQL', 'MongoDB', 'Redis'
        ], 6),
        personalInfo: {
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          dateOfBirth: faker.date.birthdate({ min: 22, max: 55, mode: 'age' })
        },
        experiences: Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () => ({
          title: faker.person.jobTitle(),
          company: faker.company.name(),
          location: faker.location.city(),
          startDate: faker.date.past({ years: 10 }),
          endDate: faker.datatype.boolean() ? faker.date.recent() : null,
          current: faker.datatype.boolean(),
          description: faker.lorem.paragraph()
        })),
        education: Array.from({ length: faker.number.int({ min: 1, max: 2 }) }, () => ({
          degree: faker.helpers.arrayElement(['Bachelor', 'Master', 'PhD']),
          field: faker.helpers.arrayElement(['Computer Science', 'Engineering', 'Business']),
          school: faker.company.name() + ' University',
          location: faker.location.city(),
          startDate: faker.date.past({ years: 15 }),
          endDate: faker.date.past({ years: 10 })
        }))
      }
    })

    // Create applications
    const numApplications = faker.number.int({ min: 0, max: 3 })
    const appliedJobs = faker.helpers.arrayElements(jobs, numApplications)

    for (const job of appliedJobs) {
      await prisma.application.create({
        data: {
          candidateId: candidate.id,
          jobId: job.id,
          orgId: org.id,
          stage: faker.helpers.arrayElement(['NEW', 'SCREENING', 'PHONE', 'TECHNICAL', 'ONSITE', 'OFFER', 'REJECTED']),
          score: faker.number.float({ min: 0, max: 100, multipleOf: 0.1 }),
          assignedTo: faker.helpers.arrayElement([recruiterUser.id, hiringManager.id, null]),
          source: faker.helpers.arrayElement(['WEBSITE', 'LINKEDIN', 'REFERRAL']),
          lastContactAt: faker.date.recent({ days: 7 }),
          tags: faker.helpers.arrayElements(['urgent', 'promising', 'follow-up', 'remote-only'], 2)
        }
      })

      // Create match score
      await prisma.matchScore.create({
        data: {
          orgId: org.id,
          jobId: job.id,
          candidateId: candidate.id,
          resumeId: resume.id,
          score0to100: faker.number.int({ min: 20, max: 95 }),
          bm25Score: faker.number.float({ min: 0, max: 1 }),
          vectorScore: faker.number.float({ min: 0, max: 1 }),
          llmScore: faker.number.float({ min: 0, max: 1 }),
          evidence: {
            matchedSkills: faker.helpers.arrayElements(['JavaScript', 'React', 'Node.js'], 2),
            experienceMatch: faker.datatype.boolean(),
            educationMatch: faker.datatype.boolean()
          },
          explanation: [
            faker.lorem.sentence(),
            faker.lorem.sentence()
          ],
          version: '1.0.0'
        }
      })
    }
  }

  // Create assessment
  const assessment = await prisma.assessment.create({
    data: {
      orgId: org.id,
      name: 'Full Stack Developer Assessment',
      description: 'Technical assessment for full stack developers',
      locale: 'en',
      durationMin: 60,
      passingScore: 70,
      isPublished: true,
      createdBy: recruiterUser.id,
      sections: {
        create: [
          {
            title: 'JavaScript Fundamentals',
            order: 1,
            questions: {
              create: [
                {
                  type: 'MCQ',
                  text: 'What is the output of typeof null in JavaScript?',
                  choices: ['null', 'undefined', 'object', 'number'],
                  correctIndexes: [2],
                  points: 5,
                  skillTag: 'javascript',
                  order: 1
                },
                {
                  type: 'MULTI',
                  text: 'Which of the following are falsy values in JavaScript?',
                  choices: ['0', '""', 'null', '[]', 'false', '{}'],
                  correctIndexes: [0, 1, 2, 4],
                  points: 10,
                  skillTag: 'javascript',
                  order: 2
                }
              ]
            }
          },
          {
            title: 'React Knowledge',
            order: 2,
            questions: {
              create: [
                {
                  type: 'SHORT',
                  text: 'What is the purpose of useEffect hook in React?',
                  points: 10,
                  skillTag: 'react',
                  order: 1
                },
                {
                  type: 'CODE',
                  text: 'Write a React component that fetches and displays user data',
                  language: 'javascript',
                  starterCode: '// Write your component here',
                  points: 20,
                  skillTag: 'react',
                  order: 2
                }
              ]
            }
          }
        ]
      }
    }
  })

  // Create email sequence
  const emailSequence = await prisma.emailSequence.create({
    data: {
      orgId: org.id,
      name: 'Candidate Follow-up Sequence',
      description: 'Automated follow-up for new candidates',
      active: true,
      createdBy: recruiterUser.id,
      settings: {
        quietHours: { start: 20, end: 8 },
        dailyLimit: 50,
        timezone: 'Europe/Bratislava'
      },
      steps: {
        create: [
          {
            name: 'Initial Welcome',
            dayOffset: 0,
            hourOffset: 9,
            subject: 'Welcome to {{company.name}}!',
            bodyTemplate: 'Hi {{candidate.firstName}},\n\nThank you for applying to {{job.title}}...',
            order: 1
          },
          {
            name: 'Follow-up',
            dayOffset: 3,
            hourOffset: 10,
            subject: 'Next steps in your application',
            bodyTemplate: 'Hi {{candidate.firstName}},\n\nWe wanted to update you on your application...',
            order: 2
          },
          {
            name: 'Check-in',
            dayOffset: 7,
            hourOffset: 14,
            subject: 'Are you still interested in {{job.title}}?',
            bodyTemplate: 'Hi {{candidate.firstName}},\n\nWe haven\'t heard from you...',
            order: 3
          }
        ]
      }
    }
  })

  // Create email account (mock)
  await prisma.emailAccount.create({
    data: {
      orgId: org.id,
      provider: 'SMTP',
      email: 'hr@techcorp.sk',
      name: 'TechCorp HR',
      smtpHost: 'localhost',
      smtpPort: 1025,
      smtpUser: 'hr@techcorp.sk',
      smtpPass: 'demo',
      signature: '<p>Best regards,<br/>TechCorp HR Team</p>',
      isDefault: true
    }
  })

  console.log('✅ Seed completed successfully!')
  console.log('')
  console.log('Demo accounts:')
  console.log('  Admin: admin@techcorp.sk / demo123')
  console.log('  Recruiter: recruiter@techcorp.sk / demo123')
  console.log('  Hiring Manager: hiring@techcorp.sk / demo123')
  console.log('  Agency: agency@partner.sk / demo123')
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Clear existing data
  console.log('🗑️  Clearing existing data...')
  await prisma.applicationActivity.deleteMany()
  await prisma.application.deleteMany()
  await prisma.job.deleteMany()
  await prisma.candidateContact.deleteMany()
  await prisma.candidate.deleteMany()
  await prisma.userOrgRole.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()

  // Create demo password (all users will have password: demo123)
  const hashedPassword = await hash('demo123', 12)

  // ============================================================================
  // ORGANIZATIONS
  // ============================================================================

  console.log('🏢 Creating organizations...')

  const techCorp = await prisma.organization.create({
    data: {
      name: 'TechCorp SK',
      slug: 'techcorp-sk',
      description: 'Moderná IT spoločnosť zameraná na vývoj inovatívnych riešení.',
      website: 'https://techcorp.sk',
      industry: 'Technology',
      size: '50-200',
    },
  })

  const startupHub = await prisma.organization.create({
    data: {
      name: 'StartupHub',
      slug: 'startuphub',
      description: 'Kreatívny startup building next-gen SaaS products.',
      website: 'https://startuphub.io',
      industry: 'SaaS',
      size: '10-50',
    },
  })

  const dataSolutions = await prisma.organization.create({
    data: {
      name: 'DataSolutions',
      slug: 'datasolutions',
      description: 'Enterprise data analytics and AI consulting.',
      website: 'https://datasolutions.eu',
      industry: 'Data & Analytics',
      size: '200-500',
    },
  })

  console.log(`✅ Created ${3} organizations`)

  // ============================================================================
  // USERS
  // ============================================================================

  console.log('👥 Creating users...')

  // Employers
  const employer1 = await prisma.user.create({
    data: {
      email: 'admin@techcorp.sk',
      name: 'Peter Novák',
      password: hashedPassword,
      phone: '+421 900 111 111',
    },
  })

  const employer2 = await prisma.user.create({
    data: {
      email: 'recruiter@startuphub.io',
      name: 'Jana Horváthová',
      password: hashedPassword,
      phone: '+421 900 222 222',
    },
  })

  const employer3 = await prisma.user.create({
    data: {
      email: 'hr@datasolutions.eu',
      name: 'Martin Kováč',
      password: hashedPassword,
      phone: '+421 900 333 333',
    },
  })

  // Candidates
  const candidate1 = await prisma.user.create({
    data: {
      email: 'jan.novak@example.com',
      name: 'Ján Novák',
      password: hashedPassword,
      phone: '+421 900 444 444',
    },
  })

  const candidate2 = await prisma.user.create({
    data: {
      email: 'maria.kovacova@example.com',
      name: 'Mária Kováčová',
      password: hashedPassword,
      phone: '+421 900 555 555',
    },
  })

  const candidate3 = await prisma.user.create({
    data: {
      email: 'peter.szabo@example.com',
      name: 'Peter Szabó',
      password: hashedPassword,
      phone: '+421 900 666 666',
    },
  })

  console.log(`✅ Created ${6} users`)

  // ============================================================================
  // ORG MEMBERS
  // ============================================================================

  console.log('👔 Creating org memberships...')

  await prisma.userOrgRole.create({
    data: {
      userId: employer1.id,
      orgId: techCorp.id,
      role: 'ORG_ADMIN',
    },
  })

  await prisma.userOrgRole.create({
    data: {
      userId: employer2.id,
      orgId: startupHub.id,
      role: 'ORG_ADMIN',
    },
  })

  await prisma.userOrgRole.create({
    data: {
      userId: employer3.id,
      orgId: dataSolutions.id,
      role: 'ORG_ADMIN',
    },
  })

  console.log(`✅ Created ${3} org memberships`)

  // ============================================================================
  // JOBS
  // ============================================================================

  console.log('💼 Creating jobs...')

  const jobs = await Promise.all([
    // TechCorp jobs
    prisma.job.create({
      data: {
        orgId: techCorp.id,
        createdBy: employer1.id,
        title: 'Senior React Developer',
        description: `## O pozícii

Hľadáme skúseného React developera na rozšírenie nášho tímu.

## Požiadavky

- 5+ rokov skúseností s React
- TypeScript, Next.js
- REST APIs, GraphQL
- Git, CI/CD

## Ponúkame

- Práca na moderných projektoch
- Flexibilná pracovná doba
- Home office možnosť
- Benefity (MultiSport, stravné lístky)`,
        city: 'Bratislava',
        region: 'BA',
        hybrid: true,
        employmentType: 'FULL_TIME',
        salaryMin: 3000,
        salaryMax: 5000,
        seniority: 'SENIOR',
        status: 'PUBLISHED',
      },
    }),

    prisma.job.create({
      data: {
        orgId: techCorp.id,
        createdBy: employer1.id,
        title: 'Backend Developer (Node.js)',
        description: `## O pozícii

Backend developer pozícia pre prácu na enterprise projektoch.

## Požiadavky

- 3+ rokov Node.js
- PostgreSQL, MongoDB
- Docker, Kubernetes
- Microservices architecture

## Ponúkame

- Competitive salary
- Vzdelávanie a certifikácie
- Moderné technológie`,
        city: 'Bratislava',
        region: 'BA',
        remote: false,
        hybrid: false,
        employmentType: 'FULL_TIME',
        salaryMin: 2500,
        salaryMax: 4000,
        seniority: 'MID',
        status: 'PUBLISHED',
      },
    }),

    // StartupHub jobs
    prisma.job.create({
      data: {
        orgId: startupHub.id,
        createdBy: employer2.id,
        title: 'Full Stack Developer',
        description: `## O pozícii

Join our startup and build amazing SaaS products!

## Požiadavky

- React + Node.js
- Database design
- Startup mindset
- English fluency

## Ponúkame

- Equity options
- Remote work
- Flat hierarchy
- Impact on product`,
        city: 'Košice',
        region: 'KE',
        remote: true,
        employmentType: 'FULL_TIME',
        salaryMin: 2000,
        salaryMax: 3500,
        seniority: 'MID',
        status: 'PUBLISHED',
      },
    }),

    prisma.job.create({
      data: {
        orgId: startupHub.id,
        createdBy: employer2.id,
        title: 'Junior Frontend Developer',
        description: `## O pozícii

Perfect for fresh graduates! Learn from experienced team.

## Požiadavky

- HTML, CSS, JavaScript
- React basics
- Willingness to learn
- Team player

## Ponúkame

- Mentorship program
- Career growth
- Modern tech stack`,
        city: 'Košice',
        region: 'KE',
        hybrid: true,
        employmentType: 'FULL_TIME',
        salaryMin: 1200,
        salaryMax: 1800,
        seniority: 'ENTRY',
        status: 'PUBLISHED',
      },
    }),

    // DataSolutions jobs
    prisma.job.create({
      data: {
        orgId: dataSolutions.id,
        createdBy: employer3.id,
        title: 'Data Engineer',
        description: `## O pozícii

Build data pipelines for enterprise clients.

## Požiadavky

- Python, SQL
- Apache Spark, Airflow
- AWS/Azure experience
- ETL pipelines

## Ponúkame

- Work with big data
- International projects
- Competitive salary`,
        city: 'Žilina',
        region: 'ZA',
        hybrid: true,
        employmentType: 'FULL_TIME',
        salaryMin: 2800,
        salaryMax: 4500,
        seniority: 'SENIOR',
        status: 'PUBLISHED',
      },
    }),

    prisma.job.create({
      data: {
        orgId: dataSolutions.id,
        createdBy: employer3.id,
        title: 'DevOps Engineer',
        description: `## O pozícii

DevOps engineer for cloud infrastructure.

## Požiadavky

- Kubernetes, Docker
- Terraform, Ansible
- AWS/GCP/Azure
- CI/CD pipelines

## Ponúkame

- Cloud certifications
- Latest tools
- Challenging projects`,
        city: 'Žilina',
        region: 'ZA',
        remote: true,
        employmentType: 'FULL_TIME',
        salaryMin: 3200,
        salaryMax: 5200,
        seniority: 'LEAD',
        status: 'PUBLISHED',
      },
    }),
  ])

  console.log(`✅ Created ${jobs.length} jobs`)

  // ============================================================================
  // CANDIDATES
  // ============================================================================

  console.log('👤 Creating candidates...')

  const candidate1Data = await prisma.candidate.create({
    data: {
      orgId: techCorp.id,
      source: 'WEBSITE',
      contacts: {
        create: {
          fullName: 'Ján Novák',
          email: 'jan.novak@example.com',
          phone: '+421 900 444 444',
          isPrimary: true,
        },
      },
    },
  })

  const candidate2Data = await prisma.candidate.create({
    data: {
      orgId: startupHub.id,
      source: 'WEBSITE',
      contacts: {
        create: {
          fullName: 'Mária Kováčová',
          email: 'maria.kovacova@example.com',
          phone: '+421 900 555 555',
          isPrimary: true,
        },
      },
    },
  })

  const candidate3Data = await prisma.candidate.create({
    data: {
      orgId: dataSolutions.id,
      source: 'WEBSITE',
      contacts: {
        create: {
          fullName: 'Peter Szabó',
          email: 'peter.szabo@example.com',
          phone: '+421 900 666 666',
          isPrimary: true,
        },
      },
    },
  })

  console.log(`✅ Created ${3} candidates with contacts`)

  // ============================================================================
  // APPLICATIONS
  // ============================================================================

  console.log('📝 Creating applications...')

  const app1 = await prisma.application.create({
    data: {
      jobId: jobs[0].id, // Senior React Developer
      candidateId: candidate1Data.id,
      orgId: techCorp.id,
      coverLetter: `Dobrý deň,

Som nadšený, že môžem požiadať o pozíciu Senior React Developer vo vašej spoločnosti. S viac ako 5 rokmi skúseností v React vývoji a s hlbokými znalosťami TypeScript, Next.js a moderných frontend technológií si myslím, že som ideálny kandidát pre túto rolu.

Vo svojej predchádzajúcej pozícii som viedol tím 5 vývojárov pri vytváraní komplexnej e-commerce platformy, ktorá obsluhuje viac ako 100,000 používateľov mesačne. Implementoval som pokročilé state management riešenia, optimalizoval výkon aplikácie a zaviedol best practices pre code review a testing.

Teším sa na možnosť prispieť k vašim projektom a priniesť moje skúsenosti do vášho tímu.

S pozdravom,
Ján Novák`,
      stage: 'SCREENING',
    },
  })

  await prisma.applicationActivity.createMany({
    data: [
      {
        applicationId: app1.id,
        type: 'STAGE_CHANGE',
        description: 'Application submitted - moving to SCREENING stage',
      },
      {
        applicationId: app1.id,
        type: 'NOTE_ADDED',
        description: 'HR team is reviewing your application',
      },
    ],
  })

  const app2 = await prisma.application.create({
    data: {
      jobId: jobs[2].id, // Full Stack Developer
      candidateId: candidate2Data.id,
      orgId: startupHub.id,
      coverLetter: `Hello,

I am very excited about the Full Stack Developer position at StartupHub. I have 3 years of experience building modern web applications with React and Node.js.

I'm particularly attracted to the startup environment and the opportunity to have real impact on the product. My previous experience includes building a real-time collaboration tool from scratch, which is now used by over 5,000 users.

Looking forward to discussing how I can contribute to your team!

Best regards,
Mária Kováčová`,
      stage: 'PHONE',
    },
  })

  await prisma.applicationActivity.createMany({
    data: [
      {
        applicationId: app2.id,
        type: 'STAGE_CHANGE',
        description: 'Application submitted - moving to NEW stage',
      },
      {
        applicationId: app2.id,
        type: 'STAGE_CHANGE',
        description: 'Application moved to SCREENING stage',
      },
      {
        applicationId: app2.id,
        type: 'STAGE_CHANGE',
        description: 'Phone interview scheduled - moved to PHONE stage',
      },
    ],
  })

  const app3 = await prisma.application.create({
    data: {
      jobId: jobs[4].id, // Data Engineer
      candidateId: candidate3Data.id,
      orgId: dataSolutions.id,
      coverLetter: `Dear Hiring Manager,

I am writing to apply for the Data Engineer position. With 4 years of experience in building data pipelines and working with Apache Spark and Airflow, I believe I would be a great fit for your team.

In my current role, I designed and implemented ETL pipelines processing over 10TB of data daily. I have extensive experience with AWS services including EMR, Glue, and Redshift.

I am passionate about working with big data and would love to contribute to your enterprise projects.

Sincerely,
Peter Szabó`,
      stage: 'NEW',
    },
  })

  await prisma.applicationActivity.create({
    data: {
      applicationId: app3.id,
      type: 'STAGE_CHANGE',
      description: 'Application submitted - in NEW stage',
    },
  })

  console.log(`✅ Created ${3} applications with events`)

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n📊 Seed Summary:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅ ${3} Organizations`)
  console.log(`✅ ${3} Employer Users`)
  console.log(`✅ ${3} User-Org Roles`)
  console.log(`✅ ${3} Candidates (with contacts)`)
  console.log(`✅ ${jobs.length} Jobs`)
  console.log(`✅ ${3} Applications`)
  console.log(`✅ ${6} Application Activities`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n🔐 Demo Credentials (password: demo123):')
  console.log('\nEmployers:')
  console.log('  • admin@techcorp.sk (TechCorp SK)')
  console.log('  • recruiter@startuphub.io (StartupHub)')
  console.log('  • hr@datasolutions.eu (DataSolutions)')
  console.log('\nCandidates (stored as Candidate records):')
  console.log('  • Ján Novák (jan.novak@example.com)')
  console.log('  • Mária Kováčová (maria.kovacova@example.com)')
  console.log('  • Peter Szabó (peter.szabo@example.com)')
  console.log('\n✨ Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

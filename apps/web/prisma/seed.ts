import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Clear existing data
  console.log('🗑️  Clearing existing data...')
  await prisma.applicationEvent.deleteMany()
  await prisma.application.deleteMany()
  await prisma.job.deleteMany()
  await prisma.orgMember.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.account.deleteMany()
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
      description: 'Moderná IT spoločnosť zameraná na vývoj inovatívnych riešení.',
      email: 'contact@techcorp.sk',
      phone: '+421 900 123 456',
      website: 'https://techcorp.sk',
      location: 'Bratislava, Slovakia',
    },
  })

  const startupHub = await prisma.organization.create({
    data: {
      name: 'StartupHub',
      description: 'Kreatívny startup building next-gen SaaS products.',
      email: 'jobs@startuphub.io',
      phone: '+421 900 234 567',
      website: 'https://startuphub.io',
      location: 'Košice, Slovakia',
    },
  })

  const dataSolutions = await prisma.organization.create({
    data: {
      name: 'DataSolutions',
      description: 'Enterprise data analytics and AI consulting.',
      email: 'hr@datasolutions.eu',
      phone: '+421 900 345 678',
      website: 'https://datasolutions.eu',
      location: 'Žilina, Slovakia',
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

  await prisma.orgMember.create({
    data: {
      userId: employer1.id,
      organizationId: techCorp.id,
      role: 'ADMIN',
    },
  })

  await prisma.orgMember.create({
    data: {
      userId: employer2.id,
      organizationId: startupHub.id,
      role: 'ADMIN',
    },
  })

  await prisma.orgMember.create({
    data: {
      userId: employer3.id,
      organizationId: dataSolutions.id,
      role: 'ADMIN',
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
        organizationId: techCorp.id,
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
        location: 'Bratislava, Slovakia',
        salaryMin: 3000,
        salaryMax: 5000,
        workMode: 'HYBRID',
        type: 'FULL_TIME',
        seniority: 'SENIOR',
        status: 'ACTIVE',
      },
    }),

    prisma.job.create({
      data: {
        organizationId: techCorp.id,
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
        location: 'Bratislava, Slovakia',
        salaryMin: 2500,
        salaryMax: 4000,
        workMode: 'ONSITE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
        status: 'ACTIVE',
      },
    }),

    // StartupHub jobs
    prisma.job.create({
      data: {
        organizationId: startupHub.id,
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
        location: 'Košice, Slovakia',
        salaryMin: 2000,
        salaryMax: 3500,
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
        status: 'ACTIVE',
      },
    }),

    prisma.job.create({
      data: {
        organizationId: startupHub.id,
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
        location: 'Košice, Slovakia',
        salaryMin: 1200,
        salaryMax: 1800,
        workMode: 'HYBRID',
        type: 'FULL_TIME',
        seniority: 'JUNIOR',
        status: 'ACTIVE',
      },
    }),

    // DataSolutions jobs
    prisma.job.create({
      data: {
        organizationId: dataSolutions.id,
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
        location: 'Žilina, Slovakia',
        salaryMin: 2800,
        salaryMax: 4500,
        workMode: 'HYBRID',
        type: 'FULL_TIME',
        seniority: 'SENIOR',
        status: 'ACTIVE',
      },
    }),

    prisma.job.create({
      data: {
        organizationId: dataSolutions.id,
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
        location: 'Žilina, Slovakia',
        salaryMin: 3200,
        salaryMax: 5200,
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'LEAD',
        status: 'ACTIVE',
      },
    }),
  ])

  console.log(`✅ Created ${jobs.length} jobs`)

  // ============================================================================
  // APPLICATIONS
  // ============================================================================

  console.log('📝 Creating applications...')

  const app1 = await prisma.application.create({
    data: {
      jobId: jobs[0].id, // Senior React Developer
      candidateId: candidate1.id,
      coverLetter: `Dobrý deň,

Som nadšený, že môžem požiadať o pozíciu Senior React Developer vo vašej spoločnosti. S viac ako 5 rokmi skúseností v React vývoji a s hlbokými znalosťami TypeScript, Next.js a moderných frontend technológií si myslím, že som ideálny kandidát pre túto rolu.

Vo svojej predchádzajúcej pozícii som viedol tím 5 vývojárov pri vytváraní komplexnej e-commerce platformy, ktorá obsluhuje viac ako 100,000 používateľov mesačne. Implementoval som pokročilé state management riešenia, optimalizoval výkon aplikácie a zaviedol best practices pre code review a testing.

Teším sa na možnosť prispieť k vašim projektom a priniesť moje skúsenosti do vášho tímu.

S pozdravom,
Ján Novák`,
      cvUrl: null,
      expectedSalary: 4200,
      status: 'REVIEWING',
    },
  })

  await prisma.applicationEvent.createMany({
    data: [
      {
        applicationId: app1.id,
        type: 'APPLIED',
        title: 'Application Submitted',
        description: 'Your application has been successfully submitted',
      },
      {
        applicationId: app1.id,
        type: 'STATUS_CHANGED',
        title: 'Application Under Review',
        description: 'HR team is reviewing your application',
      },
    ],
  })

  const app2 = await prisma.application.create({
    data: {
      jobId: jobs[2].id, // Full Stack Developer
      candidateId: candidate2.id,
      coverLetter: `Hello,

I am very excited about the Full Stack Developer position at StartupHub. I have 3 years of experience building modern web applications with React and Node.js.

I'm particularly attracted to the startup environment and the opportunity to have real impact on the product. My previous experience includes building a real-time collaboration tool from scratch, which is now used by over 5,000 users.

Looking forward to discussing how I can contribute to your team!

Best regards,
Mária Kováčová`,
      cvUrl: null,
      expectedSalary: 2800,
      status: 'INTERVIEWED',
    },
  })

  await prisma.applicationEvent.createMany({
    data: [
      {
        applicationId: app2.id,
        type: 'APPLIED',
        title: 'Application Submitted',
        description: 'Your application has been successfully submitted',
      },
      {
        applicationId: app2.id,
        type: 'STATUS_CHANGED',
        title: 'Application Under Review',
        description: 'Application status changed to REVIEWING',
      },
      {
        applicationId: app2.id,
        type: 'STATUS_CHANGED',
        title: 'Interview Scheduled',
        description: 'Application status changed to INTERVIEWED',
      },
    ],
  })

  const app3 = await prisma.application.create({
    data: {
      jobId: jobs[4].id, // Data Engineer
      candidateId: candidate3.id,
      coverLetter: `Dear Hiring Manager,

I am writing to apply for the Data Engineer position. With 4 years of experience in building data pipelines and working with Apache Spark and Airflow, I believe I would be a great fit for your team.

In my current role, I designed and implemented ETL pipelines processing over 10TB of data daily. I have extensive experience with AWS services including EMR, Glue, and Redshift.

I am passionate about working with big data and would love to contribute to your enterprise projects.

Sincerely,
Peter Szabó`,
      cvUrl: null,
      expectedSalary: 3500,
      status: 'PENDING',
    },
  })

  await prisma.applicationEvent.create({
    data: {
      applicationId: app3.id,
      type: 'APPLIED',
      title: 'Application Submitted',
      description: 'Your application has been successfully submitted',
    },
  })

  console.log(`✅ Created ${3} applications with events`)

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n📊 Seed Summary:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅ ${3} Organizations`)
  console.log(`✅ ${6} Users (3 employers + 3 candidates)`)
  console.log(`✅ ${3} Org Memberships`)
  console.log(`✅ ${jobs.length} Jobs`)
  console.log(`✅ ${3} Applications`)
  console.log(`✅ ${6} Application Events`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n🔐 Demo Credentials (password: demo123):')
  console.log('\nEmployers:')
  console.log('  • admin@techcorp.sk (TechCorp SK)')
  console.log('  • recruiter@startuphub.io (StartupHub)')
  console.log('  • hr@datasolutions.eu (DataSolutions)')
  console.log('\nCandidates:')
  console.log('  • jan.novak@example.com')
  console.log('  • maria.kovacova@example.com')
  console.log('  • peter.szabo@example.com')
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

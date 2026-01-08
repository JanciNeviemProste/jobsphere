import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Debug endpoint to test database connectivity and verify users exist
 * This helps diagnose login issues on production
 */
export async function GET() {
  try {
    console.log('🔍 DB Test: Starting database connectivity check...')

    // Test 1: Check database connection
    const dbConnection = await prisma.$queryRaw`SELECT 1 as connected`
    console.log('✅ DB Test: Database connection successful', dbConnection)

    // Test 2: Count total users
    const userCount = await prisma.user.count()
    console.log(`✅ DB Test: Found ${userCount} users in database`)

    // Test 3: Check if test users exist (without exposing passwords)
    const testEmails = ['admin@techcorp.sk', 'admin@jobsphere.eu']
    const testUsers = await prisma.user.findMany({
      where: {
        email: {
          in: testEmails
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        password: true, // Just to check if it exists, won't return value
      }
    })

    const userResults = testUsers.map(user => ({
      email: user.email,
      name: user.name,
      hasPassword: !!user.password,
      passwordLength: user.password?.length || 0
    }))

    console.log('✅ DB Test: Test users found:', userResults)

    // Test 4: Check database URL (sanitized)
    const dbUrl = process.env.DATABASE_URL || ''
    const sanitizedUrl = dbUrl.replace(/:[^:@]+@/, ':***@') // Hide password
    console.log('📊 DB Test: DATABASE_URL configured:', sanitizedUrl)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        databaseConnected: true,
        totalUsers: userCount,
        testUsers: userResults,
        databaseUrl: sanitizedUrl
      }
    })
  } catch (error) {
    console.error('❌ DB Test: Database test failed:', error)

    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Error',
        stack: error instanceof Error ? error.stack : undefined
      },
      databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@')
    }, { status: 500 })
  }
}

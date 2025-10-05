/**
 * Gmail OAuth Flow
 * Pripojenie Gmailu cez Google OAuth
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

/**
 * GET /api/email/oauth/gmail
 * Inicializuje Gmail OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/email/oauth/gmail/callback`

    if (!clientId) {
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      )
    }

    // Generate state token
    const state = Buffer.from(
      JSON.stringify({
        userId: session.user.id,
        timestamp: Date.now(),
      })
    ).toString('base64')

    const authUrl = new URL(GOOGLE_AUTH_URL)
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    console.error('Gmail OAuth init error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize OAuth' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/email/oauth/gmail
 * Manuálne pridanie Gmail tokenu
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { accessToken, refreshToken, email } = await request.json()

    if (!accessToken || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const orgMember = await prisma.orgMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!orgMember) {
      return NextResponse.json(
        { error: 'User not in organization' },
        { status: 400 }
      )
    }

    const emailAccount = await prisma.emailAccount.upsert({
      where: {
        orgId_email: {
          email,
          orgId: orgMember.organizationId,
        },
      },
      create: {
        email,
        provider: 'GMAIL',
        orgId: orgMember.organizationId,
        oauthTokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600,
          token_type: 'Bearer',
        },
        active: true,
      },
      update: {
        oauthTokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600,
          token_type: 'Bearer',
        },
        active: true,
        lastSyncAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      accountId: emailAccount.id,
      email: emailAccount.email,
    })
  } catch (error) {
    console.error('Gmail OAuth save error:', error)
    return NextResponse.json(
      { error: 'Failed to save account' },
      { status: 500 }
    )
  }
}

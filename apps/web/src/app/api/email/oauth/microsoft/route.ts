/**
 * Microsoft 365 OAuth Flow
 * Pripojenie firemného emailu cez Microsoft Graph API
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

const SCOPES = [
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/User.Read',
  'offline_access',
].join(' ')

/**
 * GET /api/email/oauth/microsoft
 * Inicializuje OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/email/oauth/microsoft/callback`

    if (!clientId) {
      return NextResponse.json(
        { error: 'Microsoft OAuth not configured' },
        { status: 500 }
      )
    }

    // Generate state token for CSRF protection
    const state = Buffer.from(
      JSON.stringify({
        userId: session.user.id,
        timestamp: Date.now(),
      })
    ).toString('base64')

    const authUrl = new URL(MICROSOFT_AUTH_URL)
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('response_mode', 'query')

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    console.error('Microsoft OAuth init error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize OAuth' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/email/oauth/microsoft
 * Manuálne pridanie access tokenu (pre testovanie)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { accessToken, refreshToken, email } = await request.json()

    // Validate tokens
    if (!accessToken || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Find user's organization
    const orgMember = await prisma.orgMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!orgMember) {
      return NextResponse.json(
        { error: 'User not in organization' },
        { status: 400 }
      )
    }

    // Create or update email account
    const emailAccount = await prisma.emailAccount.upsert({
      where: {
        orgId_email: {
          email,
          orgId: orgMember.organizationId,
        },
      },
      create: {
        email,
        provider: 'MICROSOFT',
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
    console.error('Microsoft OAuth save error:', error)
    return NextResponse.json(
      { error: 'Failed to save account' },
      { status: 500 }
    )
  }
}

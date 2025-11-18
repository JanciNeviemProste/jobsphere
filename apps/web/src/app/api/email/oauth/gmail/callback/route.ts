/**
 * Gmail OAuth Callback
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/encryption'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?error=oauth_failed`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?error=invalid_callback`
      )
    }

    // Verify state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    const { userId, timestamp } = stateData

    if (Date.now() - timestamp > 5 * 60 * 1000) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?error=state_expired`
      )
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/email/oauth/gmail/callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      console.error('Token exchange failed')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?error=token_failed`
      )
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokens

    // Get user email
    const userResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!userResponse.ok) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?error=user_info_failed`
      )
    }

    const user = await userResponse.json()
    const email = user.email

    // Find organization
    const orgMember = await prisma.orgMember.findFirst({
      where: { userId },
    })

    if (!orgMember) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?error=no_org`
      )
    }

    // Encrypt OAuth tokens before storing
    const encryptedTokens = encrypt(JSON.stringify({
      access_token,
      refresh_token,
      expires_in,
      token_type: 'Bearer',
      expiry_date: Date.now() + (expires_in * 1000),
    }))

    // Save email account
    await prisma.emailAccount.upsert({
      where: {
        orgId_email: {
          email,
          orgId: orgMember.orgId,
        },
      },
      create: {
        email,
        provider: 'GMAIL',
        orgId: orgMember.orgId,
        displayName: user.name || email,
        oauthTokens: encryptedTokens,
        active: true,
      },
      update: {
        oauthTokens: encryptedTokens,
        active: true,
        lastSyncAt: new Date(),
      },
    })

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?success=email_connected&email=${encodeURIComponent(email)}`
    )
  } catch (error) {
    console.error('Gmail callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?error=callback_failed`
    )
  }
}

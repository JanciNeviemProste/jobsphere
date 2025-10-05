/**
 * Microsoft OAuth Callback
 * Spracuje authorization code a získa access token
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const MICROSOFT_GRAPH_URL = 'https://graph.microsoft.com/v1.0'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Check for errors
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

    // Check state freshness (5 minutes)
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?error=state_expired`
      )
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/email/oauth/microsoft/callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?error=token_failed`
      )
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokens

    // Get user email from Microsoft Graph
    const userResponse = await fetch(`${MICROSOFT_GRAPH_URL}/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!userResponse.ok) {
      console.error('Failed to get user info')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?error=user_info_failed`
      )
    }

    const user = await userResponse.json()
    const email = user.mail || user.userPrincipalName

    // Find user's organization
    const orgMember = await prisma.orgMember.findFirst({
      where: { userId },
    })

    if (!orgMember) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?error=no_org`
      )
    }

    // Save email account
    await prisma.emailAccount.upsert({
      where: {
        email_organizationId: {
          email,
          organizationId: orgMember.organizationId,
        },
      },
      create: {
        email,
        provider: 'MICROSOFT',
        organizationId: orgMember.organizationId,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
        isActive: true,
      },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
        isActive: true,
      },
    })

    // Redirect to settings with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?success=email_connected&email=${encodeURIComponent(email)}`
    )
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?error=callback_failed`
    )
  }
}

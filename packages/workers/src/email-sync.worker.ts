/**
 * Email Sync Worker
 * Synchronizuje emaily z Microsoft/Gmail pomocou BullMQ
 */

import { Queue, Worker, Job } from 'bullmq'
import { prisma } from '@/lib/db'
import { Redis } from '@upstash/redis'

// Vercel KV (Redis) connection
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// BullMQ Queue
export const emailSyncQueue = new Queue('email-sync', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
})

interface EmailSyncJobData {
  emailAccountId: string
  syncType: 'full' | 'incremental'
}

/**
 * Sync Microsoft emails using Graph API
 */
async function syncMicrosoftEmails(emailAccount: any) {
  const GRAPH_API = 'https://graph.microsoft.com/v1.0'

  // Check token expiry
  if (new Date(emailAccount.tokenExpiresAt) < new Date()) {
    // Refresh token
    await refreshMicrosoftToken(emailAccount)
  }

  // Fetch messages
  const messagesResponse = await fetch(
    `${GRAPH_API}/me/messages?$top=50&$orderby=receivedDateTime desc`,
    {
      headers: {
        Authorization: `Bearer ${emailAccount.accessToken}`,
      },
    }
  )

  if (!messagesResponse.ok) {
    throw new Error('Failed to fetch Microsoft emails')
  }

  const data = await messagesResponse.json()
  const messages = data.value

  // Process each message
  for (const msg of messages) {
    // Check if message already exists
    const existingMessage = await prisma.emailMessage.findUnique({
      where: { providerMessageId: msg.id },
    })

    if (existingMessage) continue

    // Find or create thread
    const thread = await prisma.emailThread.upsert({
      where: {
        providerThreadId_emailAccountId: {
          providerThreadId: msg.conversationId,
          emailAccountId: emailAccount.id,
        },
      },
      create: {
        providerThreadId: msg.conversationId,
        emailAccountId: emailAccount.id,
        subject: msg.subject,
        participantEmails: [
          msg.from?.emailAddress?.address,
          ...msg.toRecipients.map((r: any) => r.emailAddress?.address),
        ].filter(Boolean),
        lastMessageAt: new Date(msg.receivedDateTime),
      },
      update: {
        lastMessageAt: new Date(msg.receivedDateTime),
      },
    })

    // Create message
    await prisma.emailMessage.create({
      data: {
        providerMessageId: msg.id,
        threadId: thread.id,
        from: msg.from?.emailAddress?.address || '',
        to: msg.toRecipients.map((r: any) => r.emailAddress?.address),
        cc: msg.ccRecipients?.map((r: any) => r.emailAddress?.address) || [],
        subject: msg.subject,
        bodyHtml: msg.body?.content || '',
        bodyText: msg.bodyPreview || '',
        sentAt: new Date(msg.sentDateTime),
        receivedAt: new Date(msg.receivedDateTime),
        isRead: msg.isRead,
      },
    })
  }

  // Update last sync time
  await prisma.emailAccount.update({
    where: { id: emailAccount.id },
    data: { lastSyncedAt: new Date() },
  })
}

/**
 * Sync Gmail emails using Gmail API
 */
async function syncGmailEmails(emailAccount: any) {
  const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1'

  // Check token expiry
  if (new Date(emailAccount.tokenExpiresAt) < new Date()) {
    await refreshGmailToken(emailAccount)
  }

  // Fetch messages
  const listResponse = await fetch(
    `${GMAIL_API}/users/me/messages?maxResults=50`,
    {
      headers: {
        Authorization: `Bearer ${emailAccount.accessToken}`,
      },
    }
  )

  if (!listResponse.ok) {
    throw new Error('Failed to fetch Gmail messages')
  }

  const list = await listResponse.json()
  const messageIds = list.messages || []

  // Fetch each message detail
  for (const { id } of messageIds) {
    // Check if exists
    const existingMessage = await prisma.emailMessage.findUnique({
      where: { providerMessageId: id },
    })

    if (existingMessage) continue

    // Fetch full message
    const msgResponse = await fetch(`${GMAIL_API}/users/me/messages/${id}`, {
      headers: {
        Authorization: `Bearer ${emailAccount.accessToken}`,
      },
    })

    if (!msgResponse.ok) continue

    const msg = await msgResponse.json()

    // Parse headers
    const headers = msg.payload.headers.reduce((acc: any, h: any) => {
      acc[h.name.toLowerCase()] = h.value
      return acc
    }, {})

    const from = headers['from']
    const to = headers['to']?.split(',') || []
    const cc = headers['cc']?.split(',') || []
    const subject = headers['subject']

    // Find or create thread
    const thread = await prisma.emailThread.upsert({
      where: {
        providerThreadId_emailAccountId: {
          providerThreadId: msg.threadId,
          emailAccountId: emailAccount.id,
        },
      },
      create: {
        providerThreadId: msg.threadId,
        emailAccountId: emailAccount.id,
        subject,
        participantEmails: [from, ...to, ...cc].filter(Boolean),
        lastMessageAt: new Date(parseInt(msg.internalDate)),
      },
      update: {
        lastMessageAt: new Date(parseInt(msg.internalDate)),
      },
    })

    // Get body
    let bodyHtml = ''
    let bodyText = msg.snippet

    if (msg.payload.body?.data) {
      bodyText = Buffer.from(msg.payload.body.data, 'base64').toString()
    }

    // Create message
    await prisma.emailMessage.create({
      data: {
        providerMessageId: id,
        threadId: thread.id,
        from,
        to,
        cc,
        subject,
        bodyHtml,
        bodyText,
        sentAt: new Date(parseInt(msg.internalDate)),
        receivedAt: new Date(parseInt(msg.internalDate)),
        isRead: msg.labelIds?.includes('UNREAD') === false,
      },
    })
  }

  // Update last sync
  await prisma.emailAccount.update({
    where: { id: emailAccount.id },
    data: { lastSyncedAt: new Date() },
  })
}

/**
 * Refresh Microsoft access token
 */
async function refreshMicrosoftToken(emailAccount: any) {
  const response = await fetch(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: emailAccount.refreshToken,
        grant_type: 'refresh_token',
      }),
    }
  )

  if (!response.ok) {
    throw new Error('Failed to refresh Microsoft token')
  }

  const tokens = await response.json()

  await prisma.emailAccount.update({
    where: { id: emailAccount.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || emailAccount.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  })
}

/**
 * Refresh Gmail access token
 */
async function refreshGmailToken(emailAccount: any) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: emailAccount.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh Gmail token')
  }

  const tokens = await response.json()

  await prisma.emailAccount.update({
    where: { id: emailAccount.id },
    data: {
      accessToken: tokens.access_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  })
}

/**
 * BullMQ Worker - processes email sync jobs
 */
export const emailSyncWorker = new Worker<EmailSyncJobData>(
  'email-sync',
  async (job: Job<EmailSyncJobData>) => {
    const { emailAccountId, syncType } = job.data

    console.log(`[Email Sync] Starting ${syncType} sync for account ${emailAccountId}`)

    try {
      // Fetch email account
      const emailAccount = await prisma.emailAccount.findUnique({
        where: { id: emailAccountId },
      })

      if (!emailAccount || !emailAccount.isActive) {
        throw new Error('Email account not found or inactive')
      }

      // Sync based on provider
      if (emailAccount.provider === 'MICROSOFT') {
        await syncMicrosoftEmails(emailAccount)
      } else if (emailAccount.provider === 'GMAIL') {
        await syncGmailEmails(emailAccount)
      }

      console.log(`[Email Sync] Completed sync for account ${emailAccountId}`)
    } catch (error) {
      console.error(`[Email Sync] Error for account ${emailAccountId}:`, error)
      throw error
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    concurrency: 5,
  }
)

/**
 * Schedule email sync for all active accounts (cron job)
 */
export async function scheduleEmailSyncs() {
  const activeAccounts = await prisma.emailAccount.findMany({
    where: { isActive: true },
  })

  for (const account of activeAccounts) {
    await emailSyncQueue.add(
      'sync',
      {
        emailAccountId: account.id,
        syncType: 'incremental',
      },
      {
        repeat: {
          every: 5 * 60 * 1000, // Every 5 minutes
        },
      }
    )
  }
}

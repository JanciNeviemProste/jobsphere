import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY not set in environment')
  }
  return Buffer.from(key, 'hex')
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':')

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted format')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv)

  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

export function encryptJSON(obj: unknown): string {
  return encrypt(JSON.stringify(obj))
}

export function decryptJSON<T = unknown>(encryptedText: string): T {
  return JSON.parse(decrypt(encryptedText)) as T
}

// Generate new encryption key (run once, store in .env)
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}

// Helper to check if a string is encrypted (contains colons)
export function isEncrypted(value: string): boolean {
  if (typeof value !== 'string') return false
  const parts = value.split(':')
  return parts.length === 3 && parts[0].length === IV_LENGTH * 2
}
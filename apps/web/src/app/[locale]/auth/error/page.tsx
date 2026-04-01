import type { Metadata } from 'next'
import AuthErrorClient from './auth-error-client'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Authentication Error | JobSphere',
    description: 'An authentication error occurred. Please try again.',
  }
}

export default function AuthErrorPage() {
  return <AuthErrorClient />
}

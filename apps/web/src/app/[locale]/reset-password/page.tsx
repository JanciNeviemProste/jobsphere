import type { Metadata } from 'next'
import ResetPasswordClient from './reset-password-client'

type Props = {
  params: { locale: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Reset Password | JobSphere',
    description: 'Set a new password for your JobSphere account.',
  }
}

export default function ResetPasswordPage({ params }: Props) {
  return <ResetPasswordClient params={params} />
}

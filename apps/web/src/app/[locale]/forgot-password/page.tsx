import type { Metadata } from 'next'
import ForgotPasswordClient from './forgot-password-client'

type Props = {
  params: { locale: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Forgot Password | JobSphere',
    description: 'Reset your JobSphere account password.',
  }
}

export default function ForgotPasswordPage({ params }: Props) {
  return <ForgotPasswordClient params={params} />
}

import type { Metadata } from 'next'
import ApplicationDetailClient from './application-detail-client'

type Props = {
  params: { locale: string; id: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Application Detail | JobSphere',
    description: 'View your job application details and status.',
  }
}

export default function ApplicationDetailPage({ params }: Props) {
  return <ApplicationDetailClient params={params} />
}

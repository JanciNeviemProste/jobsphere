import type { Metadata } from 'next'
import NewJobClient from './new-job-client'

type Props = {
  params: { locale: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Post New Job',
    description: 'Create and publish a new job posting for your organization.',
  }
}

export default function NewJobPage({ params }: Props) {
  return <NewJobClient params={params} />
}

import type { Metadata } from 'next'
import ApplyClient from './apply-client'

type Props = {
  params: { id: string; locale: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Apply for Job | JobSphere',
    description: 'Submit your application for this job opportunity.',
  }
}

export default function ApplyPage({ params }: Props) {
  return <ApplyClient params={params} />
}

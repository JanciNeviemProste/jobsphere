import type { Metadata } from 'next'
import TakeAssessmentClient from './take-assessment-client'

type Props = {
  params: { id: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Take Assessment | JobSphere',
    description: 'Complete your skills assessment.',
  }
}

export default function TakeAssessmentPage({ params }: Props) {
  return <TakeAssessmentClient params={params} />
}

import type { Metadata } from 'next'
import AssessmentResultsClient from './assessment-results-client'

type Props = {
  params: { id: string; attemptId: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Assessment Results | JobSphere',
    description: 'View your assessment results and feedback.',
  }
}

export default function AssessmentResultsPage({ params }: Props) {
  return <AssessmentResultsClient params={params} />
}

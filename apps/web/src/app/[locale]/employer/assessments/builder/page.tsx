import type { Metadata } from 'next'
import AssessmentBuilderClient from './assessment-builder-client'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Create Assessment | JobSphere',
    description: 'Build skills assessments with sections and questions for candidates.',
  }
}

export default function AssessmentBuilderPage() {
  return <AssessmentBuilderClient />
}

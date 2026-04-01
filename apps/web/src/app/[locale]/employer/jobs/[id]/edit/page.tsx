import type { Metadata } from 'next'
import EditJobClient from './edit-job-client'

type Props = {
  params: { locale: string; id: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Edit Job | JobSphere',
    description: 'Edit your job posting details and requirements.',
  }
}

export default function EditJobPage({ params }: Props) {
  return <EditJobClient params={params} />
}

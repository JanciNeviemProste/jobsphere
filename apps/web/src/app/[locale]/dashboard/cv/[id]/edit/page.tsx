import type { Metadata } from 'next'
import CVEditClient from './cv-edit-client'

type Props = {
  params: { id: string; locale: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Edit CV | JobSphere',
    description: 'Review and edit your AI-parsed CV data.',
  }
}

export default function CVEditPage({ params }: Props) {
  return <CVEditClient params={params} />
}

import type { Metadata } from 'next'
import CreateCVClient from './create-cv-client'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Create CV | JobSphere',
    description: 'Build your professional CV with AI assistance.',
  }
}

export default function CreateCVPage() {
  return <CreateCVClient />
}

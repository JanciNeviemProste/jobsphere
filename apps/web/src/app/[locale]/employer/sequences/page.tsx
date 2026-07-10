import type { Metadata } from 'next'
import SequencesClient from './sequences-client'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Email Sequences',
    description: 'Create and manage automated email engagement campaigns for candidates.',
  }
}

export default function SequencesPage() {
  return <SequencesClient />
}

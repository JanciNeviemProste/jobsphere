import type { Metadata } from 'next'
import SearchCandidatesClient from './search-candidates-client'

type Props = {
  params: { locale: string; id: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Search Candidates',
    description: 'Find matching candidates for your job posting using AI-powered search.',
  }
}

export default function SearchCandidatesPage({ params }: Props) {
  return <SearchCandidatesClient params={params} />
}

import type { Metadata } from 'next'
import GigsClient from './gigs-client'

export const metadata: Metadata = {
  title: 'Gigs',
}

export default function EmployerGigsPage({ params }: { params: { locale: string } }) {
  return <GigsClient params={params} />
}

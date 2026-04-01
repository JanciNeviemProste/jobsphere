import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import JobsClient from './jobs-client'

type Props = {
  params: { locale: string }
}

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'pageMetadata' })
  return { title: t('jobs.title'), description: t('jobs.description') }
}

export default function JobsPage({ params }: Props) {
  return <JobsClient params={params} />
}

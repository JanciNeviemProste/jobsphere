import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import LoginClient from './login-client'

type Props = {
  params: { locale: string }
}

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'pageMetadata' })
  return { title: t('login.title'), description: t('login.description') }
}

export default function LoginPage({ params }: Props) {
  return <LoginClient params={params} />
}

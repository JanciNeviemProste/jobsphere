import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function AuthErrorFallback({
  searchParams
}: {
  searchParams: { error?: string }
}) {
  // Detekuj preferovaný locale z cookie (next-intl nastavuje NEXT_LOCALE)
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'en'

  // Redirect na locale-aware error page
  const errorParam = searchParams.error ? `?error=${searchParams.error}` : ''
  redirect(`/${locale}/auth/error${errorParam}`)
}

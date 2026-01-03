import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function EmployerLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const session = await auth()

  // Require authentication
  if (!session?.user?.id) {
    redirect(`/${params.locale}/login`)
  }

  // Require organization membership (employers only)
  if (!session?.user?.orgId) {
    redirect(`/${params.locale}/dashboard?error=no_organization`)
  }

  return <>{children}</>
}

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/admin-sidebar'

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/${params.locale}/login`)
  }

  if (!session.user.isGlobalAdmin) {
    redirect(`/${params.locale}/login?error=forbidden`)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar
        locale={params.locale}
        userName={session.user.name ?? undefined}
        userEmail={session.user.email ?? undefined}
      />
      <main className="flex-1 overflow-y-auto bg-slate-50">{children}</main>
    </div>
  )
}

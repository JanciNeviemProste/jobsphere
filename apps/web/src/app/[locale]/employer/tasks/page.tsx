import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { TasksClient } from './tasks-client'

export const metadata: Metadata = { title: 'Tasks' }

/**
 * Follow-ups for the organisation.
 *
 * The Task model and its API were added without anywhere to reach them, which is
 * the same mistake the dead Notification model represented — one layer up.
 */
export default async function TasksPage({ params }: { params: { locale: string } }) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/${params.locale}/login`)
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Tasks</h1>
        <p className="mt-1 text-muted-foreground">Follow-ups you and your team owe someone.</p>
      </div>
      <TasksClient locale={params.locale} />
    </div>
  )
}

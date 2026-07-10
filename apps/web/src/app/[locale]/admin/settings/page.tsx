import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { FeatureFlagToggle } from './_components/feature-flag-toggle'
import { SettingEditDialog } from './_components/setting-edit-dialog'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nastavenia | Admin',
}

export default async function AdminSettingsPage({ params }: { params: { locale: string } }) {
  const session = await auth()
  if (!session?.user?.isGlobalAdmin) {
    redirect(`/${params.locale}/login?error=forbidden`)
  }

  const [settings, flags] = await Promise.all([
    prisma.systemSetting.findMany({ orderBy: { key: 'asc' } }),
    prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }),
  ])

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nastavenia</h1>
        <p className="mt-1 text-sm text-slate-500">Systémové nastavenia a feature flags</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Systémové nastavenia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {settings.length === 0 && (
            <p className="px-6 py-4 text-sm text-slate-500">Žiadne nastavenia</p>
          )}
          {settings.map((setting, idx) => (
            <div key={setting.id}>
              <div className="flex items-center justify-between px-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium text-slate-900">{setting.key}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{JSON.stringify(setting.value)}</p>
                </div>
                <SettingEditDialog settingKey={setting.key} currentValue={String(setting.value)} />
              </div>
              {idx < settings.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feature Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {flags.length === 0 && (
            <p className="px-6 py-4 text-sm text-slate-500">Žiadne feature flags</p>
          )}
          {flags.map((flag, idx) => (
            <div key={flag.id}>
              <div className="flex items-center justify-between px-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium text-slate-900">{flag.key}</p>
                  {flag.name && <p className="mt-0.5 text-xs text-slate-500">{flag.name}</p>}
                  {flag.description && <p className="text-xs text-slate-400">{flag.description}</p>}
                </div>
                <FeatureFlagToggle flagKey={flag.key} enabled={flag.enabled} />
              </div>
              {idx < flags.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

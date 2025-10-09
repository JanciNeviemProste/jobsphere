import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Building2, Globe } from 'lucide-react'

async function getOrganizationData(userId: string) {
  // Get user's organization
  const orgMember = await prisma.orgMember.findFirst({
    where: { userId },
    include: {
      organization: true,
    },
  })

  if (!orgMember) {
    return null
  }

  // Get subscription info if exists
  const subscription = await prisma.subscription.findFirst({
    where: {
      orgId: orgMember.orgId,
      status: 'active',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return {
    organization: orgMember.organization,
    subscription,
  }
}

export default async function EmployerSettingsPage({ params }: { params: { locale: string } }) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/${params.locale}/login`)
  }

  const data = await getOrganizationData(session.user.id)

  if (!data) {
    redirect(`/${params.locale}/employer`)
  }

  const { organization, subscription } = data

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href={`/${params.locale}/employer`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na dashboard
          </Link>
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Nastavenia spoločnosti</h1>
          <p className="text-muted-foreground">Spravujte informácie o vašej spoločnosti</p>
        </div>

        <div className="space-y-6">
          {/* Company Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Informácie o spoločnosti
              </CardTitle>
              <CardDescription>Základné údaje o vašej organizácii</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Názov spoločnosti *</Label>
                  <Input id="companyName" defaultValue={organization.name} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Webstránka</Label>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <Input id="website" type="url" defaultValue={organization.website || ''} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Popis spoločnosti</Label>
                  <textarea
                    id="description"
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Krátky popis vašej spoločnosti..."
                    defaultValue={organization.description || ''}
                  />
                </div>

                <Button type="submit">
                  Uložiť zmeny
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Billing */}
          <Card>
            <CardHeader>
              <CardTitle>Fakturácia a platba</CardTitle>
              <CardDescription>Spravujte vaše predplatné a platobné metódy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-semibold">
                    {subscription ? 'Premium' : 'Starter'} Plan
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {subscription ? 'Active subscription' : 'Free'}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${params.locale}/pricing`}>Zmeniť plán</Link>
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="font-medium">Platobná metóda</p>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-12 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center text-white text-xs font-bold">
                      VISA
                    </div>
                    <div>
                      <p className="text-sm">•••• •••• •••• 4242</p>
                      <p className="text-xs text-muted-foreground">Expires 12/25</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Upraviť</Button>
                </div>
              </div>

              <Button variant="outline" className="w-full">Zobraziť faktúry</Button>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notifikácie</CardTitle>
              <CardDescription>Spravujte, ako a kedy chcete dostávať notifikácie</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email notifikácie</p>
                  <p className="text-sm text-muted-foreground">Dostávajte emaily o nových prihlásenkach</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Týždenný report</p>
                  <p className="text-sm text-muted-foreground">Sumár aktivity každý pondelok</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Marketing emaily</p>
                  <p className="text-sm text-muted-foreground">Tipy a novinky o JobSphere</p>
                </div>
                <input type="checkbox" className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Nebezpečná zóna</CardTitle>
              <CardDescription>Nezvratné akcie pre váš účet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-destructive/50 rounded-lg">
                <div>
                  <p className="font-medium">Zrušiť predplatné</p>
                  <p className="text-sm text-muted-foreground">
                    Stratíte prístup k premium funkciám
                  </p>
                </div>
                <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
                  Zrušiť
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 border border-destructive/50 rounded-lg">
                <div>
                  <p className="font-medium">Zmazať účet</p>
                  <p className="text-sm text-muted-foreground">
                    Permanentne zmazať všetky dáta
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  Zmazať účet
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

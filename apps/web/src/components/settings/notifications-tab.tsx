'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Bell, Loader2, Mail } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface NotificationPreferences {
  emailNotifications: {
    newApplication: boolean
    applicationStatusChange: boolean
    newTeamMember: boolean
    billingUpdates: boolean
    weeklyDigest: boolean
    marketingEmails: boolean
  }
  inAppNotifications: {
    newApplication: boolean
    applicationStatusChange: boolean
    newTeamMember: boolean
    mentions: boolean
  }
  digestFrequency: 'immediate' | 'daily' | 'weekly'
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailNotifications: {
    newApplication: true,
    applicationStatusChange: true,
    newTeamMember: true,
    billingUpdates: true,
    weeklyDigest: true,
    marketingEmails: false,
  },
  inAppNotifications: {
    newApplication: true,
    applicationStatusChange: true,
    newTeamMember: true,
    mentions: true,
  },
  digestFrequency: 'immediate',
}

export function NotificationsTab() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES)

  // Fetch notification preferences
  useEffect(() => {
    async function fetchPreferences() {
      try {
        const response = await fetch('/api/user/preferences')
        if (!response.ok) throw new Error('Failed to fetch preferences')

        const data = await response.json()
        if (data.preferences) {
          setPreferences(data.preferences)
        }
      } catch {
        toast.error('Failed to load notification preferences')
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchPreferences()
    }
  }, [session, toast])

  const handleSave = async () => {
    setSaving(true)

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to save preferences')
      }

      toast.success('Notification preferences saved successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const updateEmailPref = (
    key: keyof NotificationPreferences['emailNotifications'],
    value: boolean,
  ) => {
    setPreferences({
      ...preferences,
      emailNotifications: {
        ...preferences.emailNotifications,
        [key]: value,
      },
    })
  }

  const updateInAppPref = (
    key: keyof NotificationPreferences['inAppNotifications'],
    value: boolean,
  ) => {
    setPreferences({
      ...preferences,
      inAppNotifications: {
        ...preferences.inAppNotifications,
        [key]: value,
      },
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>Choose what email notifications you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-new-app">New Application Received</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when a candidate applies to one of your jobs
                </p>
              </div>
              <Switch
                id="email-new-app"
                checked={preferences.emailNotifications.newApplication}
                onCheckedChange={(checked) => updateEmailPref('newApplication', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-status-change">Application Status Changed</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when an application moves to a different stage
                </p>
              </div>
              <Switch
                id="email-status-change"
                checked={preferences.emailNotifications.applicationStatusChange}
                onCheckedChange={(checked) => updateEmailPref('applicationStatusChange', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-team">New Team Member Added</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when someone joins your organization
                </p>
              </div>
              <Switch
                id="email-team"
                checked={preferences.emailNotifications.newTeamMember}
                onCheckedChange={(checked) => updateEmailPref('newTeamMember', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-billing">Billing Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about invoices, payment failures, and subscription changes
                </p>
              </div>
              <Switch
                id="email-billing"
                checked={preferences.emailNotifications.billingUpdates}
                onCheckedChange={(checked) => updateEmailPref('billingUpdates', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-weekly">Weekly Activity Digest</Label>
                <p className="text-sm text-muted-foreground">
                  Receive a summary of your recruitment activity every Monday
                </p>
              </div>
              <Switch
                id="email-weekly"
                checked={preferences.emailNotifications.weeklyDigest}
                onCheckedChange={(checked) => updateEmailPref('weeklyDigest', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-marketing">Marketing Emails</Label>
                <p className="text-sm text-muted-foreground">
                  Tips, feature updates, and product news from JobSphere
                </p>
              </div>
              <Switch
                id="email-marketing"
                checked={preferences.emailNotifications.marketingEmails}
                onCheckedChange={(checked) => updateEmailPref('marketingEmails', checked)}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="digest-freq">Email Digest Frequency</Label>
            <Select
              value={preferences.digestFrequency}
              onValueChange={(value: 'immediate' | 'daily' | 'weekly') =>
                setPreferences({ ...preferences, digestFrequency: value })
              }
            >
              <SelectTrigger id="digest-freq" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="daily">Daily Digest</SelectItem>
                <SelectItem value="weekly">Weekly Digest</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often you want to receive grouped notifications
            </p>
          </div>
        </CardContent>
      </Card>

      {/* In-App Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            In-App Notifications
          </CardTitle>
          <CardDescription>Manage notifications shown within the application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="app-new-app">New Application Received</Label>
              <p className="text-sm text-muted-foreground">
                Show notification badge for new applications
              </p>
            </div>
            <Switch
              id="app-new-app"
              checked={preferences.inAppNotifications.newApplication}
              onCheckedChange={(checked) => updateInAppPref('newApplication', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="app-status">Application Status Changed</Label>
              <p className="text-sm text-muted-foreground">
                Show notification when applications are updated
              </p>
            </div>
            <Switch
              id="app-status"
              checked={preferences.inAppNotifications.applicationStatusChange}
              onCheckedChange={(checked) => updateInAppPref('applicationStatusChange', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="app-team">New Team Member</Label>
              <p className="text-sm text-muted-foreground">
                Show notification when someone joins your team
              </p>
            </div>
            <Switch
              id="app-team"
              checked={preferences.inAppNotifications.newTeamMember}
              onCheckedChange={(checked) => updateInAppPref('newTeamMember', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="app-mentions">Mentions</Label>
              <p className="text-sm text-muted-foreground">
                Show notification when someone mentions you in a comment
              </p>
            </div>
            <Switch
              id="app-mentions"
              checked={preferences.inAppNotifications.mentions}
              onCheckedChange={(checked) => updateInAppPref('mentions', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Preferences
        </Button>
        <Button variant="outline" onClick={() => setPreferences(DEFAULT_PREFERENCES)}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Building2, Globe, Loader2 } from 'lucide-react'

interface OrganizationData {
  id: string
  name: string
  logo?: string | null
  website?: string | null
  description?: string | null
  industry?: string | null
  size?: string | null
}

const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Manufacturing',
  'Retail',
  'Consulting',
  'Marketing',
  'Other'
]

const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+'
]

export function ProfileTab() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [orgData, setOrgData] = useState<OrganizationData | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    description: '',
    industry: '',
    size: ''
  })

  // Fetch organization data
  useEffect(() => {
    async function fetchOrganization() {
      try {
        const response = await fetch('/api/organizations/current')
        if (!response.ok) throw new Error('Failed to fetch organization')

        const data = await response.json()
        setOrgData(data)
        setFormData({
          name: data.name || '',
          website: data.website || '',
          description: data.description || '',
          industry: data.industry || '',
          size: data.size || ''
        })
      } catch (error) {
        toast.error('Failed to load organization data')
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchOrganization()
    }
  }, [session, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch(`/api/organizations/${orgData?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update organization')
      }

      const updated = await response.json()
      setOrgData(updated)

      toast.success('Organization updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update organization')
    } finally {
      setSaving(false)
    }
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Company Profile
        </CardTitle>
        <CardDescription>Update your organization information and branding</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Company Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Acme Corporation"
            />
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
          </div>

          {/* Industry */}
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Select
              value={formData.industry}
              onValueChange={(value) => setFormData({ ...formData, industry: value })}
            >
              <SelectTrigger id="industry">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((industry) => (
                  <SelectItem key={industry} value={industry}>
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Company Size */}
          <div className="space-y-2">
            <Label htmlFor="size">Company Size</Label>
            <Select
              value={formData.size}
              onValueChange={(value) => setFormData({ ...formData, size: value })}
            >
              <SelectTrigger id="size">
                <SelectValue placeholder="Select company size" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size} employees
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Company Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              placeholder="Tell us about your company..."
            />
            <p className="text-xs text-muted-foreground">
              This description will be shown on your job postings
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (orgData) {
                  setFormData({
                    name: orgData.name || '',
                    website: orgData.website || '',
                    description: orgData.description || '',
                    industry: orgData.industry || '',
                    size: orgData.size || ''
                  })
                }
              }}
            >
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

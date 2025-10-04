'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, Download, ArrowLeft } from 'lucide-react'

const MOCK_APPLICANTS = [
  {
    id: '1',
    name: 'Peter Kováč',
    email: 'peter.kovac@example.com',
    jobTitle: 'Senior React Developer',
    status: 'NEW',
    appliedAt: '2024-10-03',
    match: 92,
    experience: '5 rokov',
  },
  {
    id: '2',
    name: 'Jana Horvátová',
    email: 'jana.horvatova@example.com',
    jobTitle: 'Senior React Developer',
    status: 'REVIEWING',
    appliedAt: '2024-10-02',
    match: 88,
    experience: '4 roky',
  },
  {
    id: '3',
    name: 'Martin Szabó',
    email: 'martin.szabo@example.com',
    jobTitle: 'Backend Developer',
    status: 'INTERVIEWED',
    appliedAt: '2024-10-01',
    match: 85,
    experience: '6 rokov',
  },
  {
    id: '4',
    name: 'Lucia Mináriková',
    email: 'lucia.minarikova@example.com',
    jobTitle: 'Backend Developer',
    status: 'REJECTED',
    appliedAt: '2024-09-30',
    match: 65,
    experience: '2 roky',
  },
  {
    id: '5',
    name: 'Tomáš Novák',
    email: 'tomas.novak@example.com',
    jobTitle: 'DevOps Engineer',
    status: 'ACCEPTED',
    appliedAt: '2024-09-28',
    match: 95,
    experience: '7 rokov',
  },
]

export default function ApplicantsPage({ params }: { params: { locale: string } }) {
  const t = useTranslations()
  const locale = params.locale
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')

  const filteredApplicants = MOCK_APPLICANTS.filter((applicant) => {
    const matchesSearch =
      applicant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      applicant.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      applicant.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = selectedStatus === 'ALL' || applicant.status === selectedStatus

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <Badge>Nový</Badge>
      case 'REVIEWING':
        return <Badge variant="secondary">Preveruje sa</Badge>
      case 'INTERVIEWED':
        return <Badge className="bg-blue-600">Interview</Badge>
      case 'ACCEPTED':
        return <Badge className="bg-green-600">Prijatý</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">Zamietnutý</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const stats = {
    total: MOCK_APPLICANTS.length,
    new: MOCK_APPLICANTS.filter(a => a.status === 'NEW').length,
    reviewing: MOCK_APPLICANTS.filter(a => a.status === 'REVIEWING').length,
    interviewed: MOCK_APPLICANTS.filter(a => a.status === 'INTERVIEWED').length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href={`/${locale}/employer`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na dashboard
          </Link>
        </Button>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Všetci kandidáti</h1>
            <p className="text-muted-foreground">Prehľad všetkých prihlášok</p>
          </div>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Celkovo</CardTitle>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Nové</CardTitle>
              <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">V procese</CardTitle>
              <div className="text-2xl font-bold text-orange-600">{stats.reviewing}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Interview</CardTitle>
              <div className="text-2xl font-bold text-purple-600">{stats.interviewed}</div>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hľadať kandidátov..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={selectedStatus === 'ALL' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedStatus('ALL')}
                >
                  Všetci
                </Button>
                <Button
                  variant={selectedStatus === 'NEW' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedStatus('NEW')}
                >
                  Nové
                </Button>
                <Button
                  variant={selectedStatus === 'REVIEWING' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedStatus('REVIEWING')}
                >
                  V procese
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Applicants List */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {filteredApplicants.map((applicant) => (
                <div
                  key={applicant.id}
                  className="flex items-center justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-semibold text-primary">
                          {applicant.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold">{applicant.name}</h3>
                        <p className="text-sm text-muted-foreground">{applicant.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground ml-13">
                      <span>{applicant.jobTitle}</span>
                      <span>•</span>
                      <span>{applicant.experience} skúseností</span>
                      <span>•</span>
                      <span>Prihlásený {new Date(applicant.appliedAt).toLocaleDateString('sk-SK')}</span>
                      <span>•</span>
                      <span className="text-primary font-medium">{applicant.match}% match</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(applicant.status)}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${locale}/employer/applicants/${applicant.id}`}>
                        Detail
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}

              {filteredApplicants.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Nenašli sa žiadni kandidáti zodpovedajúci vašim kritériám.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

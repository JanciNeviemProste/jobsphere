'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, Briefcase, Clock, Euro, Search, Filter } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Mock data - neskôr bude z databázy
const MOCK_JOBS = [
  {
    id: '1',
    title: 'Senior React Developer',
    company: 'TechCorp SK',
    location: 'Bratislava, Slovakia',
    salary: '3000 - 5000',
    type: 'FULL_TIME',
    workMode: 'HYBRID',
    seniority: 'SENIOR',
    description: 'Hľadáme skúseného React vývojára do nášho tímu...',
    postedAt: '2 dni dozadu',
  },
  {
    id: '2',
    title: 'Frontend Developer',
    company: 'Digital Solutions',
    location: 'Praha, Czech Republic',
    salary: '2500 - 4000',
    type: 'FULL_TIME',
    workMode: 'REMOTE',
    seniority: 'MEDIOR',
    description: 'Staň sa súčasťou nášho dynamického tímu...',
    postedAt: '5 dní dozadu',
  },
  {
    id: '3',
    title: 'Full Stack Developer',
    company: 'Innovation Labs',
    location: 'Viedeň, Austria',
    salary: '4000 - 6500',
    type: 'FULL_TIME',
    workMode: 'ONSITE',
    seniority: 'SENIOR',
    description: 'Pridaj sa k nám a pracuj na najnovších technológiách...',
    postedAt: '1 týždeň dozadu',
  },
  {
    id: '4',
    title: 'Junior JavaScript Developer',
    company: 'StartupHub',
    location: 'Košice, Slovakia',
    salary: '1500 - 2200',
    type: 'FULL_TIME',
    workMode: 'HYBRID',
    seniority: 'JUNIOR',
    description: 'Ideálna príležitosť pre začiatočníkov...',
    postedAt: '3 dni dozadu',
  },
  {
    id: '5',
    title: 'React Native Developer',
    company: 'Mobile First',
    location: 'Brno, Czech Republic',
    salary: '2800 - 4200',
    type: 'FULL_TIME',
    workMode: 'REMOTE',
    seniority: 'MEDIOR',
    description: 'Vyvíjaj mobilné aplikácie pre milióny používateľov...',
    postedAt: '4 dni dozadu',
  },
  {
    id: '6',
    title: 'Lead Frontend Engineer',
    company: 'Enterprise Solutions',
    location: 'Berlín, Germany',
    salary: '5500 - 8000',
    type: 'FULL_TIME',
    workMode: 'HYBRID',
    seniority: 'LEAD',
    description: 'Veď náš frontend tím a navrhuj architektúru...',
    postedAt: '6 dní dozadu',
  },
]

const WORK_MODES = ['REMOTE', 'HYBRID', 'ONSITE']
const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT']
const SENIORITY_LEVELS = ['JUNIOR', 'MEDIOR', 'SENIOR', 'LEAD']

export default function JobsPage({ params }: { params: { locale: string } }) {
  const t = useTranslations()
  const locale = params.locale
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWorkModes, setSelectedWorkModes] = useState<string[]>([])
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([])
  const [selectedSeniority, setSelectedSeniority] = useState<string[]>([])

  const filteredJobs = MOCK_JOBS.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesWorkMode = selectedWorkModes.length === 0 || selectedWorkModes.includes(job.workMode)
    const matchesJobType = selectedJobTypes.length === 0 || selectedJobTypes.includes(job.type)
    const matchesSeniority = selectedSeniority.length === 0 || selectedSeniority.includes(job.seniority)

    return matchesSearch && matchesWorkMode && matchesJobType && matchesSeniority
  })

  const toggleFilter = (value: string, selected: string[], setter: (values: string[]) => void) => {
    if (selected.includes(value)) {
      setter(selected.filter((item) => item !== value))
    } else {
      setter([...selected, value])
    }
  }

  const getWorkModeLabel = (mode: string) => {
    switch (mode) {
      case 'REMOTE': return t('jobs.remote')
      case 'HYBRID': return t('jobs.hybrid')
      case 'ONSITE': return t('jobs.onsite')
      default: return mode
    }
  }

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'FULL_TIME': return t('jobs.fullTime')
      case 'PART_TIME': return t('jobs.partTime')
      case 'CONTRACT': return t('jobs.contract')
      default: return type
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t('jobs.title')}</h1>
          <p className="text-muted-foreground">
            {filteredJobs.length} {filteredJobs.length === 1 ? t('jobs.offer') : t('jobs.offers')} {t('jobs.found')}
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('jobs.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            {/* Work Mode Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  {t('jobs.workMode')}
                  {selectedWorkModes.length > 0 && (
                    <Badge variant="secondary" className="ml-1 rounded-full">
                      {selectedWorkModes.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{t('jobs.workMode')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {WORK_MODES.map((mode) => (
                  <DropdownMenuCheckboxItem
                    key={mode}
                    checked={selectedWorkModes.includes(mode)}
                    onCheckedChange={() => toggleFilter(mode, selectedWorkModes, setSelectedWorkModes)}
                  >
                    {getWorkModeLabel(mode)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Job Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Briefcase className="h-4 w-4" />
                  {t('jobs.jobType')}
                  {selectedJobTypes.length > 0 && (
                    <Badge variant="secondary" className="ml-1 rounded-full">
                      {selectedJobTypes.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{t('jobs.jobType')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {JOB_TYPES.map((type) => (
                  <DropdownMenuCheckboxItem
                    key={type}
                    checked={selectedJobTypes.includes(type)}
                    onCheckedChange={() => toggleFilter(type, selectedJobTypes, setSelectedJobTypes)}
                  >
                    {getJobTypeLabel(type)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Seniority Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Clock className="h-4 w-4" />
                  {t('jobs.seniority')}
                  {selectedSeniority.length > 0 && (
                    <Badge variant="secondary" className="ml-1 rounded-full">
                      {selectedSeniority.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{t('jobs.seniorityLevel')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SENIORITY_LEVELS.map((level) => (
                  <DropdownMenuCheckboxItem
                    key={level}
                    checked={selectedSeniority.includes(level)}
                    onCheckedChange={() => toggleFilter(level, selectedSeniority, setSelectedSeniority)}
                  >
                    {level}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Jobs Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredJobs.map((job) => (
            <Card key={job.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-2">{job.title}</CardTitle>
                    <CardDescription className="mt-1">{job.company}</CardDescription>
                  </div>
                  <Badge variant="secondary">{job.seniority}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {job.location}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Euro className="h-4 w-4" />
                  {job.salary} € / {t('jobs.perMonth')}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{getWorkModeLabel(job.workMode)}</Badge>
                  <Badge variant="outline">{getJobTypeLabel(job.type)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {job.description}
                </p>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{job.postedAt}</span>
                <Button asChild size="sm">
                  <Link href={`/${locale}/jobs/${job.id}`}>{t('jobs.viewDetail')}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {filteredJobs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              {t('jobs.noResults')}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery('')
                setSelectedWorkModes([])
                setSelectedJobTypes([])
                setSelectedSeniority([])
              }}
            >
              {t('jobs.resetFilters')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, Briefcase, Clock, Euro, Search, Filter, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'
import { sk, cs, pl, de, enUS } from 'date-fns/locale'
import { RecommendedJobsSection } from '@/components/jobs/RecommendedJobsSection'

// Job type from database
interface Job {
  id: string
  title: string
  location: string
  description?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  workMode: string
  type: string
  seniority?: string | null
  status: string
  createdAt: string
  organization: {
    name: string
    logo?: string | null
  }
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Get date locale based on current locale
function getDateLocale(locale: string) {
  switch (locale) {
    case 'sk':
      return sk
    case 'cs':
      return cs
    case 'pl':
      return pl
    case 'de':
      return de
    default:
      return enUS
  }
}

// Constants

const WORK_MODES = ['REMOTE', 'HYBRID', 'ONSITE']
const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT']
const SENIORITY_LEVELS = ['JUNIOR', 'MEDIOR', 'SENIOR', 'LEAD']

export default function JobsPage({ params }: { params: { locale: string } }) {
  const t = useTranslations()
  const locale = params.locale
  const dateLocale = getDateLocale(locale)

  // State
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWorkModes, setSelectedWorkModes] = useState<string[]>([])
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([])
  const [selectedSeniority, setSelectedSeniority] = useState<string[]>([])

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 500)

  // Fetch jobs from API
  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Build query parameters
      const params = new URLSearchParams()

      if (debouncedSearch) {
        params.append('search', debouncedSearch)
      }

      // Add single filters (API expects single value for these)
      if (selectedWorkModes.length === 1) {
        params.append('workMode', selectedWorkModes[0])
      }
      if (selectedJobTypes.length === 1) {
        params.append('jobType', selectedJobTypes[0])
      }
      if (selectedSeniority.length === 1) {
        params.append('seniority', selectedSeniority[0])
      }

      const response = await fetch(`/api/jobs?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.statusText}`)
      }

      const data = await response.json()

      // If multiple filters selected, filter client-side
      let filteredData = data
      if (selectedWorkModes.length > 1) {
        filteredData = filteredData.filter((job: Job) => selectedWorkModes.includes(job.workMode))
      }
      if (selectedJobTypes.length > 1) {
        filteredData = filteredData.filter((job: Job) => selectedJobTypes.includes(job.type))
      }
      if (selectedSeniority.length > 1) {
        filteredData = filteredData.filter(
          (job: Job) => job.seniority && selectedSeniority.includes(job.seniority),
        )
      }

      setJobs(filteredData)
    } catch (err) {
      console.error('Error fetching jobs:', err)
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, selectedWorkModes, selectedJobTypes, selectedSeniority])

  // Fetch jobs when filters change
  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const toggleFilter = (value: string, selected: string[], setter: (values: string[]) => void) => {
    if (selected.includes(value)) {
      setter(selected.filter((item) => item !== value))
    } else {
      setter([...selected, value])
    }
  }

  const getWorkModeLabel = (mode: string) => {
    switch (mode) {
      case 'REMOTE':
        return t('jobs.remote')
      case 'HYBRID':
        return t('jobs.hybrid')
      case 'ONSITE':
        return t('jobs.onsite')
      default:
        return mode
    }
  }

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'FULL_TIME':
        return t('jobs.fullTime')
      case 'PART_TIME':
        return t('jobs.partTime')
      case 'CONTRACT':
        return t('jobs.contract')
      default:
        return type
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold">{t('jobs.title')}</h1>
          <p className="text-muted-foreground">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('jobs.loading')}
              </span>
            ) : (
              <>
                {jobs.length} {jobs.length === 1 ? t('jobs.offer') : t('jobs.offers')}{' '}
                {t('jobs.found')}
              </>
            )}
          </p>
        </div>

        {/* Recommended Jobs Section */}
        <RecommendedJobsSection locale={locale} />

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
                    onCheckedChange={() =>
                      toggleFilter(mode, selectedWorkModes, setSelectedWorkModes)
                    }
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
                    onCheckedChange={() =>
                      toggleFilter(type, selectedJobTypes, setSelectedJobTypes)
                    }
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
                    onCheckedChange={() =>
                      toggleFilter(level, selectedSeniority, setSelectedSeniority)
                    }
                  >
                    {level}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Jobs Grid */}
        {error ? (
          <div className="py-12 text-center">
            <p className="mb-4 text-lg text-destructive">{error}</p>
            <Button variant="outline" onClick={() => fetchJobs()}>
              {t('jobs.retry')}
            </Button>
          </div>
        ) : loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, index) => (
              <Card key={index} className="flex flex-col">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="mt-2 h-4 w-1/2" />
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-8 w-full" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="ml-auto h-9 w-24" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <Card key={job.id} className="flex flex-col transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="line-clamp-2">{job.title}</CardTitle>
                      <CardDescription className="mt-1">{job.organization.name}</CardDescription>
                    </div>
                    {job.seniority && <Badge variant="secondary">{job.seniority}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {job.location}
                  </div>
                  {(job.salaryMin || job.salaryMax) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Euro className="h-4 w-4" />
                      {job.salaryMin && job.salaryMax
                        ? `${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}`
                        : job.salaryMin
                          ? `${job.salaryMin.toLocaleString()}+`
                          : `až ${job.salaryMax?.toLocaleString()}`}{' '}
                      € / {t('jobs.perMonth')}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{getWorkModeLabel(job.workMode)}</Badge>
                    <Badge variant="outline">{getJobTypeLabel(job.type)}</Badge>
                  </div>
                  {job.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{job.description}</p>
                  )}
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(job.createdAt), {
                      addSuffix: true,
                      locale: dateLocale,
                    })}
                  </span>
                  <Button asChild size="sm">
                    <Link href={`/${locale}/jobs/${job.id}`}>{t('jobs.viewDetail')}</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-lg text-muted-foreground">{t('jobs.noResults')}</p>
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

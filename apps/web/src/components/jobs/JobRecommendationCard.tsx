'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Euro, TrendingUp } from 'lucide-react'

interface JobRecommendation {
  id: string
  title: string
  company: string
  companyLogo?: string | null
  location: string
  salaryMin?: number | null
  salaryMax?: number | null
  type: string
  workMode: string
  seniority?: string | null
  match: number
  matchDetails?: {
    skills: number
    experience: number
    education: number
    location: number
    salary: number
    matchedSkills: string[]
    missingSkills: string[]
  }
}

interface JobRecommendationCardProps {
  job: JobRecommendation
  locale: string
}

export function JobRecommendationCard({ job, locale }: JobRecommendationCardProps) {
  const t = useTranslations()

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

  const getMatchColor = (match: number) => {
    if (match >= 80) return 'text-green-600 dark:text-green-500'
    if (match >= 60) return 'text-blue-600 dark:text-blue-500'
    if (match >= 40) return 'text-yellow-600 dark:text-yellow-500'
    return 'text-gray-600 dark:text-gray-500'
  }

  return (
    <Card className="flex flex-col border-2 border-primary/20 transition-shadow hover:shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="line-clamp-2 flex items-center gap-2">
              {job.title}
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardTitle>
            <CardDescription className="mt-1">{job.company}</CardDescription>
          </div>
          {job.seniority && <Badge variant="secondary">{job.seniority}</Badge>}
        </div>

        {/* Match Score Badge */}
        <div className="mt-3">
          <Badge variant="default" className="px-3 py-1 text-base">
            <span className={getMatchColor(job.match)}>{Math.round(job.match)}% Match</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {/* Location */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {job.location}
        </div>

        {/* Salary */}
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

        {/* Work Mode & Type Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{getWorkModeLabel(job.workMode)}</Badge>
          <Badge variant="outline">{getJobTypeLabel(job.type)}</Badge>
        </div>

        {/* Match Details (if available) */}
        {job.matchDetails && (
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-medium text-muted-foreground">{t('jobs.matchBreakdown')}:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {job.matchDetails.skills > 0 && (
                <div className="flex justify-between">
                  <span>{t('jobs.skills')}:</span>
                  <span className="font-medium">{Math.round(job.matchDetails.skills)}%</span>
                </div>
              )}
              {job.matchDetails.experience > 0 && (
                <div className="flex justify-between">
                  <span>{t('jobs.experience')}:</span>
                  <span className="font-medium">{Math.round(job.matchDetails.experience)}%</span>
                </div>
              )}
            </div>

            {/* Matched Skills */}
            {job.matchDetails.matchedSkills && job.matchDetails.matchedSkills.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 text-xs text-muted-foreground">{t('jobs.matchedSkills')}:</p>
                <div className="flex flex-wrap gap-1">
                  {job.matchDetails.matchedSkills.slice(0, 5).map((skill, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {job.matchDetails.matchedSkills.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{job.matchDetails.matchedSkills.length - 5}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <span className="text-xs italic text-muted-foreground">{t('jobs.recommendedForYou')}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/jobs/${job.id}`}>{t('jobs.viewDetail')}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/${locale}/jobs/${job.id}#apply`}>{t('jobs.apply')}</Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

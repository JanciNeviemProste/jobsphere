'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { JobRecommendationCard } from './JobRecommendationCard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { logger } from '@/lib/logger'

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

interface RecommendedJobsSectionProps {
  locale: string
}

export function RecommendedJobsSection({ locale }: RecommendedJobsSectionProps) {
  const t = useTranslations()
  const [recommendations, setRecommendations] = useState<JobRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRecommendations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/jobs/recommended')

      if (response.status === 401) {
        // User is not authenticated - don't show recommendations
        setRecommendations([])
        setLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations')
      }

      const data = await response.json()
      setRecommendations(data)
    } catch (err) {
      logger.error('Error fetching recommendations', err)
      setError(err instanceof Error ? err.message : 'Failed to load recommendations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  // Don't render section if loading and no error (user might not be authenticated)
  if (loading && !error) {
    return (
      <div className="mb-12">
        <div className="mb-6 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">{t('jobs.recommendedForYou')}</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <Card key={index} className="flex flex-col">
              <div className="space-y-3 p-6">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Don't render section if there are no recommendations and no error
  if (!loading && recommendations.length === 0 && !error) {
    return null
  }

  // Show error if there was a problem
  if (error) {
    return (
      <div className="mb-12">
        <div className="mb-6 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">{t('jobs.recommendedForYou')}</h2>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="outline" size="sm" onClick={() => fetchRecommendations()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mb-12">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-6 w-6 animate-pulse text-primary" />
        <h2 className="text-2xl font-bold">{t('jobs.recommendedForYou')}</h2>
      </div>

      {/* Info Banner */}
      <div className="mb-6 rounded-lg bg-primary/10 p-4 text-sm text-muted-foreground">
        <p>
          {t('jobs.recommendationsInfo', {
            count: recommendations.length,
          })}
        </p>
      </div>

      {/* Recommendations Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((job) => (
          <JobRecommendationCard key={job.id} job={job} locale={locale} />
        ))}
      </div>

      {/* Separator */}
      <div className="mb-8 mt-12 border-t pt-8">
        <h2 className="mb-2 text-2xl font-bold">{t('jobs.allJobs')}</h2>
        <p className="text-muted-foreground">{t('jobs.browseAllPositions')}</p>
      </div>
    </div>
  )
}

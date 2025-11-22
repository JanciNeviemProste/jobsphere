'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, ArrowLeft, Briefcase, MapPin, DollarSign, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

// Validation schema
const jobSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().min(50, 'Description must be at least 50 characters').max(5000),
  requirements: z.string().min(20, 'Requirements must be at least 20 characters').max(3000),
  benefits: z.string().optional(),
  location: z.string().min(2, 'Location is required'),
  salaryMin: z.number().min(0).optional().or(z.literal('')),
  salaryMax: z.number().min(0).optional().or(z.literal('')),
  workMode: z.enum(['REMOTE', 'HYBRID', 'ONSITE']),
  type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERNSHIP']),
  seniority: z.enum(['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']),
})

type JobFormData = z.infer<typeof jobSchema>

export default function EditJobPage({
  params
}: {
  params: { locale: string; id: string }
}) {
  const router = useRouter()
  const t = useTranslations()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
  })

  // Load job data
  useEffect(() => {
    const loadJob = async () => {
      try {
        const response = await fetch(`/api/jobs/${params.id}`)
        if (!response.ok) {
          throw new Error('Job not found')
        }

        const job = await response.json()

        // Reset form with job data
        reset({
          title: job.title,
          description: job.description || '',
          requirements: job.requirements || '',
          benefits: job.benefits || '',
          location: job.location,
          salaryMin: job.salaryMin || '',
          salaryMax: job.salaryMax || '',
          workMode: job.workMode || 'ONSITE',
          type: job.type || 'FULL_TIME',
          seniority: job.seniority || 'MID',
        })

        setIsLoading(false)
      } catch (error) {
        console.error('Failed to load job:', error)
        toast.error('Failed to load job')
        router.push(`/${params.locale}/employer`)
      }
    }

    loadJob()
  }, [params.id, params.locale, reset, router])

  const onSubmit = async (data: JobFormData) => {
    setIsSubmitting(true)

    try {
      // Convert empty strings to undefined for optional numeric fields
      const processedData = {
        ...data,
        salaryMin: data.salaryMin === '' ? undefined : Number(data.salaryMin),
        salaryMax: data.salaryMax === '' ? undefined : Number(data.salaryMax),
      }

      const response = await fetch(`/api/jobs/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processedData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update job')
      }

      toast.success('Job updated successfully!')
      router.push(`/${params.locale}/employer`)
    } catch (error) {
      console.error('Failed to update job:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update job')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to close this job posting? This action cannot be undone.')) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/jobs/${params.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to close job')
      }

      toast.success('Job closed successfully!')
      router.push(`/${params.locale}/employer`)
    } catch (error) {
      console.error('Failed to close job:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to close job')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading job details...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href={`/${params.locale}/employer`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('employer.backToDashboard')}
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{t('employer.editJob.title')}</h1>
              <p className="text-muted-foreground">{t('employer.editJob.subtitle')}</p>
            </div>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Closing...' : 'Close Job'}
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                {t('employer.newJob.basicInfo')}
              </CardTitle>
              <CardDescription>{t('employer.newJob.basicInfoDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('employer.newJob.jobTitle')} *</Label>
                <Input
                  id="title"
                  placeholder={t('employer.newJob.jobTitlePlaceholder')}
                  {...register('title')}
                />
                {errors.title && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">{t('employer.newJob.employmentType')} *</Label>
                  <Select
                    onValueChange={(value) => setValue('type', value as any)}
                    defaultValue="FULL_TIME"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_TIME">{t('employer.newJob.fullTime')}</SelectItem>
                      <SelectItem value="PART_TIME">{t('employer.newJob.partTime')}</SelectItem>
                      <SelectItem value="CONTRACT">{t('employer.newJob.contract')}</SelectItem>
                      <SelectItem value="FREELANCE">{t('employer.newJob.freelance')}</SelectItem>
                      <SelectItem value="INTERNSHIP">{t('employer.newJob.internship')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seniority">{t('employer.newJob.seniorityLevel')} *</Label>
                  <Select
                    onValueChange={(value) => setValue('seniority', value as any)}
                    defaultValue="MID"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JUNIOR">{t('employer.newJob.junior')}</SelectItem>
                      <SelectItem value="MID">{t('employer.newJob.mid')}</SelectItem>
                      <SelectItem value="SENIOR">{t('employer.newJob.senior')}</SelectItem>
                      <SelectItem value="LEAD">{t('employer.newJob.lead')}</SelectItem>
                      <SelectItem value="EXECUTIVE">{t('employer.newJob.executive')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location & Work Mode */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {t('employer.newJob.locationWorkMode')}
              </CardTitle>
              <CardDescription>{t('employer.newJob.locationWorkModeDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location">{t('employer.newJob.location')} *</Label>
                <Input
                  id="location"
                  placeholder={t('employer.newJob.locationPlaceholder')}
                  {...register('location')}
                />
                {errors.location && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.location.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="workMode">{t('employer.newJob.workMode')} *</Label>
                <Select
                  onValueChange={(value) => setValue('workMode', value as any)}
                  defaultValue="ONSITE"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONSITE">{t('employer.newJob.onsite')}</SelectItem>
                    <SelectItem value="HYBRID">{t('employer.newJob.hybrid')}</SelectItem>
                    <SelectItem value="REMOTE">{t('employer.newJob.remote')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Job Description */}
          <Card>
            <CardHeader>
              <CardTitle>{t('employer.newJob.jobDescription')}</CardTitle>
              <CardDescription>{t('employer.newJob.jobDescriptionDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">{t('employer.newJob.description')} *</Label>
                <Textarea
                  id="description"
                  placeholder={t('employer.newJob.descriptionPlaceholder')}
                  rows={8}
                  {...register('description')}
                />
                {errors.description && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.description.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="requirements">{t('employer.newJob.requirements')} *</Label>
                <Textarea
                  id="requirements"
                  placeholder={t('employer.newJob.requirementsPlaceholder')}
                  rows={6}
                  {...register('requirements')}
                />
                {errors.requirements && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.requirements.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="benefits">{t('employer.newJob.benefits')}</Label>
                <Textarea
                  id="benefits"
                  placeholder={t('employer.newJob.benefitsPlaceholder')}
                  rows={4}
                  {...register('benefits')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Compensation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {t('employer.newJob.compensation')}
              </CardTitle>
              <CardDescription>{t('employer.newJob.compensationDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salaryMin">{t('employer.newJob.minSalary')}</Label>
                  <Input
                    id="salaryMin"
                    type="number"
                    placeholder="3000"
                    {...register('salaryMin', { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salaryMax">{t('employer.newJob.maxSalary')}</Label>
                  <Input
                    id="salaryMax"
                    type="number"
                    placeholder="5000"
                    {...register('salaryMax', { valueAsNumber: true })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('employer.editJob.saving') : t('employer.editJob.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, ArrowLeft, Upload, FileText, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from '@/components/ui/use-toast'
import { logger } from '@/lib/logger'

// Form schema
const applicationSchema = z.object({
  coverLetter: z
    .string()
    .min(50, {
      message: 'Cover letter must be at least 50 characters.',
    })
    .max(2000, {
      message: 'Cover letter must not exceed 2000 characters.',
    }),
  cvSource: z.enum(['existing', 'upload', 'profile']),
  cvId: z.string().optional(),
  cvFile: z.any().optional(),
  expectedSalary: z.string().optional(),
  availableFrom: z.date().optional(),
  phoneNumber: z.string().min(9, 'Please enter a valid phone number').optional(),
  linkedin: z.string().url('Please enter a valid LinkedIn URL').optional().or(z.literal('')),
})

type ApplicationFormValues = z.infer<typeof applicationSchema>

interface JobData {
  id: string
  title: string
  company: string
  location: string
  salaryMin?: number
  salaryMax?: number
}

interface UserCV {
  id: string
  title: string
  uploadedAt: string
  isDefault?: boolean
}

export default function ApplyPage({ params }: { params: { id: string; locale: string } }) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const t = useTranslations()
  const [job, setJob] = useState<JobData | null>(null)
  const [userCVs, setUserCVs] = useState<UserCV[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [parsingCV, setParsingCV] = useState(false)

  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      coverLetter: '',
      cvSource: 'existing',
      expectedSalary: '',
      linkedin: '',
    },
  })

  // Fetch job details
  useEffect(() => {
    async function fetchJobData() {
      try {
        const response = await fetch(`/api/jobs/${params.id}`)
        if (!response.ok) throw new Error('Failed to fetch job')
        const data = await response.json()
        setJob({
          id: data.id,
          title: data.title,
          company: data.organization.name,
          location: data.location,
          salaryMin: data.salaryMin,
          salaryMax: data.salaryMax,
        })
      } catch (error) {
        logger.error('Error fetching job', error)
        toast.error(t('apply.error'), {
          description: t('apply.jobNotFound'),
        })
      }
    }

    fetchJobData()
  }, [params.id, t])

  // Fetch user's CVs
  useEffect(() => {
    async function fetchUserCVs() {
      if (status !== 'authenticated') return

      try {
        const response = await fetch('/api/user/cvs')
        if (response.ok) {
          const data = await response.json()
          setUserCVs(data)
          // Set default CV if exists
          const defaultCV = data.find((cv: UserCV) => cv.isDefault)
          if (defaultCV) {
            form.setValue('cvId', defaultCV.id)
          }
        }
      } catch (error) {
        logger.error('Error fetching CVs', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserCVs()
  }, [status, form])

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(
        `/${params.locale}/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      )
    }
  }, [status, router, params.locale])

  /**
   * Auto-fill form from uploaded CV
   */
  async function handleCVUpload(file: File) {
    setParsingCV(true)

    try {
      // First, upload CV to get raw text
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await fetch('/api/cv/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload CV')
      }

      const { rawText } = await uploadResponse.json()

      // Then parse CV with AI
      const parseResponse = await fetch('/api/cv/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      })

      if (!parseResponse.ok) {
        throw new Error('Failed to parse CV')
      }

      const { parsed } = await parseResponse.json()

      // Auto-fill form fields from parsed CV
      if (parsed?.personal) {
        if (parsed.personal.phone) {
          form.setValue('phoneNumber', parsed.personal.phone)
        }
        if (parsed.personal.linkedIn) {
          form.setValue('linkedin', parsed.personal.linkedIn)
        }
      }

      toast.success(t('apply.cvParsed'), {
        description: t('apply.fieldsAutoFilled'),
      })
    } catch (error) {
      logger.error('Error parsing CV', error)
      toast.error(t('apply.parseError'), {
        description: error instanceof Error ? error.message : t('apply.parseErrorDescription'),
      })
    } finally {
      setParsingCV(false)
    }
  }

  /**
   * Auto-fill form from existing CV selection
   */
  async function handleExistingCVSelection(cvId: string) {
    try {
      const response = await fetch(`/api/resumes/${cvId}`)

      if (response.ok) {
        const cvData = await response.json()

        // Auto-fill form fields from CV metadata
        if (cvData?.candidate?.contacts?.length > 0) {
          const contact = cvData.candidate.contacts[0]

          if (contact.phone) {
            form.setValue('phoneNumber', contact.phone)
          }
          if (contact.linkedIn) {
            form.setValue('linkedin', contact.linkedIn)
          }
        }
      }
    } catch (error) {
      logger.error('Error loading CV details', error)
      // Don't show error toast, it's optional enhancement
    }
  }

  async function onSubmit(values: ApplicationFormValues) {
    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('jobId', params.id)
      formData.append('coverLetter', values.coverLetter)

      if (values.expectedSalary) {
        formData.append('expectedSalary', values.expectedSalary)
      }

      if (values.availableFrom) {
        formData.append('availableFrom', values.availableFrom.toISOString())
      }

      if (values.phoneNumber) {
        formData.append('phoneNumber', values.phoneNumber)
      }

      if (values.linkedin) {
        formData.append('linkedin', values.linkedin)
      }

      // Handle CV based on source
      if (values.cvSource === 'existing' && values.cvId) {
        formData.append('cvId', values.cvId)
      } else if (values.cvSource === 'upload' && values.cvFile) {
        formData.append('cvFile', values.cvFile)
      }

      const response = await fetch('/api/applications', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to submit application')
      }

      setSubmitted(true)
      toast.success(t('apply.success'), {
        description: t('apply.successDescription'),
      })

      // Redirect after 3 seconds
      setTimeout(() => {
        router.push(`/${params.locale}/dashboard`)
      }, 3000)
    } catch (error) {
      logger.error('Error submitting application', error)
      toast.error(t('apply.error'), {
        description: error instanceof Error ? error.message : t('apply.submitError'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4 py-12">
          <Card className="mx-auto max-w-2xl">
            <CardContent className="pb-12 pt-12 text-center">
              <div className="mb-6 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                  <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h2 className="mb-4 text-2xl font-bold">{t('apply.successTitle')}</h2>
              <p className="mb-8 text-muted-foreground">{t('apply.successMessage')}</p>
              <Button asChild>
                <Link href={`/${params.locale}/dashboard`}>{t('apply.goToDashboard')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${params.locale}/jobs/${params.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('apply.backToJob')}
            </Link>
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Application Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{t('apply.title')}</CardTitle>
                <CardDescription>{t('apply.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Cover Letter */}
                    <FormField
                      control={form.control}
                      name="coverLetter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('apply.coverLetter')}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t('apply.coverLetterPlaceholder')}
                              className="min-h-[200px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('apply.coverLetterDescription')} ({field.value?.length || 0}/2000)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* CV Selection */}
                    <FormField
                      control={form.control}
                      name="cvSource"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('apply.cv')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('apply.selectCV')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="existing">{t('apply.useExisting')}</SelectItem>
                              <SelectItem value="upload">{t('apply.uploadNew')}</SelectItem>
                              <SelectItem value="profile">{t('apply.useProfile')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Existing CV Selection */}
                    {form.watch('cvSource') === 'existing' && userCVs.length > 0 && (
                      <FormField
                        control={form.control}
                        name="cvId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('apply.selectYourCV')}</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value)
                                // Auto-fill form from selected CV
                                handleExistingCVSelection(value)
                              }}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t('apply.chooseCVPlaceholder')} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {userCVs.map((cv) => (
                                  <SelectItem key={cv.id} value={cv.id}>
                                    {cv.title} - {cv.uploadedAt}
                                    {cv.isDefault && ` (${t('apply.default')})`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Upload CV */}
                    {form.watch('cvSource') === 'upload' && (
                      <FormField
                        control={form.control}
                        name="cvFile"
                        render={({ field: { onChange, value, ...field } }) => (
                          <FormItem>
                            <FormLabel>{t('apply.uploadCV')}</FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-4">
                                <Input
                                  type="file"
                                  accept=".pdf,.doc,.docx"
                                  disabled={parsingCV}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                      onChange(file)
                                      // Auto-fill form from parsed CV
                                      await handleCVUpload(file)
                                    }
                                  }}
                                  {...field}
                                />
                                {parsingCV ? (
                                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                ) : (
                                  <Upload className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                            </FormControl>
                            <FormDescription>
                              {parsingCV ? t('apply.parsingCV') : t('apply.uploadCVDescription')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Expected Salary */}
                    <FormField
                      control={form.control}
                      name="expectedSalary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('apply.expectedSalary')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder={
                                job?.salaryMin
                                  ? `${job.salaryMin} - ${job.salaryMax}`
                                  : t('apply.salaryPlaceholder')
                              }
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>{t('apply.salaryDescription')}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Available From */}
                    <FormField
                      control={form.control}
                      name="availableFrom"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('apply.availableFrom')}</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    'w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground',
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, 'PPP')
                                  ) : (
                                    <span>{t('apply.selectDate')}</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormDescription>{t('apply.availableFromDescription')}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Phone Number */}
                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('apply.phoneNumber')}</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="+421 900 123 456" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* LinkedIn */}
                    <FormField
                      control={form.control}
                      name="linkedin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('apply.linkedin')}</FormLabel>
                          <FormControl>
                            <Input
                              type="url"
                              placeholder="https://linkedin.com/in/your-profile"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Submit Button */}
                    <div className="flex gap-4">
                      <Button type="submit" disabled={submitting} className="flex-1">
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('apply.submitting')}
                          </>
                        ) : (
                          t('apply.submit')
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={submitting}
                      >
                        {t('apply.cancel')}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Job Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>{t('apply.jobSummary')}</CardTitle>
              </CardHeader>
              <CardContent>
                {job ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">{job.title}</h3>
                      <p className="text-muted-foreground">{job.company}</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('apply.location')}:</span>
                        <span>{job.location}</span>
                      </div>
                      {(job.salaryMin || job.salaryMax) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('apply.salary')}:</span>
                          <span>
                            €{job.salaryMin?.toLocaleString()} - €{job.salaryMax?.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="h-4 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>{t('apply.tips')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{t('apply.tip1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{t('apply.tip2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{t('apply.tip3')}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

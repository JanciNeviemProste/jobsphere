'use client'

/**
 * CV Edit Page
 * Review and edit AI-parsed CV data
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Save,
  Loader2,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowLeft,
  User,
  Briefcase,
  GraduationCap,
  Code2,
  Globe,
  Award,
  FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { toast } from '@/components/ui/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { logger } from '@/lib/logger'
import { Switch } from '@/components/ui/switch'

interface ResumeSection {
  id?: string
  kind: string
  order: number
  title?: string | null
  organization?: string | null
  location?: string | null
  startDate?: string | null
  endDate?: string | null
  current?: boolean
  description?: string | null
  skills?: string[]
}

interface ResumeData {
  id: string
  title?: string | null
  summary?: string | null
  sections: ResumeSection[]
  candidateId: string
  createdAt: string
  updatedAt: string
}

export default function CVEditClient({ params }: { params: { id: string; locale: string } }) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const t = useTranslations()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resumeData, setResumeData] = useState<ResumeData | null>(null)
  const [activeTab, setActiveTab] = useState('personal')

  // Check authentication
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(
        `/${params.locale}/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      )
    }
  }, [status, router, params.locale])

  // Load CV data
  useEffect(() => {
    async function loadResume() {
      try {
        const response = await fetch(`/api/cv/${params.id}`)
        if (!response.ok) throw new Error('Failed to load CV')

        const data = await response.json()
        setResumeData(data)
      } catch (error) {
        logger.error('Load CV error', error)
        toast.error(t('cvEdit.error'), {
          description: t('cvEdit.loadError'),
        })
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated') {
      loadResume()
    }
  }, [params.id, status, t])

  const handleSave = async () => {
    if (!resumeData) return

    try {
      setSaving(true)
      setSaved(false)

      const response = await fetch(`/api/cv/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resumeData),
      })

      if (!response.ok) throw new Error('Failed to save CV')

      setSaved(true)
      toast.success(t('cvEdit.success'), {
        description: t('cvEdit.saveSuccess'),
      })
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      logger.error('Save CV error', error)
      toast.error(t('cvEdit.error'), {
        description: t('cvEdit.saveError'),
      })
    } finally {
      setSaving(false)
    }
  }

  // Add new section
  const addSection = (kind: string) => {
    if (!resumeData) return

    const newSection: ResumeSection = {
      kind,
      order: resumeData.sections.filter((s) => s.kind === kind).length,
      title: '',
      organization: '',
      location: '',
      description: '',
      skills: [],
      current: false,
    }

    setResumeData({
      ...resumeData,
      sections: [...resumeData.sections, newSection],
    })
  }

  // Remove section
  const removeSection = (index: number) => {
    if (!resumeData) return

    setResumeData({
      ...resumeData,
      sections: resumeData.sections.filter((_, i) => i !== index),
    })
  }

  // Update section
  const updateSection = (index: number, updates: Partial<ResumeSection>) => {
    if (!resumeData) return

    const updatedSections = [...resumeData.sections]
    updatedSections[index] = { ...updatedSections[index], ...updates }

    setResumeData({
      ...resumeData,
      sections: updatedSections,
    })
  }

  // Get sections by kind
  const getSectionsByKind = (kind: string) => {
    return resumeData?.sections.filter((s) => s.kind === kind) || []
  }

  // Get personal info section
  const getPersonalInfo = () => {
    const personal = getSectionsByKind('PERSONAL')[0]
    return {
      fullName: personal?.title || '',
      email: personal?.organization || '',
      phone: personal?.location || '',
      location: personal?.description || '',
    }
  }

  // Update personal info
  const updatePersonalInfo = (field: string, value: string) => {
    if (!resumeData) return

    const personalIndex = resumeData.sections.findIndex((s) => s.kind === 'PERSONAL')
    if (personalIndex === -1) {
      // Create new personal section
      const newPersonal: ResumeSection = {
        kind: 'PERSONAL',
        order: 0,
        title: field === 'fullName' ? value : '',
        organization: field === 'email' ? value : '',
        location: field === 'phone' ? value : '',
        description: field === 'location' ? value : '',
        skills: [],
      }
      setResumeData({
        ...resumeData,
        sections: [newPersonal, ...resumeData.sections],
      })
    } else {
      const fieldMap = {
        fullName: 'title',
        email: 'organization',
        phone: 'location',
        location: 'description',
      }
      updateSection(personalIndex, { [fieldMap[field as keyof typeof fieldMap]]: value })
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!resumeData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">{t('cvEdit.notFound')}</p>
            <Button asChild className="mt-4 w-full">
              <Link href={`/${params.locale}/dashboard`}>{t('cvEdit.backToDashboard')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const personalInfo = getPersonalInfo()
  const experiences = getSectionsByKind('EXPERIENCE')
  const education = getSectionsByKind('EDUCATION')
  const skills = getSectionsByKind('SKILLS')
  const languages = getSectionsByKind('LANGUAGES')
  const certifications = getSectionsByKind('CERTIFICATIONS')
  const projects = getSectionsByKind('PROJECTS')

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href={`/${params.locale}/dashboard`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('cvEdit.backToDashboard')}
            </Link>
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{t('cvEdit.title')}</h1>
              <p className="mt-1 text-muted-foreground">{t('cvEdit.description')}</p>
            </div>
            <div className="flex items-center gap-3">
              {saved && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">{t('cvEdit.saved')}</span>
                </div>
              )}
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('cvEdit.saving')}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {t('cvEdit.saveChanges')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* CV Title */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('cvEdit.cvTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={resumeData.title || ''}
              onChange={(e) => setResumeData({ ...resumeData, title: e.target.value })}
              placeholder={t('cvEdit.cvTitlePlaceholder')}
            />
          </CardContent>
        </Card>

        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 grid w-full grid-cols-7">
            <TabsTrigger value="personal" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{t('cvEdit.personal')}</span>
            </TabsTrigger>
            <TabsTrigger value="experience" className="gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">{t('cvEdit.experience')}</span>
            </TabsTrigger>
            <TabsTrigger value="education" className="gap-2">
              <GraduationCap className="h-4 w-4" />
              <span className="hidden sm:inline">{t('cvEdit.education')}</span>
            </TabsTrigger>
            <TabsTrigger value="skills" className="gap-2">
              <Code2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('cvEdit.skills')}</span>
            </TabsTrigger>
            <TabsTrigger value="languages" className="gap-2">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">{t('cvEdit.languages')}</span>
            </TabsTrigger>
            <TabsTrigger value="certifications" className="gap-2">
              <Award className="h-4 w-4" />
              <span className="hidden sm:inline">{t('cvEdit.certifications')}</span>
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">{t('cvEdit.projects')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Personal Information */}
          <TabsContent value="personal">
            <Card>
              <CardHeader>
                <CardTitle>{t('cvEdit.personalInfo')}</CardTitle>
                <CardDescription>{t('cvEdit.personalInfoDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('cvEdit.fullName')}</Label>
                    <Input
                      value={personalInfo.fullName}
                      onChange={(e) => updatePersonalInfo('fullName', e.target.value)}
                      placeholder={t('cvEdit.fullNamePlaceholder')}
                    />
                  </div>
                  <div>
                    <Label>{t('cvEdit.email')}</Label>
                    <Input
                      type="email"
                      value={personalInfo.email}
                      onChange={(e) => updatePersonalInfo('email', e.target.value)}
                      placeholder={t('cvEdit.emailPlaceholder')}
                    />
                  </div>
                  <div>
                    <Label>{t('cvEdit.phone')}</Label>
                    <Input
                      type="tel"
                      value={personalInfo.phone}
                      onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                      placeholder={t('cvEdit.phonePlaceholder')}
                    />
                  </div>
                  <div>
                    <Label>{t('cvEdit.location')}</Label>
                    <Input
                      value={personalInfo.location}
                      onChange={(e) => updatePersonalInfo('location', e.target.value)}
                      placeholder={t('cvEdit.locationPlaceholder')}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <Label>{t('cvEdit.summary')}</Label>
                  <Textarea
                    value={resumeData.summary || ''}
                    onChange={(e) => setResumeData({ ...resumeData, summary: e.target.value })}
                    rows={4}
                    placeholder={t('cvEdit.summaryPlaceholder')}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Experience */}
          <TabsContent value="experience">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('cvEdit.workExperience')}</CardTitle>
                    <CardDescription>{t('cvEdit.workExperienceDescription')}</CardDescription>
                  </div>
                  <Button onClick={() => addSection('EXPERIENCE')} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('cvEdit.addExperience')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {experiences.map((exp, idx) => (
                  <div key={idx} className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>{t('cvEdit.jobTitle')}</Label>
                            <Input
                              value={exp.title || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex((s) => s === exp)
                                updateSection(sectionIndex, { title: e.target.value })
                              }}
                              placeholder={t('cvEdit.jobTitlePlaceholder')}
                            />
                          </div>
                          <div>
                            <Label>{t('cvEdit.company')}</Label>
                            <Input
                              value={exp.organization || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex((s) => s === exp)
                                updateSection(sectionIndex, { organization: e.target.value })
                              }}
                              placeholder={t('cvEdit.companyPlaceholder')}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>{t('cvEdit.location')}</Label>
                            <Input
                              value={exp.location || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex((s) => s === exp)
                                updateSection(sectionIndex, { location: e.target.value })
                              }}
                              placeholder={t('cvEdit.locationPlaceholder')}
                            />
                          </div>
                          <div>
                            <Label>{t('cvEdit.startDate')}</Label>
                            <Input
                              type="month"
                              value={exp.startDate?.substring(0, 7) || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex((s) => s === exp)
                                updateSection(sectionIndex, { startDate: e.target.value })
                              }}
                            />
                          </div>
                          <div>
                            <Label>{t('cvEdit.endDate')}</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="month"
                                value={exp.endDate?.substring(0, 7) || ''}
                                onChange={(e) => {
                                  const sectionIndex = resumeData.sections.findIndex(
                                    (s) => s === exp,
                                  )
                                  updateSection(sectionIndex, { endDate: e.target.value })
                                }}
                                disabled={exp.current}
                              />
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={exp.current || false}
                                  onCheckedChange={(checked) => {
                                    const sectionIndex = resumeData.sections.findIndex(
                                      (s) => s === exp,
                                    )
                                    updateSection(sectionIndex, {
                                      current: checked,
                                      endDate: checked ? null : exp.endDate,
                                    })
                                  }}
                                />
                                <Label className="text-sm">{t('cvEdit.current')}</Label>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label>{t('cvEdit.description')}</Label>
                          <Textarea
                            value={exp.description || ''}
                            onChange={(e) => {
                              const sectionIndex = resumeData.sections.findIndex((s) => s === exp)
                              updateSection(sectionIndex, { description: e.target.value })
                            }}
                            rows={3}
                            placeholder={t('cvEdit.descriptionPlaceholder')}
                            className="mt-2"
                          />
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const sectionIndex = resumeData.sections.findIndex((s) => s === exp)
                          removeSection(sectionIndex)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}

                {experiences.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    {t('cvEdit.noExperience')}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Education */}
          <TabsContent value="education">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('cvEdit.education')}</CardTitle>
                    <CardDescription>{t('cvEdit.educationDescription')}</CardDescription>
                  </div>
                  <Button onClick={() => addSection('EDUCATION')} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('cvEdit.addEducation')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {education.map((edu, idx) => (
                  <div key={idx} className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>{t('cvEdit.degree')}</Label>
                            <Input
                              value={edu.title || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex((s) => s === edu)
                                updateSection(sectionIndex, { title: e.target.value })
                              }}
                              placeholder={t('cvEdit.degreePlaceholder')}
                            />
                          </div>
                          <div>
                            <Label>{t('cvEdit.institution')}</Label>
                            <Input
                              value={edu.organization || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex((s) => s === edu)
                                updateSection(sectionIndex, { organization: e.target.value })
                              }}
                              placeholder={t('cvEdit.institutionPlaceholder')}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>{t('cvEdit.location')}</Label>
                            <Input
                              value={edu.location || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex((s) => s === edu)
                                updateSection(sectionIndex, { location: e.target.value })
                              }}
                              placeholder={t('cvEdit.locationPlaceholder')}
                            />
                          </div>
                          <div>
                            <Label>{t('cvEdit.startDate')}</Label>
                            <Input
                              type="month"
                              value={edu.startDate?.substring(0, 7) || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex((s) => s === edu)
                                updateSection(sectionIndex, { startDate: e.target.value })
                              }}
                            />
                          </div>
                          <div>
                            <Label>{t('cvEdit.endDate')}</Label>
                            <Input
                              type="month"
                              value={edu.endDate?.substring(0, 7) || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex((s) => s === edu)
                                updateSection(sectionIndex, { endDate: e.target.value })
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <Label>{t('cvEdit.description')}</Label>
                          <Textarea
                            value={edu.description || ''}
                            onChange={(e) => {
                              const sectionIndex = resumeData.sections.findIndex((s) => s === edu)
                              updateSection(sectionIndex, { description: e.target.value })
                            }}
                            rows={2}
                            placeholder={t('cvEdit.educationDescriptionPlaceholder')}
                            className="mt-2"
                          />
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const sectionIndex = resumeData.sections.findIndex((s) => s === edu)
                          removeSection(sectionIndex)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}

                {education.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    {t('cvEdit.noEducation')}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Skills */}
          <TabsContent value="skills">
            <Card>
              <CardHeader>
                <CardTitle>{t('cvEdit.skills')}</CardTitle>
                <CardDescription>{t('cvEdit.skillsDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>{t('cvEdit.skillsList')}</Label>
                    <Textarea
                      value={skills[0]?.skills?.join(', ') || ''}
                      onChange={(e) => {
                        const skillsArray = e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter((s) => s)
                        const skillsIndex = resumeData.sections.findIndex(
                          (s) => s.kind === 'SKILLS',
                        )
                        if (skillsIndex === -1) {
                          // Create new skills section
                          const newSkills: ResumeSection = {
                            kind: 'SKILLS',
                            order: 0,
                            skills: skillsArray,
                          }
                          setResumeData({
                            ...resumeData,
                            sections: [...resumeData.sections, newSkills],
                          })
                        } else {
                          updateSection(skillsIndex, { skills: skillsArray })
                        }
                      }}
                      rows={4}
                      placeholder={t('cvEdit.skillsPlaceholder')}
                      className="mt-2"
                    />
                    <p className="mt-2 text-sm text-muted-foreground">{t('cvEdit.skillsHelp')}</p>
                  </div>

                  {skills[0]?.skills && skills[0].skills.length > 0 && (
                    <div>
                      <Label>{t('cvEdit.skillsPreview')}</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {skills[0].skills.map((skill, idx) => (
                          <Badge key={idx} variant="secondary">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Languages */}
          <TabsContent value="languages">
            <Card>
              <CardHeader>
                <CardTitle>{t('cvEdit.languages')}</CardTitle>
                <CardDescription>{t('cvEdit.languagesDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>{t('cvEdit.languagesList')}</Label>
                    <Textarea
                      value={languages[0]?.description || ''}
                      onChange={(e) => {
                        const langIndex = resumeData.sections.findIndex(
                          (s) => s.kind === 'LANGUAGES',
                        )
                        if (langIndex === -1) {
                          const newLang: ResumeSection = {
                            kind: 'LANGUAGES',
                            order: 0,
                            description: e.target.value,
                            skills: [],
                          }
                          setResumeData({
                            ...resumeData,
                            sections: [...resumeData.sections, newLang],
                          })
                        } else {
                          updateSection(langIndex, { description: e.target.value })
                        }
                      }}
                      rows={4}
                      placeholder={t('cvEdit.languagesPlaceholder')}
                      className="mt-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certifications */}
          <TabsContent value="certifications">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('cvEdit.certifications')}</CardTitle>
                    <CardDescription>{t('cvEdit.certificationsDescription')}</CardDescription>
                  </div>
                  <Button onClick={() => addSection('CERTIFICATIONS')} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('cvEdit.addCertification')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {certifications.map((cert, idx) => (
                  <div key={idx} className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>{t('cvEdit.certificationName')}</Label>
                            <Input
                              value={cert.title || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex(
                                  (s) => s === cert,
                                )
                                updateSection(sectionIndex, { title: e.target.value })
                              }}
                              placeholder={t('cvEdit.certificationNamePlaceholder')}
                            />
                          </div>
                          <div>
                            <Label>{t('cvEdit.issuingOrganization')}</Label>
                            <Input
                              value={cert.organization || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex(
                                  (s) => s === cert,
                                )
                                updateSection(sectionIndex, { organization: e.target.value })
                              }}
                              placeholder={t('cvEdit.issuingOrganizationPlaceholder')}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>{t('cvEdit.issueDate')}</Label>
                            <Input
                              type="month"
                              value={cert.startDate?.substring(0, 7) || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex(
                                  (s) => s === cert,
                                )
                                updateSection(sectionIndex, { startDate: e.target.value })
                              }}
                            />
                          </div>
                          <div>
                            <Label>{t('cvEdit.expirationDate')}</Label>
                            <Input
                              type="month"
                              value={cert.endDate?.substring(0, 7) || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex(
                                  (s) => s === cert,
                                )
                                updateSection(sectionIndex, { endDate: e.target.value })
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const sectionIndex = resumeData.sections.findIndex((s) => s === cert)
                          removeSection(sectionIndex)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}

                {certifications.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    {t('cvEdit.noCertifications')}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects */}
          <TabsContent value="projects">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('cvEdit.projects')}</CardTitle>
                    <CardDescription>{t('cvEdit.projectsDescription')}</CardDescription>
                  </div>
                  <Button onClick={() => addSection('PROJECTS')} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('cvEdit.addProject')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {projects.map((project, idx) => (
                  <div key={idx} className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>{t('cvEdit.projectName')}</Label>
                            <Input
                              value={project.title || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex(
                                  (s) => s === project,
                                )
                                updateSection(sectionIndex, { title: e.target.value })
                              }}
                              placeholder={t('cvEdit.projectNamePlaceholder')}
                            />
                          </div>
                          <div>
                            <Label>{t('cvEdit.projectRole')}</Label>
                            <Input
                              value={project.organization || ''}
                              onChange={(e) => {
                                const sectionIndex = resumeData.sections.findIndex(
                                  (s) => s === project,
                                )
                                updateSection(sectionIndex, { organization: e.target.value })
                              }}
                              placeholder={t('cvEdit.projectRolePlaceholder')}
                            />
                          </div>
                        </div>

                        <div>
                          <Label>{t('cvEdit.projectDescription')}</Label>
                          <Textarea
                            value={project.description || ''}
                            onChange={(e) => {
                              const sectionIndex = resumeData.sections.findIndex(
                                (s) => s === project,
                              )
                              updateSection(sectionIndex, { description: e.target.value })
                            }}
                            rows={3}
                            placeholder={t('cvEdit.projectDescriptionPlaceholder')}
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label>{t('cvEdit.projectTechnologies')}</Label>
                          <Input
                            value={project.skills?.join(', ') || ''}
                            onChange={(e) => {
                              const techArray = e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter((s) => s)
                              const sectionIndex = resumeData.sections.findIndex(
                                (s) => s === project,
                              )
                              updateSection(sectionIndex, { skills: techArray })
                            }}
                            placeholder={t('cvEdit.projectTechnologiesPlaceholder')}
                          />
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const sectionIndex = resumeData.sections.findIndex((s) => s === project)
                          removeSection(sectionIndex)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}

                {projects.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    {t('cvEdit.noProjects')}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CVUploadZone } from '@/components/cv-upload-zone'
import { CVPreview, type CVPreviewData } from './cv-preview'
import {
  FileText,
  Sparkles,
  Download,
  Eye,
  Plus,
  Trash2,
  Image as ImageIcon,
  Heart,
  X,
  Save,
} from 'lucide-react'

interface Experience {
  company: string
  position: string
  period: string
  description: string
  current: boolean
}

interface Education {
  school: string
  degree: string
  field: string
  year: string
}

interface Skill {
  name: string
  level: string
}

interface Language {
  name: string
  proficiency: string
}

export default function CreateCVClient() {
  const t = useTranslations('createCV')
  const params = useParams()
  const locale = (params?.locale as string) || 'sk'

  // Save-to-profile state ("my CV in my profile", Profesia-style)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{
    type: 'ok' | 'login' | 'err'
    text: string
  } | null>(null)

  // Personal Info State
  const [personalInfo, setPersonalInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: '',
    photo: '',
  })

  // Photo upload state
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')

  // Experience State
  const [experiences, setExperiences] = useState<Experience[]>([])

  // Education State
  const [education, setEducation] = useState<Education[]>([])

  // Skills State
  const [skills, setSkills] = useState<Skill[]>([])

  // Interests / hobbies State (kept separate from professional skills)
  const [interests, setInterests] = useState<string[]>([])

  // Languages State
  const [languages, setLanguages] = useState<Language[]>([])

  // Preview / draft state
  const [showPreview, setShowPreview] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const DRAFT_KEY = 'jobsphere-cv-draft'

  // Restore a saved draft on first load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const d = JSON.parse(raw)
      if (d.personalInfo) setPersonalInfo((prev) => ({ ...prev, ...d.personalInfo }))
      if (Array.isArray(d.experiences)) setExperiences(d.experiences)
      if (Array.isArray(d.education)) setEducation(d.education)
      if (Array.isArray(d.skills)) setSkills(d.skills)
      if (Array.isArray(d.interests)) setInterests(d.interests)
      if (Array.isArray(d.languages)) setLanguages(d.languages)
    } catch {
      // ignore malformed draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle parsed CV data from upload
  const handleCVParsed = (parsedData: any) => {
    // Map personal info
    if (parsedData.personal) {
      setPersonalInfo((prev) => ({
        ...prev, // keep an already-uploaded photo
        fullName: parsedData.personal.fullName || '',
        email: parsedData.personal.email || '',
        phone: parsedData.personal.phone || '',
        location: parsedData.personal.location || '',
        linkedin: parsedData.personal.linkedIn || '',
        website: parsedData.personal.portfolio || parsedData.personal.github || '',
      }))
    }

    // Map experiences
    if (parsedData.experiences && Array.isArray(parsedData.experiences)) {
      const mappedExperiences = parsedData.experiences.map((exp: any) => ({
        company: exp.company || '',
        position: exp.title || '',
        period:
          exp.startDate && exp.endDate
            ? `${exp.startDate} - ${exp.endDate === 'present' ? 'Present' : exp.endDate}`
            : '',
        description: exp.description || '',
        current: exp.current || false,
      }))
      setExperiences(mappedExperiences)
    }

    // Map education
    if (parsedData.education && Array.isArray(parsedData.education)) {
      const mappedEducation = parsedData.education.map((edu: any) => ({
        school: edu.institution || '',
        degree: edu.degree || '',
        field: edu.field || '',
        year: edu.endDate || '',
      }))
      setEducation(mappedEducation)
    }

    // Map skills
    if (parsedData.skills && Array.isArray(parsedData.skills)) {
      const mappedSkills = parsedData.skills.map((skill: string) => ({
        name: skill,
        level: 'Pokročilý',
      }))
      setSkills(mappedSkills)
    }

    // Map interests / hobbies (separate from professional skills)
    if (parsedData.interests && Array.isArray(parsedData.interests)) {
      setInterests(parsedData.interests.map((i: string) => String(i)).filter(Boolean))
    }

    // Map languages
    if (parsedData.languages && Array.isArray(parsedData.languages)) {
      const mappedLanguages = parsedData.languages.map((lang: any) => ({
        name: lang.name || '',
        proficiency: lang.level || 'Pokročilý',
      }))
      setLanguages(mappedLanguages)
    }

    // Scroll to form after data is filled
    setTimeout(() => {
      const formSection = document.getElementById('cv-form')
      formSection?.scrollIntoView({ behavior: 'smooth' })
    }, 500)
  }

  // Handle manual fill click - scroll to form
  const handleManualFill = () => {
    // Scroll to form section
    const formSection = document.getElementById('cv-form')
    formSection?.scrollIntoView({ behavior: 'smooth' })
  }

  const addExperience = () => {
    setExperiences([
      ...experiences,
      {
        company: '',
        position: '',
        period: '',
        description: '',
        current: false,
      },
    ])
  }

  const removeExperience = (index: number) => {
    setExperiences(experiences.filter((_, i) => i !== index))
  }

  const addEducation = () => {
    setEducation([
      ...education,
      {
        school: '',
        degree: '',
        field: '',
        year: '',
      },
    ])
  }

  const removeEducation = (index: number) => {
    setEducation(education.filter((_, i) => i !== index))
  }

  const addSkill = () => {
    setSkills([...skills, { name: '', level: '' }])
  }

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index))
  }

  const addInterest = () => {
    setInterests([...interests, ''])
  }

  const updateInterest = (index: number, value: string) => {
    setInterests(interests.map((it, i) => (i === index ? value : it)))
  }

  const removeInterest = (index: number) => {
    setInterests(interests.filter((_, i) => i !== index))
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Nepodporovaný formát. Použite JPG, PNG alebo WEBP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Fotka je príliš veľká (max 5 MB).')
      return
    }
    setPhotoUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload/photo', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('upload failed')
      const { url } = await res.json()
      setPersonalInfo((prev) => ({ ...prev, photo: url }))
    } catch {
      setPhotoError('Nahratie fotky zlyhalo. Skúste znova.')
    } finally {
      setPhotoUploading(false)
    }
  }

  const removePhoto = () => setPersonalInfo((prev) => ({ ...prev, photo: '' }))

  // Data shape consumed by the preview / print / draft.
  const cvData: CVPreviewData = {
    personalInfo,
    experiences,
    education,
    skills,
    interests,
    languages,
  }

  // Persist the built CV into the signed-in user's profile (a real Resume),
  // so it lives in their account like on Profesia — not just a browser draft.
  const handleSaveToProfile = async () => {
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      const res = await fetch('/api/cv/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cvData),
      })
      if (res.status === 401) {
        setProfileMsg({ type: 'login', text: 'Pre uloženie do profilu sa prihlás.' })
        return
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setProfileMsg({ type: 'err', text: d.error || 'Uloženie do profilu zlyhalo.' })
        return
      }
      setProfileMsg({ type: 'ok', text: '✓ Uložené do tvojho profilu' })
    } catch {
      setProfileMsg({ type: 'err', text: 'Uloženie do profilu zlyhalo. Skús znova.' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(cvData))
      setDraftSaved(true)
      setTimeout(() => setDraftSaved(false), 2500)
    } catch {
      // localStorage may be unavailable (e.g. private mode) — ignore
    }
  }

  const handleDownloadPdf = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      // html2canvas only captures elements that are actually laid out on screen — an
      // off-screen element renders blank. So open the preview, let it render, then
      // capture the (visible) preview content.
      if (!showPreview) {
        setShowPreview(true)
        await new Promise((r) => setTimeout(r, 450))
      } else {
        await new Promise((r) => setTimeout(r, 50))
      }
      const el = printRef.current
      if (!el) return
      // Client-side, on demand — keeps html2pdf/html2canvas out of the SSR bundle.
      // @ts-ignore - html2pdf.js ships no type declarations
      const html2pdf = (await import('html2pdf.js')).default
      const safeName = (personalInfo.fullName || 'CV').replace(/[^a-zA-Z0-9._-]+/g, '_') || 'CV'
      await html2pdf()
        .set({
          margin: 0,
          filename: `${safeName}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(el)
        .save()
    } catch {
      // best-effort; the on-screen preview still works
    } finally {
      setDownloading(false)
    }
  }

  const handleGenerate = () => {
    // No standalone AI generator yet — guide the user up to the "upload CV" zone
    // so the AI can fill the form for them.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addLanguage = () => {
    setLanguages([...languages, { name: '', proficiency: '' }])
  }

  const removeLanguage = (index: number) => {
    setLanguages(languages.filter((_, i) => i !== index))
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center">
            <FileText className="h-12 w-12 text-primary" />
          </div>
          <h1 className="mb-4 text-4xl font-bold">{t('title')}</h1>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground">{t('subtitle')}</p>
        </div>

        {/* CV Upload Zone */}
        <div className="mx-auto mb-12 max-w-3xl">
          <CVUploadZone onCVParsed={handleCVParsed} onManualClick={handleManualFill} />
        </div>

        {/* Form Section - always visible */}
        <div id="cv-form" className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-3">
          {/* Form Section */}
          <div className="space-y-6 lg:col-span-2">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>{t('form.personalInfo.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Profile photo */}
                <div className="flex items-center gap-4">
                  {personalInfo.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={personalInfo.photo}
                      alt="Profilová fotka"
                      className="h-20 w-20 rounded-full border object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border bg-muted text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label
                      htmlFor="cv-photo"
                      className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-normal hover:bg-muted"
                    >
                      {photoUploading
                        ? 'Nahrávam…'
                        : personalInfo.photo
                          ? 'Zmeniť fotku'
                          : 'Nahrať fotku'}
                    </Label>
                    <input
                      id="cv-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={handlePhotoChange}
                      disabled={photoUploading}
                    />
                    {personalInfo.photo && (
                      <Button type="button" variant="ghost" size="sm" onClick={removePhoto}>
                        <Trash2 className="mr-1 h-4 w-4" /> Odstrániť
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">JPG, PNG alebo WEBP · max 5 MB</p>
                    {photoError && (
                      <p role="alert" className="text-xs text-destructive">
                        {photoError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="fullName">{t('form.personalInfo.fullName')}</Label>
                    <Input
                      id="fullName"
                      value={personalInfo.fullName}
                      onChange={(e) =>
                        setPersonalInfo({ ...personalInfo, fullName: e.target.value })
                      }
                      placeholder={t('form.personalInfo.fullName')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">{t('form.personalInfo.email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={personalInfo.email}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                      placeholder={t('form.personalInfo.email')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">{t('form.personalInfo.phone')}</Label>
                    <Input
                      id="phone"
                      value={personalInfo.phone}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                      placeholder={t('form.personalInfo.phone')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">{t('form.personalInfo.location')}</Label>
                    <Input
                      id="location"
                      value={personalInfo.location}
                      onChange={(e) =>
                        setPersonalInfo({ ...personalInfo, location: e.target.value })
                      }
                      placeholder={t('form.personalInfo.location')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="linkedin">{t('form.personalInfo.linkedin')}</Label>
                    <Input
                      id="linkedin"
                      value={personalInfo.linkedin}
                      onChange={(e) =>
                        setPersonalInfo({ ...personalInfo, linkedin: e.target.value })
                      }
                      placeholder="linkedin.com/in/..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">{t('form.personalInfo.website')}</Label>
                    <Input
                      id="website"
                      value={personalInfo.website}
                      onChange={(e) =>
                        setPersonalInfo({ ...personalInfo, website: e.target.value })
                      }
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Work Experience */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('form.experience.title')}</CardTitle>
                  <Button onClick={addExperience} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('form.experience.add')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {experiences.map((exp, index) => (
                  <div key={index} className="relative space-y-4 rounded-lg border p-4">
                    <Button
                      onClick={() => removeExperience(index)}
                      size="sm"
                      variant="ghost"
                      className="absolute right-2 top-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>{t('form.experience.company')}</Label>
                        <Input
                          value={exp.company}
                          onChange={(e) => {
                            const newExp = [...experiences]
                            newExp[index].company = e.target.value
                            setExperiences(newExp)
                          }}
                        />
                      </div>
                      <div>
                        <Label>{t('form.experience.position')}</Label>
                        <Input
                          value={exp.position}
                          onChange={(e) => {
                            const newExp = [...experiences]
                            newExp[index].position = e.target.value
                            setExperiences(newExp)
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>{t('form.experience.period')}</Label>
                      <Input
                        value={exp.period}
                        onChange={(e) => {
                          const newExp = [...experiences]
                          newExp[index].period = e.target.value
                          setExperiences(newExp)
                        }}
                        placeholder="2020 - 2023"
                      />
                    </div>
                    <div>
                      <Label>{t('form.experience.description')}</Label>
                      <textarea
                        className="min-h-[100px] w-full rounded-md border px-3 py-2"
                        value={exp.description}
                        onChange={(e) => {
                          const newExp = [...experiences]
                          newExp[index].description = e.target.value
                          setExperiences(newExp)
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Education */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('form.education.title')}</CardTitle>
                  <Button onClick={addEducation} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('form.education.add')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {education.map((edu, index) => (
                  <div key={index} className="relative space-y-4 rounded-lg border p-4">
                    <Button
                      onClick={() => removeEducation(index)}
                      size="sm"
                      variant="ghost"
                      className="absolute right-2 top-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>{t('form.education.school')}</Label>
                        <Input
                          value={edu.school}
                          onChange={(e) => {
                            const newEdu = [...education]
                            newEdu[index].school = e.target.value
                            setEducation(newEdu)
                          }}
                        />
                      </div>
                      <div>
                        <Label>{t('form.education.degree')}</Label>
                        <Input
                          value={edu.degree}
                          onChange={(e) => {
                            const newEdu = [...education]
                            newEdu[index].degree = e.target.value
                            setEducation(newEdu)
                          }}
                        />
                      </div>
                      <div>
                        <Label>{t('form.education.field')}</Label>
                        <Input
                          value={edu.field}
                          onChange={(e) => {
                            const newEdu = [...education]
                            newEdu[index].field = e.target.value
                            setEducation(newEdu)
                          }}
                        />
                      </div>
                      <div>
                        <Label>{t('form.education.year')}</Label>
                        <Input
                          value={edu.year}
                          onChange={(e) => {
                            const newEdu = [...education]
                            newEdu[index].year = e.target.value
                            setEducation(newEdu)
                          }}
                          placeholder="2023"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('form.skills.title')}</CardTitle>
                  <Button onClick={addSkill} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('form.skills.add')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {skills.map((skill, index) => (
                  <div key={index} className="flex items-end gap-4">
                    <div className="flex-1">
                      <Label>{t('form.skills.skill')}</Label>
                      <Input
                        value={skill.name}
                        onChange={(e) => {
                          const newSkills = [...skills]
                          newSkills[index].name = e.target.value
                          setSkills(newSkills)
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <Label>{t('form.skills.level')}</Label>
                      <Input
                        value={skill.level}
                        onChange={(e) => {
                          const newSkills = [...skills]
                          newSkills[index].level = e.target.value
                          setSkills(newSkills)
                        }}
                        placeholder="Začiatočník, Pokročilý, Expert"
                      />
                    </div>
                    <Button onClick={() => removeSkill(index)} size="sm" variant="ghost">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Interests / Hobbies */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-primary" /> Záujmy a záľuby
                  </CardTitle>
                  <Button onClick={addInterest} size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Pridať
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {interests.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Napr. turistika, čítanie, futbal… (oddelené od profesijných zručností)
                  </p>
                )}
                {interests.map((interest, index) => (
                  <div key={index} className="flex items-end gap-4">
                    <div className="flex-1">
                      <Input
                        value={interest}
                        onChange={(e) => updateInterest(index, e.target.value)}
                        placeholder="Záujem / hobby"
                      />
                    </div>
                    <Button onClick={() => removeInterest(index)} size="sm" variant="ghost">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Languages */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('form.languages.title')}</CardTitle>
                  <Button onClick={addLanguage} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('form.languages.add')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {languages.map((lang, index) => (
                  <div key={index} className="flex items-end gap-4">
                    <div className="flex-1">
                      <Label>{t('form.languages.language')}</Label>
                      <Input
                        value={lang.name}
                        onChange={(e) => {
                          const newLangs = [...languages]
                          newLangs[index].name = e.target.value
                          setLanguages(newLangs)
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <Label>{t('form.languages.proficiency')}</Label>
                      <Input
                        value={lang.proficiency}
                        onChange={(e) => {
                          const newLangs = [...languages]
                          newLangs[index].proficiency = e.target.value
                          setLanguages(newLangs)
                        }}
                        placeholder="Native, Fluent, Intermediate, Basic"
                      />
                    </div>
                    <Button onClick={() => removeLanguage(index)} size="sm" variant="ghost">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {t('aiHelper.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" variant="outline" onClick={handleGenerate}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('actions.generate')}
                </Button>
                <Button className="w-full" variant="outline" onClick={() => setShowPreview(true)}>
                  <Eye className="mr-2 h-4 w-4" />
                  {t('actions.preview')}
                </Button>
                <Button className="w-full" onClick={handleDownloadPdf} disabled={downloading}>
                  <Download className="mr-2 h-4 w-4" />
                  {downloading ? 'Sťahujem…' : t('actions.download')}
                </Button>
                <Button
                  className="w-full"
                  variant="default"
                  onClick={handleSaveToProfile}
                  disabled={savingProfile}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {savingProfile ? 'Ukladám…' : 'Uložiť do profilu'}
                </Button>
                {profileMsg && (
                  <p
                    className={
                      profileMsg.type === 'ok'
                        ? 'text-sm text-green-600'
                        : profileMsg.type === 'err'
                          ? 'text-sm text-destructive'
                          : 'text-sm text-muted-foreground'
                    }
                  >
                    {profileMsg.text}{' '}
                    {profileMsg.type === 'login' && (
                      <Link href={`/${locale}/login`} className="text-primary underline">
                        Prihlásiť sa
                      </Link>
                    )}
                    {profileMsg.type === 'ok' && (
                      <Link href={`/${locale}/dashboard/cv`} className="text-primary underline">
                        Zobraziť moje CV
                      </Link>
                    )}
                  </p>
                )}
                <Button className="w-full" variant="secondary" onClick={handleSaveDraft}>
                  {draftSaved ? '✓ Uložené' : t('actions.save')}
                </Button>
              </CardContent>
            </Card>

            {/* Tips Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">💡 Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Use action verbs to describe your experience</p>
                <p>• Quantify achievements with numbers</p>
                <p>• Keep it concise - max 2 pages</p>
                <p>• Tailor your CV for each position</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* On-screen preview modal — also the source for PDF generation (must be visible). */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 print:hidden"
          onClick={() => setShowPreview(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative my-8 w-full max-w-3xl rounded-lg bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-lg border-b bg-white px-4 py-3">
              <h3 className="text-lg font-semibold">{t('actions.preview')}</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleDownloadPdf} disabled={downloading}>
                  <Download className="mr-2 h-4 w-4" />
                  {downloading ? 'Sťahujem…' : t('actions.download')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowPreview(false)}
                  aria-label="Zavrieť"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div ref={printRef}>
              <CVPreview data={cvData} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

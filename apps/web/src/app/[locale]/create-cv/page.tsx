'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  FileText,
  Sparkles,
  Download,
  Eye,
  Plus,
  Trash2
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

export default function CreateCVPage() {
  const t = useTranslations('createCV')

  // Personal Info State
  const [personalInfo, setPersonalInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: ''
  })

  // Experience State
  const [experiences, setExperiences] = useState<Experience[]>([])

  // Education State
  const [education, setEducation] = useState<Education[]>([])

  // Skills State
  const [skills, setSkills] = useState<Skill[]>([])

  // Languages State
  const [languages, setLanguages] = useState<Language[]>([])

  const addExperience = () => {
    setExperiences([...experiences, {
      company: '',
      position: '',
      period: '',
      description: '',
      current: false
    }])
  }

  const removeExperience = (index: number) => {
    setExperiences(experiences.filter((_, i) => i !== index))
  }

  const addEducation = () => {
    setEducation([...education, {
      school: '',
      degree: '',
      field: '',
      year: ''
    }])
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
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <FileText className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Form Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>{t('form.personalInfo.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fullName">{t('form.personalInfo.fullName')}</Label>
                    <Input
                      id="fullName"
                      value={personalInfo.fullName}
                      onChange={(e) => setPersonalInfo({...personalInfo, fullName: e.target.value})}
                      placeholder={t('form.personalInfo.fullName')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">{t('form.personalInfo.email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={personalInfo.email}
                      onChange={(e) => setPersonalInfo({...personalInfo, email: e.target.value})}
                      placeholder={t('form.personalInfo.email')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">{t('form.personalInfo.phone')}</Label>
                    <Input
                      id="phone"
                      value={personalInfo.phone}
                      onChange={(e) => setPersonalInfo({...personalInfo, phone: e.target.value})}
                      placeholder={t('form.personalInfo.phone')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">{t('form.personalInfo.location')}</Label>
                    <Input
                      id="location"
                      value={personalInfo.location}
                      onChange={(e) => setPersonalInfo({...personalInfo, location: e.target.value})}
                      placeholder={t('form.personalInfo.location')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="linkedin">{t('form.personalInfo.linkedin')}</Label>
                    <Input
                      id="linkedin"
                      value={personalInfo.linkedin}
                      onChange={(e) => setPersonalInfo({...personalInfo, linkedin: e.target.value})}
                      placeholder="linkedin.com/in/..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">{t('form.personalInfo.website')}</Label>
                    <Input
                      id="website"
                      value={personalInfo.website}
                      onChange={(e) => setPersonalInfo({...personalInfo, website: e.target.value})}
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
                    <Plus className="h-4 w-4 mr-2" />
                    {t('form.experience.add')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {experiences.map((exp, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4 relative">
                    <Button
                      onClick={() => removeExperience(index)}
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="grid md:grid-cols-2 gap-4">
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
                        className="w-full min-h-[100px] px-3 py-2 border rounded-md"
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
                    <Plus className="h-4 w-4 mr-2" />
                    {t('form.education.add')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {education.map((edu, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4 relative">
                    <Button
                      onClick={() => removeEducation(index)}
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="grid md:grid-cols-2 gap-4">
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
                    <Plus className="h-4 w-4 mr-2" />
                    {t('form.skills.add')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {skills.map((skill, index) => (
                  <div key={index} className="flex gap-4 items-end">
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
                        placeholder="Beginner, Intermediate, Advanced"
                      />
                    </div>
                    <Button
                      onClick={() => removeSkill(index)}
                      size="sm"
                      variant="ghost"
                    >
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
                    <Plus className="h-4 w-4 mr-2" />
                    {t('form.languages.add')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {languages.map((lang, index) => (
                  <div key={index} className="flex gap-4 items-end">
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
                    <Button
                      onClick={() => removeLanguage(index)}
                      size="sm"
                      variant="ghost"
                    >
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
                <Button className="w-full" variant="outline">
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t('actions.generate')}
                </Button>
                <Button className="w-full" variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  {t('actions.preview')}
                </Button>
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  {t('actions.download')}
                </Button>
                <Button className="w-full" variant="secondary">
                  {t('actions.save')}
                </Button>
              </CardContent>
            </Card>

            {/* Tips Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">💡 Tips</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Use action verbs to describe your experience</p>
                <p>• Quantify achievements with numbers</p>
                <p>• Keep it concise - max 2 pages</p>
                <p>• Tailor your CV for each position</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

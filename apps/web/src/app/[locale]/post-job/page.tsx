'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Briefcase,
  Sparkles,
  Eye,
  Send,
  Save
} from 'lucide-react'

export default function PostJobPage() {
  const t = useTranslations('postJob')

  // Basic Info State
  const [basicInfo, setBasicInfo] = useState({
    jobTitle: '',
    company: '',
    location: '',
    remote: 'onsite',
    type: 'fullTime'
  })

  // Description State
  const [description, setDescription] = useState({
    description: '',
    responsibilities: '',
    requirements: '',
    niceToHave: ''
  })

  // Compensation State
  const [compensation, setCompensation] = useState({
    salaryMin: '',
    salaryMax: '',
    currency: 'EUR',
    benefits: ''
  })

  // Application Settings State
  const [applicationSettings, setApplicationSettings] = useState({
    email: '',
    deadline: '',
    questions: ''
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Briefcase className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Form Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Details */}
            <Card>
              <CardHeader>
                <CardTitle>{t('form.basics.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="jobTitle">{t('form.basics.jobTitle')}</Label>
                  <Input
                    id="jobTitle"
                    value={basicInfo.jobTitle}
                    onChange={(e) => setBasicInfo({...basicInfo, jobTitle: e.target.value})}
                    placeholder={t('form.basics.jobTitle')}
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company">{t('form.basics.company')}</Label>
                    <Input
                      id="company"
                      value={basicInfo.company}
                      onChange={(e) => setBasicInfo({...basicInfo, company: e.target.value})}
                      placeholder={t('form.basics.company')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">{t('form.basics.location')}</Label>
                    <Input
                      id="location"
                      value={basicInfo.location}
                      onChange={(e) => setBasicInfo({...basicInfo, location: e.target.value})}
                      placeholder={t('form.basics.location')}
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="remote">{t('form.basics.remote')}</Label>
                    <select
                      id="remote"
                      className="w-full px-3 py-2 border rounded-md"
                      value={basicInfo.remote}
                      onChange={(e) => setBasicInfo({...basicInfo, remote: e.target.value})}
                    >
                      <option value="onsite">{t('form.basics.remoteOptions.onsite')}</option>
                      <option value="hybrid">{t('form.basics.remoteOptions.hybrid')}</option>
                      <option value="remote">{t('form.basics.remoteOptions.remote')}</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="type">{t('form.basics.type')}</Label>
                    <select
                      id="type"
                      className="w-full px-3 py-2 border rounded-md"
                      value={basicInfo.type}
                      onChange={(e) => setBasicInfo({...basicInfo, type: e.target.value})}
                    >
                      <option value="fullTime">{t('form.basics.typeOptions.fullTime')}</option>
                      <option value="partTime">{t('form.basics.typeOptions.partTime')}</option>
                      <option value="contract">{t('form.basics.typeOptions.contract')}</option>
                      <option value="internship">{t('form.basics.typeOptions.internship')}</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Job Description */}
            <Card>
              <CardHeader>
                <CardTitle>{t('form.description.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="description">{t('form.description.description')}</Label>
                  <textarea
                    id="description"
                    className="w-full min-h-[120px] px-3 py-2 border rounded-md"
                    value={description.description}
                    onChange={(e) => setDescription({...description, description: e.target.value})}
                    placeholder={t('form.description.description')}
                  />
                </div>
                <div>
                  <Label htmlFor="responsibilities">{t('form.description.responsibilities')}</Label>
                  <textarea
                    id="responsibilities"
                    className="w-full min-h-[120px] px-3 py-2 border rounded-md"
                    value={description.responsibilities}
                    onChange={(e) => setDescription({...description, responsibilities: e.target.value})}
                    placeholder={t('form.description.responsibilities')}
                  />
                </div>
                <div>
                  <Label htmlFor="requirements">{t('form.description.requirements')}</Label>
                  <textarea
                    id="requirements"
                    className="w-full min-h-[120px] px-3 py-2 border rounded-md"
                    value={description.requirements}
                    onChange={(e) => setDescription({...description, requirements: e.target.value})}
                    placeholder={t('form.description.requirements')}
                  />
                </div>
                <div>
                  <Label htmlFor="niceToHave">{t('form.description.niceToHave')}</Label>
                  <textarea
                    id="niceToHave"
                    className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                    value={description.niceToHave}
                    onChange={(e) => setDescription({...description, niceToHave: e.target.value})}
                    placeholder={t('form.description.niceToHave')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Compensation & Benefits */}
            <Card>
              <CardHeader>
                <CardTitle>{t('form.compensation.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t('form.compensation.salary')}</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Input
                        type="number"
                        value={compensation.salaryMin}
                        onChange={(e) => setCompensation({...compensation, salaryMin: e.target.value})}
                        placeholder={t('form.compensation.salaryMin')}
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        value={compensation.salaryMax}
                        onChange={(e) => setCompensation({...compensation, salaryMax: e.target.value})}
                        placeholder={t('form.compensation.salaryMax')}
                      />
                    </div>
                    <div>
                      <select
                        className="w-full px-3 py-2 border rounded-md"
                        value={compensation.currency}
                        onChange={(e) => setCompensation({...compensation, currency: e.target.value})}
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="CZK">CZK</option>
                        <option value="PLN">PLN</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="benefits">{t('form.compensation.benefits')}</Label>
                  <textarea
                    id="benefits"
                    className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                    value={compensation.benefits}
                    onChange={(e) => setCompensation({...compensation, benefits: e.target.value})}
                    placeholder={t('form.compensation.benefits')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Application Settings */}
            <Card>
              <CardHeader>
                <CardTitle>{t('form.application.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">{t('form.application.email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={applicationSettings.email}
                      onChange={(e) => setApplicationSettings({...applicationSettings, email: e.target.value})}
                      placeholder={t('form.application.email')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="deadline">{t('form.application.deadline')}</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={applicationSettings.deadline}
                      onChange={(e) => setApplicationSettings({...applicationSettings, deadline: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="questions">{t('form.application.questions')}</Label>
                  <textarea
                    id="questions"
                    className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                    value={applicationSettings.questions}
                    onChange={(e) => setApplicationSettings({...applicationSettings, questions: e.target.value})}
                    placeholder={t('form.application.questions')}
                  />
                </div>
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
                  {t('aiHelper.improve')}
                </Button>
                <Button className="w-full" variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  {t('actions.preview')}
                </Button>
                <Button className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  {t('actions.publish')}
                </Button>
                <Button className="w-full" variant="secondary">
                  <Save className="h-4 w-4 mr-2" />
                  {t('actions.saveDraft')}
                </Button>
              </CardContent>
            </Card>

            {/* Tips Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">💡 Tips</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Be specific about requirements</p>
                <p>• Include salary range for transparency</p>
                <p>• Highlight company culture and benefits</p>
                <p>• Use clear, inclusive language</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

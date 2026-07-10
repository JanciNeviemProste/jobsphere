'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CVPreview, type CVPreviewData } from '../../create-cv/cv-preview'
import {
  Loader2,
  FileText,
  Plus,
  Upload,
  Eye,
  Download,
  Trash2,
  X,
  Briefcase,
  GraduationCap,
  Wrench,
} from 'lucide-react'

interface CvListItem {
  id: string
  title: string
  hasPhoto: boolean
  experienceCount: number
  educationCount: number
  skillCount: number
  fromUpload: boolean
  createdAt: string
  updatedAt: string
}

export default function CvsClient() {
  const params = useParams()
  const locale = (params?.locale as string) || 'sk'

  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [cvs, setCvs] = useState<CvListItem[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState(false)

  // view modal
  const [viewData, setViewData] = useState<CVPreviewData | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cv/profile')
      if (res.status === 401) {
        setUnauthorized(true)
        return
      }
      if (!res.ok) {
        // Distinguish a load failure from a genuinely empty list, so we don't tell
        // a user with saved CVs that they have none.
        setLoadError(true)
        return
      }
      const { cvs } = await res.json()
      setCvs(cvs ?? [])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openView = async (id: string) => {
    setViewLoading(true)
    setViewData(null)
    try {
      const res = await fetch(`/api/cv/profile?id=${encodeURIComponent(id)}`)
      if (!res.ok) return
      const { data } = await res.json()
      setViewData(data)
    } finally {
      setViewLoading(false)
    }
  }

  const remove = async (id: string) => {
    setDeleting(id)
    try {
      const res = await fetch(`/api/cv/profile?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (res.ok) setCvs((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const downloadPdf = async () => {
    if (downloading || !printRef.current) return
    setDownloading(true)
    setDownloadError(false)
    try {
      // @ts-ignore - html2pdf.js ships no type declarations
      const html2pdf = (await import('html2pdf.js')).default
      const name =
        (viewData?.personalInfo.fullName || 'CV').replace(/[^a-zA-Z0-9._-]+/g, '_') || 'CV'
      await html2pdf()
        .set({
          filename: `${name}.pdf`,
          margin: 0,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
        })
        .from(printRef.current)
        .save()
    } catch {
      setDownloadError(true)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg">Pre zobrazenie tvojich CV sa prihlás.</p>
        <Button asChild>
          <Link href={`/${locale}/login`}>Prihlásiť sa</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <FileText className="h-7 w-7 text-primary" /> Moje CV
            </h1>
            <p className="text-muted-foreground">Tvoje životopisy uložené v profile</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/${locale}/dashboard/cv/upload`}>
                <Upload className="mr-2 h-4 w-4" /> Nahrať CV
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/${locale}/create-cv`}>
                <Plus className="mr-2 h-4 w-4" /> Vytvoriť CV
              </Link>
            </Button>
          </div>
        </div>

        {loadError ? (
          <div className="rounded-lg border bg-background p-12 text-center text-muted-foreground">
            Nepodarilo sa načítať tvoje CV.{' '}
            <button
              onClick={() => {
                setLoadError(false)
                setLoading(true)
                load()
              }}
              className="text-primary hover:underline"
            >
              Skúsiť znova
            </button>
          </div>
        ) : cvs.length === 0 ? (
          <div className="rounded-lg border bg-background p-12 text-center text-muted-foreground">
            Zatiaľ nemáš uložené žiadne CV.{' '}
            <Link href={`/${locale}/create-cv`} className="text-primary hover:underline">
              Vytvor si prvé
            </Link>{' '}
            alebo nahraj existujúce.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {cvs.map((cv) => (
              <Card key={cv.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{cv.title}</CardTitle>
                    <Badge variant={cv.fromUpload ? 'secondary' : 'default'}>
                      {cv.fromUpload ? 'Nahraté' : 'Vytvorené'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      {cv.experienceCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-4 w-4" />
                      {cv.educationCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Wrench className="h-4 w-4" />
                      {cv.skillCount}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aktualizované {new Date(cv.updatedAt).toLocaleDateString('sk-SK')}
                  </p>
                  <div className="mt-auto flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => openView(cv.id)}>
                      <Eye className="mr-2 h-4 w-4" /> Zobraziť
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(cv.id)}
                      disabled={deleting === cv.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* View modal */}
      {(viewLoading || viewData) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-[840px] rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-3">
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={downloadPdf} disabled={downloading || !viewData}>
                  <Download className="mr-2 h-4 w-4" />
                  {downloading ? 'Sťahujem…' : 'Stiahnuť PDF'}
                </Button>
                {downloadError && (
                  <span className="text-sm text-destructive">Stiahnutie zlyhalo, skús znova.</span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setViewData(null)
                  setViewLoading(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto">
              {viewLoading ? (
                <div className="flex items-center justify-center p-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                viewData && (
                  <div ref={printRef}>
                    <CVPreview data={viewData} />
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

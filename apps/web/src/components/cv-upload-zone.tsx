'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Edit3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'

type UploadStatus = 'idle' | 'uploading' | 'parsing' | 'success' | 'error'

interface CVUploadZoneProps {
  onCVParsed: (data: any) => void
  onManualClick: () => void
}

export function CVUploadZone({ onCVParsed, onManualClick }: CVUploadZoneProps) {
  const t = useTranslations('createCV.upload')
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      await processFile(droppedFile)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      await processFile(selectedFile)
    }
  }

  const processFile = async (selectedFile: File) => {
    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]

    if (!validTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload PDF, DOCX, or TXT.')
      setStatus('error')
      return
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.')
      setStatus('error')
      return
    }

    setFile(selectedFile)
    setError(null)
    await uploadAndParse(selectedFile)
  }

  const uploadAndParse = async (fileToUpload: File) => {
    try {
      setStatus('uploading')
      setError(null)

      // 1. Upload file to extract text
      const formData = new FormData()
      formData.append('file', fileToUpload)

      const uploadResponse = await fetch('/api/cv/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file')
      }

      const { rawText, parseMethod } = await uploadResponse.json()

      // If no real text could be extracted (e.g. a scanned / image-only PDF), the
      // server falls back to filename metadata. Sending that to the AI would make it
      // hallucinate a fake CV — so stop here and show a clear, actionable message.
      if (parseMethod === 'metadata_fallback' || !rawText || rawText.trim().length < 30) {
        setStatus('error')
        setError(`${t('errors.file_no_text_after_ocr')}\n\n${t('hints.scanned_pdf')}`)
        return
      }

      // 2. Parse CV with Claude
      setStatus('parsing')

      const parseResponse = await fetch('/api/cv/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      })

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to parse CV (${parseResponse.status})`)
      }

      const { parsed } = await parseResponse.json()

      // 3. Success - notify parent component
      setStatus('success')
      setTimeout(() => {
        onCVParsed(parsed)
      }, 1000)
    } catch (err) {
      logger.error('Upload error', err)
      setStatus('error')
      setError(err instanceof Error ? err.message : t('error'))
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const inputId = 'cv-file-upload'
  const isDisabled = status === 'uploading' || status === 'parsing'

  return (
    <Card className="mb-8">
      <CardContent className="pt-6">
        {/* Title & Subtitle */}
        <div className="mb-6 text-center">
          <h2 className="mb-2 text-2xl font-semibold">{t('title')}</h2>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        {/* Upload Area — keyboard + screen-reader operable */}
        <label
          htmlFor={inputId}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={isDisabled ? -1 : 0}
          aria-disabled={isDisabled}
          aria-label={t('dragDrop')}
          onKeyDown={handleKeyDown}
          className={`block cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            isDragging
              ? 'scale-[1.02] border-primary bg-primary/5'
              : 'border-gray-300 hover:border-primary hover:bg-muted/50'
          } ${isDisabled ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            className="sr-only"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
            disabled={isDisabled}
            aria-hidden="true"
            tabIndex={-1}
          />

          {/* Icon */}
          {status === 'idle' || status === 'error' ? (
            <Upload className="mx-auto mb-4 h-16 w-16 text-gray-400" />
          ) : status === 'uploading' || status === 'parsing' ? (
            <Loader2 className="mx-auto mb-4 h-16 w-16 animate-spin text-primary" />
          ) : status === 'success' ? (
            <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-600" />
          ) : null}

          {/* Text */}
          <p className="mb-2 text-lg font-medium text-gray-900">
            {status === 'idle' && (file ? file.name : t('dragDrop'))}
            {status === 'uploading' && t('uploading')}
            {status === 'parsing' && t('parsing')}
            {status === 'success' && t('success')}
            {status === 'error' && t('error')}
          </p>
          <p className="text-sm text-gray-500">{t('supportedFormats')}</p>
        </label>

        {/* Error Message — announced immediately to screen readers */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
          >
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
            <div className="flex-1 whitespace-pre-line text-sm text-red-800">{error}</div>
          </div>
        )}

        {/* Manual Fill Button */}
        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={onManualClick}
            className="text-muted-foreground hover:text-foreground"
          >
            <Edit3 className="mr-2 h-4 w-4" />
            {t('manual')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

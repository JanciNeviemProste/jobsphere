'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Edit3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
      'text/plain'
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

      const { rawText } = await uploadResponse.json()

      // 2. Parse CV with Claude
      setStatus('parsing')

      const parseResponse = await fetch('/api/cv/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      })

      if (!parseResponse.ok) {
        throw new Error('Failed to parse CV')
      }

      const { parsed } = await parseResponse.json()

      // 3. Success - notify parent component
      setStatus('success')
      setTimeout(() => {
        onCVParsed(parsed)
      }, 1000)

    } catch (err) {
      console.error('Upload error:', err)
      setStatus('error')
      setError(err instanceof Error ? err.message : t('error'))
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <Card className="mb-8">
      <CardContent className="pt-6">
        {/* Title & Subtitle */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold mb-2">{t('title')}</h2>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-gray-300 hover:border-primary hover:bg-muted/50'
          } ${status === 'uploading' || status === 'parsing' ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
            disabled={status === 'uploading' || status === 'parsing'}
          />

          {/* Icon */}
          {status === 'idle' || status === 'error' ? (
            <Upload className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          ) : status === 'uploading' || status === 'parsing' ? (
            <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
          ) : status === 'success' ? (
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
          ) : null}

          {/* Text */}
          <p className="text-lg font-medium text-gray-900 mb-2">
            {status === 'idle' && (file ? file.name : t('dragDrop'))}
            {status === 'uploading' && t('uploading')}
            {status === 'parsing' && t('parsing')}
            {status === 'success' && t('success')}
            {status === 'error' && t('error')}
          </p>
          <p className="text-sm text-gray-500">{t('supportedFormats')}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Manual Fill Button */}
        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={onManualClick}
            className="text-muted-foreground hover:text-foreground"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            {t('manual')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

/**
 * CV Upload & Parse Flow
 * Upload PDF/DOCX → Extract text → Parse with Claude → Edit & Save
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Loader2, CheckCircle2, XCircle } from 'lucide-react'

type UploadStatus = 'idle' | 'uploading' | 'parsing' | 'success' | 'error'

export default function CVUploadPage() {
  const router = useRouter()
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cvId, setCvId] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
      if (!validTypes.includes(selectedFile.type)) {
        setError('Invalid file type. Please upload PDF, DOCX, or TXT.')
        return
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File too large. Maximum size is 10MB.')
        return
      }

      setFile(selectedFile)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    try {
      setStatus('uploading')
      setError(null)

      // 1. Upload file to Vercel Blob
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await fetch('/api/cv/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file')
      }

      const { blobUrl, rawText } = await uploadResponse.json()

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

      const { cvId: newCvId } = await parseResponse.json()

      // 3. Success - redirect to edit page
      setStatus('success')
      setCvId(newCvId)

      setTimeout(() => {
        router.push(`/dashboard/cv/${newCvId}/edit`)
      }, 1500)

    } catch (err) {
      console.error('Upload error:', err)
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to upload CV')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <FileText className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Your CV</h1>
            <p className="text-gray-600">
              Upload your resume and we'll extract the information automatically using AI
            </p>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-primary transition-colors">
            <input
              type="file"
              id="cv-upload"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
              disabled={status !== 'idle' && status !== 'error'}
            />
            <label
              htmlFor="cv-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <Upload className="h-16 w-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {file ? file.name : 'Click to upload or drag and drop'}
              </p>
              <p className="text-sm text-gray-500">
                PDF, DOCX, or TXT (max 10MB)
              </p>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Status Messages */}
          {status === 'uploading' && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <p className="text-sm text-blue-800">Uploading file...</p>
            </div>
          )}

          {status === 'parsing' && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <p className="text-sm text-blue-800">Parsing CV with AI...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-800">
                CV parsed successfully! Redirecting to editor...
              </p>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || status !== 'idle'}
            className="mt-8 w-full bg-primary text-white py-3 px-6 rounded-lg font-medium hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'idle' ? 'Upload & Parse CV' : 'Processing...'}
          </button>

          {/* Info */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">What happens next?</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">1.</span>
                <span>We extract text from your CV using advanced OCR</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">2.</span>
                <span>Claude AI parses your experience, education, and skills</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">3.</span>
                <span>You can review and edit the extracted information</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">4.</span>
                <span>Your CV is matched against relevant job openings</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

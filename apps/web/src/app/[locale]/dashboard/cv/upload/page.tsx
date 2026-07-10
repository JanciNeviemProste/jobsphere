import type { Metadata } from 'next'
import CVUploadClient from './cv-upload-client'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Upload CV',
    description: 'Upload your resume and let AI extract your information automatically.',
  }
}

export default function CVUploadPage() {
  return <CVUploadClient />
}

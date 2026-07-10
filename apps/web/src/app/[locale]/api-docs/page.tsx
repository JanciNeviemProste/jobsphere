import type { Metadata } from 'next'
import ApiDocsClient from './api-docs-client'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'API Documentation',
    description: 'Complete API reference for the JobSphere ATS platform.',
  }
}

export default function ApiDocsPage() {
  return <ApiDocsClient />
}

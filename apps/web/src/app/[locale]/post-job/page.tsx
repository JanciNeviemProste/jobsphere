import type { Metadata } from 'next'
import PostJobClient from './post-job-client'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Post a Job',
    description: 'Create and publish a job posting to find the best candidates.',
  }
}

export default function PostJobPage() {
  return <PostJobClient />
}

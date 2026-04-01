import type { Metadata } from 'next'
import TeamManagementClient from './team-client'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Team Management | JobSphere',
    description: 'Manage your organization team members and their roles.',
  }
}

export default function TeamManagementPage() {
  return <TeamManagementClient />
}

import type { Metadata } from 'next'
import SettingsClient from './settings-client'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Company Settings',
    description: 'Manage your organization settings, team members, and billing.',
  }
}

export default function SettingsPage() {
  return <SettingsClient />
}

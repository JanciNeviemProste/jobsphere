import type { Metadata } from 'next'
import ProfileClient from './profile-client'

type Props = {
  params: { locale: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'My Profile',
    description: 'Manage your personal information and work preferences.',
  }
}

export default function ProfilePage({ params }: Props) {
  return <ProfileClient params={params} />
}

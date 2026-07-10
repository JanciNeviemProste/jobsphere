import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { ContactInfo } from '@/components/candidates/ContactInfo'
import { MatchScoreSection } from '@/components/candidates/MatchScoreSection'
import { ResumeSection } from '@/components/candidates/ResumeSection'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Candidate Profile',
    description: 'View candidate profile, resume, and match scores.',
  }
}

export default async function CandidateProfilePage({
  params,
}: {
  params: { id: string; locale: string }
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/${params.locale}/login`)
  }

  // Get candidate with all related data
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      contacts: {
        where: { isPrimary: true },
        take: 1,
      },
      resumes: {
        orderBy: { createdAt: 'desc' },
        include: {
          sections: {
            orderBy: { order: 'asc' },
          },
        },
        take: 1,
      },
    },
  })

  if (!candidate) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Candidate not found</AlertDescription>
        </Alert>
      </div>
    )
  }

  // Verify user has access to this candidate's organization
  const membership = await prisma.userOrgRole.findFirst({
    where: {
      userId: session.user.id,
      orgId: candidate.orgId,
    },
  })

  if (!membership) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to view this candidate profile.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-10">
        {/* Back Button */}
        <Link href={`/${params.locale}/employer/candidates`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Candidates
          </Button>
        </Link>

        {/* Contact Information Header */}
        <ContactInfo contact={candidate.contacts[0] || null} />

        {/* Match Scores Section */}
        <MatchScoreSection candidateId={candidate.id} locale={params.locale} />

        {/* Resume Sections */}
        <ResumeSection resume={candidate.resumes[0] || null} />
      </div>
    </div>
  )
}

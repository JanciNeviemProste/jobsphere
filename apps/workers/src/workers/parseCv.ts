import { Job } from 'bullmq'
import { prisma } from '@jobsphere/db'
import {
  extractTextFromPDF,
  extractTextFromDOCX,
  extractCV,
  generateEmbeddings,
} from '@jobsphere/ai'
import * as fs from 'fs/promises'

interface ParseCvJobData {
  documentId: string
  candidateId: string
  orgId: string
}

export async function parseCvWorker(job: Job<ParseCvJobData>) {
  const { documentId, candidateId, orgId } = job.data

  console.log(`📄 Parsing CV for document ${documentId}`)

  try {
    // Get document from database
    const document = await prisma.candidateDocument.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw new Error('Document not found')
    }

    // Download file (assuming S3 URL in document.uri)
    // For demo, we'll simulate reading from filesystem
    let rawText: string

    if (document.mime === 'application/pdf') {
      // Read PDF
      const buffer = await fs.readFile(document.uri.replace('s3://', '/tmp/'))
      rawText = await extractTextFromPDF(buffer)
    } else if (
      document.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      // Read DOCX
      const buffer = await fs.readFile(document.uri.replace('s3://', '/tmp/'))
      rawText = await extractTextFromDOCX(buffer)
    } else {
      throw new Error(`Unsupported file type: ${document.mime}`)
    }

    // Store raw text
    await prisma.candidateDocument.update({
      where: { id: documentId },
      data: {
        parsedText: rawText,
        parsedAt: new Date(),
      },
    })

    // Extract structured data using AI
    const extractedData = await extractCV(rawText, 'en')

    // Create resume record
    const resume = await prisma.resume.create({
      data: {
        candidateId,
        sourceDocumentId: documentId,
        language: extractedData.personal?.summary ? 'en' : undefined,
        summary: extractedData.personal?.summary,
        yearsOfExperience: calculateYearsOfExperience(extractedData.experiences),
        personalInfo: extractedData.personal,
        experiences: extractedData.experiences as any,
        education: extractedData.education as any,
        skills: extractedData.skills,
        languages: extractedData.languages as any,
        certifications: extractedData.certifications as any,
        projects: extractedData.projects as any,
      },
    })

    // Update candidate contact if not exists
    if (extractedData.personal) {
      const existingContact = await prisma.candidateContact.findFirst({
        where: { candidateId, isPrimary: true },
      })

      if (!existingContact) {
        await prisma.candidateContact.create({
          data: {
            candidateId,
            fullName: extractedData.personal.name,
            email: extractedData.personal.email,
            phone: extractedData.personal.phone,
            location: extractedData.personal.location,
            isPrimary: true,
          },
        })
      }
    }

    // Queue for embeddings generation
    await job.queue.add(
      'embedChunks',
      {
        resumeId: resume.id,
        sections: [
          ...extractedData.experiences.map((exp) => ({
            kind: 'EXPERIENCE',
            title: exp.title,
            organization: exp.company,
            text: exp.description,
          })),
          ...extractedData.education.map((edu) => ({
            kind: 'EDUCATION',
            title: edu.degree,
            organization: edu.institution,
            text: `${edu.field || ''} ${edu.location || ''}`.trim(),
          })),
          ...extractedData.projects.map((proj) => ({
            kind: 'PROJECT',
            title: proj.name,
            text: proj.description,
          })),
        ],
      },
      {
        removeOnComplete: true,
      }
    )

    console.log(`✅ Parsed CV for document ${documentId}`)
    return { resumeId: resume.id }
  } catch (error) {
    console.error(`❌ Failed to parse CV:`, error)

    // Update document with error
    await prisma.candidateDocument.update({
      where: { id: documentId },
      data: {
        parseError: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    throw error
  }
}

function calculateYearsOfExperience(experiences: any[]): number {
  if (!experiences || experiences.length === 0) return 0

  const totalMonths = experiences.reduce((sum, exp) => {
    if (!exp.startDate) return sum

    const start = new Date(exp.startDate)
    const end = exp.endDate ? new Date(exp.endDate) : new Date()

    const months = (end.getFullYear() - start.getFullYear()) * 12 +
                   (end.getMonth() - start.getMonth())

    return sum + Math.max(0, months)
  }, 0)

  return Math.round(totalMonths / 12 * 10) / 10 // Round to 1 decimal
}
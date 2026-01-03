/**
 * Generate test CV files for E2E testing
 * Run with: node generate-test-files.js
 */

const fs = require('fs')
const path = require('path')
const PDFDocument = require('pdfkit')
const { Document, Packer, Paragraph, TextRun } = require('docx')

const outputDir = __dirname

// Generate sample CV PDF
function generateSamplePDF() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument()
    const outputPath = path.join(outputDir, 'sample-cv.pdf')
    const writeStream = fs.createWriteStream(outputPath)

    doc.pipe(writeStream)

    // Add CV content
    doc.fontSize(20).text('John Doe', { align: 'center' })
    doc.moveDown()
    doc.fontSize(12).text('Email: john.doe@example.com')
    doc.text('Phone: +1 (555) 123-4567')
    doc.text('Location: San Francisco, CA')
    doc.moveDown()

    doc.fontSize(16).text('Professional Summary', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(12).text(
      'Experienced software engineer with 5+ years of expertise in full-stack development, ' +
      'specializing in React, Node.js, and TypeScript. Proven track record of delivering ' +
      'scalable web applications and leading cross-functional teams.'
    )
    doc.moveDown()

    doc.fontSize(16).text('Experience', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(14).text('Senior Software Engineer - Tech Corp')
    doc.fontSize(11).text('January 2020 - Present', { italics: true })
    doc.fontSize(12).text(
      '• Led development of microservices architecture serving 1M+ users\n' +
      '• Implemented CI/CD pipeline reducing deployment time by 60%\n' +
      '• Mentored team of 5 junior developers'
    )
    doc.moveDown()

    doc.fontSize(14).text('Software Engineer - StartupCo')
    doc.fontSize(11).text('June 2018 - December 2019', { italics: true })
    doc.fontSize(12).text(
      '• Built React-based dashboard for data visualization\n' +
      '• Optimized API performance improving response time by 40%\n' +
      '• Collaborated with UX team on user interface improvements'
    )
    doc.moveDown()

    doc.fontSize(16).text('Education', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(12).text('B.S. Computer Science - University of California, Berkeley')
    doc.text('Graduated: May 2018')
    doc.moveDown()

    doc.fontSize(16).text('Skills', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(12).text(
      'JavaScript, TypeScript, React, Node.js, Next.js, PostgreSQL, MongoDB, ' +
      'Docker, Kubernetes, AWS, Git, Agile/Scrum'
    )

    doc.end()

    writeStream.on('finish', () => {
      console.log(`✓ Created: ${outputPath}`)
      resolve()
    })

    writeStream.on('error', reject)
  })
}

// Generate sample CV DOCX
async function generateSampleDOCX() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: 'Jane Smith',
              bold: true,
              size: 32,
            }),
          ],
          alignment: 'center',
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun('Email: jane.smith@example.com'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('Phone: +1 (555) 987-6543'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('Location: New York, NY'),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Professional Summary',
              bold: true,
              size: 28,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun(
              'Product manager with 7+ years of experience leading cross-functional teams ' +
              'to deliver innovative software products. Expert in agile methodologies, ' +
              'stakeholder management, and data-driven decision making.'
            ),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Experience',
              bold: true,
              size: 28,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Senior Product Manager - BigTech Inc',
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'March 2021 - Present',
              italics: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('• Managed product roadmap for SaaS platform with $10M ARR'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('• Led team of 12 engineers and designers through 3 major releases'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('• Increased user engagement by 45% through feature optimization'),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Product Manager - MediaCo',
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'January 2019 - February 2021',
              italics: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('• Launched mobile app achieving 500K downloads in first year'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('• Conducted user research informing product strategy'),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Education',
              bold: true,
              size: 28,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('MBA - Stanford Graduate School of Business'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('Graduated: June 2018'),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Skills',
              bold: true,
              size: 28,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun(
              'Product Strategy, Agile/Scrum, User Research, A/B Testing, ' +
              'SQL, Analytics, Jira, Figma, Roadmap Planning'
            ),
          ],
        }),
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  const outputPath = path.join(outputDir, 'sample-cv.docx')
  fs.writeFileSync(outputPath, buffer)
  console.log(`✓ Created: ${outputPath}`)
}

// Generate scanned PDF (image-based for OCR testing)
function generateScannedPDF() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument()
    const outputPath = path.join(outputDir, 'scanned-cv.pdf')
    const writeStream = fs.createWriteStream(outputPath)

    doc.pipe(writeStream)

    // Create a very minimal text-based PDF that simulates a scanned document
    // In real tests, this would be an image-based PDF requiring OCR
    doc.fontSize(10).text('SCANNED DOCUMENT', { align: 'center' })
    doc.moveDown()
    doc.fontSize(8).text('This simulates a scanned CV that would require OCR processing.')
    doc.moveDown()
    doc.text('Name: Robert Johnson')
    doc.text('Email: robert.j@example.com')
    doc.text('Skills: Python, Machine Learning, Data Analysis')

    // Add note that this is for testing
    doc.moveDown()
    doc.fontSize(6).text(
      'Note: In production, this would be an image-based PDF requiring Tesseract OCR.'
    )

    doc.end()

    writeStream.on('finish', () => {
      console.log(`✓ Created: ${outputPath}`)
      resolve()
    })

    writeStream.on('error', reject)
  })
}

// Generate large file for size limit testing
function generateLargeFile() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument()
    const outputPath = path.join(outputDir, 'large-cv.pdf')
    const writeStream = fs.createWriteStream(outputPath)

    doc.pipe(writeStream)

    // Add content to make file > 10MB
    doc.fontSize(12).text('LARGE FILE FOR TESTING', { align: 'center' })
    doc.moveDown()

    // Add lots of repeated content to increase file size
    for (let i = 0; i < 5000; i++) {
      doc.text(`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Line ${i}`)
    }

    doc.end()

    writeStream.on('finish', () => {
      const stats = fs.statSync(outputPath)
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
      console.log(`✓ Created: ${outputPath} (${sizeMB} MB)`)
      resolve()
    })

    writeStream.on('error', reject)
  })
}

// Generate malicious DOCX with macros (for testing rejection)
async function generateMacroDocx() {
  // Create a simple DOCX, then manually add vbaProject.bin file to it
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun('This file contains macros and should be rejected'),
          ],
        }),
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  const outputPath = path.join(outputDir, 'macro-infected.docx')

  // For testing purposes, we'll create a note file instead of actual malicious file
  // Real macro detection would find vbaProject.bin in the DOCX zip structure
  const JSZip = require('jszip')
  const zip = await JSZip.loadAsync(buffer)

  // Add a fake vbaProject.bin to simulate macro infection
  zip.file('word/vbaProject.bin', 'FAKE_MACRO_CONTENT_FOR_TESTING')

  const modifiedBuffer = await zip.generateAsync({ type: 'nodebuffer' })
  fs.writeFileSync(outputPath, modifiedBuffer)

  console.log(`✓ Created: ${outputPath} (with simulated macros)`)
}

// Main execution
async function main() {
  console.log('Generating test CV files...\n')

  try {
    await generateSamplePDF()
    await generateSampleDOCX()
    await generateScannedPDF()
    await generateLargeFile()
    await generateMacroDocx()

    console.log('\n✓ All test files generated successfully!')
    console.log('\nFiles created:')
    console.log('  - sample-cv.pdf (normal PDF with text)')
    console.log('  - sample-cv.docx (normal DOCX with text)')
    console.log('  - scanned-cv.pdf (simulated scanned document)')
    console.log('  - large-cv.pdf (file > 10MB for size testing)')
    console.log('  - macro-infected.docx (DOCX with macros for rejection testing)')
  } catch (error) {
    console.error('Error generating files:', error)
    process.exit(1)
  }
}

main()

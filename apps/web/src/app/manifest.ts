import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'JobSphere - AI-Powered Recruitment',
    short_name: 'JobSphere',
    description: 'AI-powered HR ATS and Job Board Platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#3b82f6',
    icons: [
      {
        src: '/images/jobsphere_logo.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  }
}

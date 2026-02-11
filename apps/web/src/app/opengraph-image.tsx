import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'JobSphere - AI-Powered Recruitment'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              fontWeight: 'bold',
              color: '#1e40af',
            }}
          >
            JS
          </div>
          <div
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              color: 'white',
              letterSpacing: '-2px',
            }}
          >
            JobSphere
          </div>
        </div>
        <div
          style={{
            fontSize: '28px',
            color: '#e2e8f0',
            marginTop: '8px',
          }}
        >
          AI-Powered Recruitment Platform
        </div>
        <div
          style={{
            fontSize: '18px',
            color: '#bfdbfe',
            marginTop: '16px',
            display: 'flex',
            gap: '24px',
          }}
        >
          <span>CV Parsing</span>
          <span>•</span>
          <span>Smart Matching</span>
          <span>•</span>
          <span>Automated Workflows</span>
        </div>
      </div>
    ),
    { ...size },
  )
}

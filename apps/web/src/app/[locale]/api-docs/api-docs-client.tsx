'use client'

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
// The stylesheet stays a static import: it is a plain .css file inside the package
// and pulls in none of the ~1 MB swagger-ui JS, so webpack emits it as a separate
// CSS chunk for this route. Moving it into the dynamic() factory would make the
// styles arrive a frame after the UI mounts.
import 'swagger-ui-react/swagger-ui.css'
import { logger } from '@/lib/logger'

function DocsPlaceholder({ label }: { label: string }) {
  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  )
}

// swagger-ui-react is ~1 MB of JS and is browser-only (it touches `window` during
// render). Loading it through next/dynamic with ssr:false keeps it out of the
// shared/first-load bundle — it is fetched only once this route is opened.
//
// The cast is the same escape hatch the previous static import needed:
// @types/swagger-ui-react vendors its own (React 19) @types/react, whose
// ReactNode is structurally incompatible with the React 18 types this app uses.
const SwaggerUI = dynamic(
  () => import('swagger-ui-react') as Promise<{ default: React.ComponentType<any> }>,
  {
    ssr: false,
    loading: () => <DocsPlaceholder label="Loading API documentation..." />,
  },
)

export default function ApiDocsClient() {
  const [spec, setSpec] = useState<string | null>(null)

  useEffect(() => {
    // Fetch the OpenAPI spec
    fetch('/docs/api/openapi.yaml')
      .then((res) => res.text())
      .then((text) => setSpec(text))
      .catch((err) => logger.error('Failed to load OpenAPI spec', err))
  }, [])

  if (!spec) {
    return <DocsPlaceholder label="Loading API documentation..." />
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">JobSphere API Documentation</h1>
        <p className="mt-2 text-muted-foreground">
          Complete API reference for JobSphere ATS platform
        </p>
      </div>

      <SwaggerUI spec={spec} />
    </div>
  )
}

'use client'

import React, { useEffect, useState } from 'react'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<string | null>(null)

  useEffect(() => {
    // Fetch the OpenAPI spec
    fetch('/docs/api/openapi.yaml')
      .then((res) => res.text())
      .then((text) => setSpec(text))
      .catch((err) => console.error('Failed to load OpenAPI spec:', err))
  }, [])

  if (!spec) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="text-muted-foreground">Loading API documentation...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">JobSphere API Documentation</h1>
        <p className="mt-2 text-muted-foreground">
          Complete API reference for JobSphere ATS platform
        </p>
      </div>

      {React.createElement(SwaggerUI as any, { spec })}
    </div>
  )
}

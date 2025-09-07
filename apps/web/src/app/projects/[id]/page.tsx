'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function ProjectPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  useEffect(() => {
    // Redirect to issues page by default
    router.push(`/projects/${projectId}/issues`)
  }, [projectId, router])

  return null
}
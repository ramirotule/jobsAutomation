'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveApplication } from '@/lib/applications'

interface Props {
  jobId: string
  title: string
  company: string
  location: string
  applyUrl: string
}

export function PostularButton({ jobId, title, company, location, applyUrl }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    if (applyUrl) window.open(applyUrl, '_blank', 'noopener,noreferrer')
    await saveApplication({
      jobId,
      title,
      company,
      location,
      applyUrl,
      appliedAt: new Date().toISOString(),
      status:    'applied',
      currency:  'USD',
    })
    router.push('/postulaciones')
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
    >
      {loading ? 'Guardando...' : 'Postular →'}
    </button>
  )
}

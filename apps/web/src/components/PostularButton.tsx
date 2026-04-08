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

  const handleApply = async () => {
    setLoading(true)
    
    try {
      const newApp = await saveApplication({
        jobId,
        title,
        company,
        location,
        applyUrl,
        appliedAt: new Date().toISOString(),
        status:    'applied',
        currency:  'USD',
      })
      
      if (newApp) {
        router.push(`/postulaciones/${newApp.id}`)
      } else {
        router.push('/postulaciones')
      }
    } catch (error) {
      console.error('Error saving application:', error)
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleApply}
      disabled={loading}
      className="bg-blue-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
    >
      {loading ? 'Preparando...' : 'Postular →'}
    </button>
  )
}

import { NextResponse } from 'next/server'
import { getJobById } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { jobId, action } = await req.json()

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    const job = await getJobById(jobId)
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const n8nUrl = process.env.N8N_BASE_URL + '/webhook/social-publish'
    
    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': process.env.N8N_API_KEY || '',
      },
      body: JSON.stringify({
        action: action || 'publish', // publish, unpublish, republish
        job: {
          id: job.id,
          title: job.title,
          company: job.company,
          description: job.description,
          location: job.location,
          applyUrl: job.applyUrl,
          socialMediaId: job.socialMediaId,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: `n8n error: ${errorText}` }, { status: 500 })
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Publish API error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

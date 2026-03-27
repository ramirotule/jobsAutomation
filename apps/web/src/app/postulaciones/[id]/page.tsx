'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getApplication, updateApplication, STATUS_LABELS, STATUS_COLORS } from '@/lib/applications'
import type { StoredApplication, AppStatus } from '@/lib/applications'

const STATUS_ORDER: AppStatus[] = ['applied', 'screening', 'interview', 'offer', 'rejected', 'ghosted']

const STATUS_DESCRIPTIONS: Record<AppStatus, string> = {
  applied:   'Postulación enviada, esperando respuesta',
  screening: 'En proceso de revisión inicial / HR',
  interview: 'Entrevista agendada o en curso',
  offer:     'Oferta recibida',
  rejected:  'Candidatura rechazada',
  ghosted:   'Sin respuesta tras seguimiento',
}

export default function PostulacionDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const id       = params.id as string

  const [app, setApp]       = useState<StoredApplication | null>(null)
  const [saved, setSaved]   = useState(false)
  const [form, setForm]     = useState({
    status:            'applied' as AppStatus,
    salaryExpectation: '',
    salaryOffered:     '',
    currency:          'USD',
    benefits:          '',
    notes:             '',
  })

  useEffect(() => {
    getApplication(id).then(data => {
      if (!data) { router.push('/postulaciones'); return }
      setApp(data)
      setForm({
        status:            data.status,
        salaryExpectation: data.salaryExpectation?.toString() ?? '',
        salaryOffered:     data.salaryOffered?.toString() ?? '',
        currency:          data.currency ?? 'USD',
        benefits:          data.benefits ?? '',
        notes:             data.notes ?? '',
      })
    })
  }, [id, router])

  const handleSave = async () => {
    await updateApplication(id, {
      status:            form.status,
      salaryExpectation: form.salaryExpectation ? Number(form.salaryExpectation) : undefined,
      salaryOffered:     form.salaryOffered ? Number(form.salaryOffered) : undefined,
      currency:          form.currency,
      benefits:          form.benefits || undefined,
      notes:             form.notes || undefined,
    })
    setApp(prev => prev ? { ...prev, status: form.status } : prev)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  if (!app) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">

        <Link
          href="/postulaciones"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          ← Volver a postulaciones
        </Link>

        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{app.title}</h1>
              <p className="text-gray-600 mt-0.5 font-medium">{app.company}</p>
              {app.location && <p className="text-sm text-gray-400 mt-0.5">{app.location}</p>}
            </div>
            {app.applyUrl && (
              <a
                href={app.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Ver oferta ↗
              </a>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Postulado el {new Date(app.appliedAt).toLocaleDateString('es-AR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })}
          </p>
        </div>

        {/* Status */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Estado</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STATUS_ORDER.map(s => (
              <button
                key={s}
                onClick={() => set('status', s)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  form.status === s
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className={`text-xs font-semibold ${form.status === s ? 'text-white' : ''}`}>
                  {STATUS_LABELS[s]}
                </p>
                <p className={`text-xs mt-0.5 leading-snug ${form.status === s ? 'text-gray-300' : 'text-gray-400'}`}>
                  {STATUS_DESCRIPTIONS[s]}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Salary */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Salario</h2>

          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Moneda</label>
            <div className="flex gap-2">
              {['USD', 'ARS'].map(c => (
                <button
                  key={c}
                  onClick={() => set('currency', c)}
                  className={`text-sm px-4 py-1.5 rounded-lg border transition-colors ${
                    form.currency === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Mi pretensión ({form.currency}/mes)
              </label>
              <input
                type="number"
                value={form.salaryExpectation}
                onChange={e => set('salaryExpectation', e.target.value)}
                placeholder="ej: 3500"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Salario ofrecido ({form.currency}/mes)
              </label>
              <input
                type="number"
                value={form.salaryOffered}
                onChange={e => set('salaryOffered', e.target.value)}
                placeholder="ej: 4000"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Beneficios ofrecidos</h2>
          <textarea
            value={form.benefits}
            onChange={e => set('benefits', e.target.value)}
            rows={3}
            placeholder="ej: OSDE 410, bono anual, días extra, equipamiento, budget de capacitación..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Notes */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Notas de entrevista
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            Stack técnico, cultura, preguntas que te hicieron, sensaciones, próximos pasos...
          </p>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={8}
            placeholder={`# Entrevista 1 — ${new Date().toLocaleDateString('es-AR')}\n\nEntrevistador:\nStack técnico:\nPreguntas:\n\nSensación general:\nPróximos pasos:`}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
          />
        </div>

        {/* Save */}
        <div className="flex items-center justify-between">
          <Link href="/postulaciones" className="text-sm text-gray-500 hover:text-gray-900">
            Cancelar
          </Link>
          <button
            onClick={handleSave}
            className={`text-sm font-medium px-6 py-2.5 rounded-lg transition-colors ${
              saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saved ? 'Guardado ✓' : 'Guardar cambios'}
          </button>
        </div>

      </div>
    </div>
  )
}

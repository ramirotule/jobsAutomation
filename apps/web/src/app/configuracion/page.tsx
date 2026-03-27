'use client'

import { useState } from 'react'

export default function ConfiguracionPage() {
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [email, setEmail] = useState('ramirotule@gmail.com')
  const [minScore, setMinScore] = useState(75)
  const [telegramEnabled, setTelegramEnabled] = useState(false)
  const [telegramChatId, setTelegramChatId] = useState('')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    // Por ahora sólo muestra confirmación — la config real vive en n8n / .env
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
          <p className="text-gray-500 text-sm mt-1">Configuración de notificaciones de nuevas vacantes</p>
        </div>

        {/* Score threshold */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Score mínimo para alertas</h2>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-2xl font-bold text-blue-600 w-12 text-right">{minScore}</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Solo recibirás alertas para vacantes con score ≥ {minScore}. Recomendado: 75+
          </p>
        </div>

        {/* Email */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Email</h2>
            <Toggle enabled={emailEnabled} onChange={setEmailEnabled} />
          </div>
          {emailEnabled && (
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tu@email.com"
            />
          )}
          <p className="text-xs text-gray-400 mt-2">
            Configurado vía SMTP en n8n. Credenciales en el nodo <code>Email - Send Alert</code>.
          </p>
        </div>

        {/* Telegram */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Telegram</h2>
            <Toggle enabled={telegramEnabled} onChange={setTelegramEnabled} />
          </div>
          {telegramEnabled && (
            <div className="space-y-3">
              <input
                value={telegramChatId}
                onChange={e => setTelegramChatId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Chat ID (ej: 123456789)"
              />
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                <p className="font-medium">Cómo obtener tu Chat ID:</p>
                <p>1. Buscá <strong>@userinfobot</strong> en Telegram</p>
                <p>2. Mandále cualquier mensaje</p>
                <p>3. Te responde con tu Chat ID</p>
                <p className="mt-2 font-medium">Luego en n8n:</p>
                <p>Agregá un nodo <strong>Telegram</strong> con tu Bot Token y este Chat ID.</p>
              </div>
            </div>
          )}
          {!telegramEnabled && (
            <p className="text-xs text-gray-400">
              Activá para recibir alertas instantáneas en Telegram vía bot.
            </p>
          )}
        </div>

        {/* Info n8n */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
          <p className="font-medium mb-1">Las alertas se disparan desde n8n</p>
          <p className="text-xs">
            El workflow corre cada 2 horas. Cuando encuentra vacantes con score ≥ {minScore},
            dispara el nodo <code>Email - Send Alert</code>. El score mínimo se configura
            en el nodo <code>Config - My Profile</code> (campo <code>alertScoreThreshold</code>).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Guardar preferencias
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">✓ Guardado</span>
          )}
        </div>

      </div>
    </div>
  )
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

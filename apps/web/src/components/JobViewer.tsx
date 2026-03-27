'use client'

import { useState } from 'react'

export function JobViewerButton({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [blocked, setBlocked] = useState(false)

  return (
    <>
      <button
        onClick={() => { setOpen(true); setBlocked(false) }}
        className="shrink-0 text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Ver empleo ↗
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Side panel */}
          <div className="w-full max-w-3xl bg-white flex flex-col shadow-2xl">

            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
              <p className="text-sm font-medium text-gray-700 truncate pr-4">{title}</p>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Abrir en nueva pestaña ↗
                </a>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Blocked warning */}
            {blocked && (
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between gap-4">
                <p className="text-xs text-amber-700">
                  Este sitio bloquea la vista previa. Abrilo en una nueva pestaña para ver el empleo.
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Abrir ↗
                </a>
              </div>
            )}

            {/* iframe */}
            <iframe
              src={url}
              className="flex-1 w-full border-0"
              title={title}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onError={() => setBlocked(true)}
              onLoad={e => {
                // Detect if the iframe was blocked (blank page or about:blank)
                try {
                  const frame = e.currentTarget as HTMLIFrameElement
                  if (!frame.contentDocument || frame.contentDocument.URL === 'about:blank') {
                    setBlocked(true)
                  }
                } catch {
                  // cross-origin block
                  setBlocked(true)
                }
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}

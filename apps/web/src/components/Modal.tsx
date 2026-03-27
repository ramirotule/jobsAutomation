'use client'

import { useEffect } from 'react'

// ─── Alert modal ──────────────────────────────────────────────────────────────
interface AlertModalProps {
  open: boolean
  title?: string
  message: string
  onClose: () => void
  variant?: 'info' | 'error'
}

export function AlertModal({ open, title, message, onClose, variant = 'info' }: AlertModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <Backdrop onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        {title && (
          <h2 className={`text-base font-semibold mb-2 ${variant === 'error' ? 'text-red-600' : 'text-gray-900'}`}>
            {title}
          </h2>
        )}
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        <button
          onClick={onClose}
          className="mt-5 w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 transition-colors"
        >
          Entendido
        </button>
      </div>
    </Backdrop>
  )
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open, title, message,
  confirmLabel = 'Confirmar',
  cancelLabel  = 'Cancelar',
  variant      = 'default',
  onConfirm, onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <Backdrop onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        {title && (
          <h2 className="text-base font-semibold text-gray-900 mb-2">{title}</h2>
        )}
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 text-sm font-medium py-2.5 rounded-xl transition-colors ${
              variant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Backdrop>
  )
}

// ─── Shared backdrop ──────────────────────────────────────────────────────────
function Backdrop({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClick}
    >
      {children}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteJobPost } from '@/lib/supabase'
import { ConfirmModal } from '@/components/Modal'

export function DeleteJobButton({ id }: { id: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const doDelete = async () => {
    setDeleting(true)
    await deleteJobPost(id)
    router.push('/vacantes')
  }

  return (
    <>
      <ConfirmModal
        open={confirm}
        title="¿Eliminar vacante?"
        message="Esta vacante se eliminará de la base de datos. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setConfirm(false)}
      />

      <div className="flex items-center gap-4">
        <p className="text-sm text-gray-500">¿No te interesa esta posición?</p>
        <button
          onClick={() => setConfirm(true)}
          disabled={deleting}
          className="flex items-center gap-2 shrink-0 bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
          </svg>
          {deleting ? 'Eliminando...' : 'Eliminar vacante'}
        </button>
      </div>
    </>
  )
}

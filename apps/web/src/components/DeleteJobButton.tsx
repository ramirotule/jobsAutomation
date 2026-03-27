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

      <button
        onClick={() => setConfirm(true)}
        disabled={deleting}
        title="Eliminar vacante"
        className="fixed bottom-6 right-6 w-12 h-12 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 shadow-md hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all disabled:opacity-50"
      >
        {deleting ? (
          <span className="text-xs">...</span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
          </svg>
        )}
      </button>
    </>
  )
}

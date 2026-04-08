'use client'

export function JobViewerButton({ url }: { url: string; title: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 text-sm border border-gray-200 text-gray-600 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-semibold shadow-sm flex items-center gap-2"
    >
      Ver empleo ↗
    </a>
  )
}

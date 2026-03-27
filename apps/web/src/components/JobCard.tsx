'use client'

import type { JobMatch, JobStatus } from '@/types'
import { STATUS_LABELS, STATUS_COLORS, SCORE_COLOR } from '@/types'

interface JobCardProps {
  match: JobMatch
  onStatusChange: (id: string, status: JobStatus) => void
}

export function JobCard({ match, onStatusChange }: JobCardProps) {
  const scoreColor = SCORE_COLOR(match.score)

  const salary =
    match.salaryMin || match.salaryMax
      ? `${match.salaryCurrency ?? 'USD'} ${
          match.salaryMin ? `${(match.salaryMin / 1000).toFixed(0)}k` : ''
        }${match.salaryMin && match.salaryMax ? ' – ' : ''}${
          match.salaryMax ? `${(match.salaryMax / 1000).toFixed(0)}k` : ''
        } / ${match.salaryPeriod ?? 'yr'}`
      : null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm truncate">{match.title}</h3>
          <p className="text-gray-500 text-xs mt-0.5">{match.company}</p>
        </div>

        {/* Score badge */}
        <div className={`text-2xl font-bold ${scoreColor} shrink-0`}>
          {match.score}
          <span className="text-xs font-normal text-gray-400">/100</span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {match.sourceName && (
          <Tag variant="gray">{match.sourceName}</Tag>
        )}
        {match.modality && (
          <Tag variant={match.modality === 'remote' ? 'green' : 'blue'}>
            {match.modality}
          </Tag>
        )}
        {match.seniority && match.seniority !== 'unknown' && (
          <Tag variant="purple">{match.seniority}</Tag>
        )}
        {salary && <Tag variant="yellow">{salary}</Tag>}
      </div>

      {/* Skills */}
      {match.requiredSkills && match.requiredSkills.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {match.requiredSkills.slice(0, 5).map(skill => (
            <span key={skill} className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
              {skill}
            </span>
          ))}
          {match.requiredSkills.length > 5 && (
            <span className="text-xs text-gray-400">+{match.requiredSkills.length - 5} más</span>
          )}
        </div>
      )}

      {/* Match reasons */}
      {match.matchReasons?.length > 0 && (
        <ul className="mt-3 space-y-0.5">
          {match.matchReasons.slice(0, 3).map((r, i) => (
            <li key={i} className="text-xs text-green-700 flex items-center gap-1">
              <span>✓</span> {r}
            </li>
          ))}
        </ul>
      )}

      {/* Flags */}
      {match.flags?.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {match.flags.map((f, i) => (
            <li key={i} className="text-xs text-amber-600 flex items-center gap-1">
              <span>⚠</span> {f}
            </li>
          ))}
        </ul>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {/* Status selector */}
          <select
            value={match.status}
            onChange={e => onStatusChange(match.id, e.target.value as JobStatus)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(Object.keys(STATUS_LABELS) as JobStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>

          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[match.status]}`}>
            {STATUS_LABELS[match.status]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {match.postedAt && (
            <span className="text-xs text-gray-400">
              {new Date(match.postedAt).toLocaleDateString('es-AR')}
            </span>
          )}
          {match.applyUrl && (
            <a
              href={match.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1 hover:bg-blue-700 transition-colors"
            >
              Postular →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Tag helper
// ============================================================
type TagVariant = 'gray' | 'green' | 'blue' | 'purple' | 'yellow'

const TAG_STYLES: Record<TagVariant, string> = {
  gray:   'bg-gray-100 text-gray-600',
  green:  'bg-green-100 text-green-700',
  blue:   'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  yellow: 'bg-yellow-100 text-yellow-700',
}

function Tag({ children, variant }: { children: React.ReactNode; variant: TagVariant }) {
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${TAG_STYLES[variant]}`}>
      {children}
    </span>
  )
}

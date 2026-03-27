'use client'

const FRONTEND_KEYWORDS = [
  'React Native', 'React.js', 'React',
  'TypeScript', 'JavaScript', 'JS', 'TS',
  'Next.js', 'NextJS',
  'Redux', 'Zustand', 'MobX', 'MobX-State-Tree',
  'GraphQL', 'Apollo',
  'Tailwind', 'CSS', 'SCSS', 'Sass', 'Styled Components',
  'HTML', 'HTML5',
  'Expo', 'React Navigation',
  'MUI', 'Material UI', 'Chakra', 'Ant Design',
  'Vite', 'Webpack',
  'iOS', 'Android', 'Mobile',
  'Frontend', 'Front-end', 'Front end',
  'UI', 'UX', 'UI/UX',
  'Figma', 'Storybook',
  'Jest', 'Testing Library', 'Cypress', 'Playwright',
  'Firebase',
]

const BACKEND_KEYWORDS = [
  'Node.js', 'NodeJS',
  'Python', 'Django', 'Flask', 'FastAPI',
  'Java', 'Spring', 'Kotlin',
  'Go', 'Golang',
  'Ruby', 'Rails',
  'PHP', 'Laravel',
  'Rust', 'C++', 'C#', '.NET',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'SQL', 'NoSQL',
  'REST API', 'REST', 'Microservices', 'Microservice',
  'Docker', 'Kubernetes', 'K8s',
  'AWS', 'GCP', 'Azure', 'Cloud',
  'DevOps', 'CI/CD', 'Jenkins', 'GitHub Actions',
  'Terraform', 'Ansible',
  'Linux', 'Bash', 'Shell',
  'Backend', 'Back-end', 'Back end',
  'Full Stack', 'Full-Stack', 'Fullstack',
  'Server', 'Serverless', 'Lambda',
  'Kafka', 'RabbitMQ', 'Celery',
  'nginx', 'Apache',
  'gRPC',
]

type Segment = { text: string; type: 'frontend' | 'backend' | 'plain' }

function tokenize(text: string): Segment[] {
  // Build a single regex that matches all keywords, longest first to avoid partial matches
  const allKeywords = [...FRONTEND_KEYWORDS, ...BACKEND_KEYWORDS]
    .sort((a, b) => b.length - a.length)

  const pattern = allKeywords
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')

  const regex = new RegExp(`(${pattern})`, 'gi')
  const parts = text.split(regex)

  return parts.map(part => {
    const lower = part.toLowerCase()
    const isFrontend = FRONTEND_KEYWORDS.some(k => k.toLowerCase() === lower)
    const isBackend  = BACKEND_KEYWORDS.some(k => k.toLowerCase() === lower)
    if (isFrontend) return { text: part, type: 'frontend' }
    if (isBackend)  return { text: part, type: 'backend' }
    return { text: part, type: 'plain' }
  })
}

export function HighlightedDescription({ text }: { text: string }) {
  const segments = tokenize(text)

  return (
    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
      {segments.map((seg, i) => {
        if (seg.type === 'frontend') {
          return (
            <mark key={i} className="bg-green-100 text-green-800 rounded px-0.5 font-medium not-italic">
              {seg.text}
            </mark>
          )
        }
        if (seg.type === 'backend') {
          return (
            <mark key={i} className="bg-red-100 text-red-700 rounded px-0.5 font-medium not-italic">
              {seg.text}
            </mark>
          )
        }
        return <span key={i}>{seg.text}</span>
      })}
      {/* Legend */}
      <div className="flex gap-4 mt-5 pt-4 border-t border-gray-100">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="inline-block w-3 h-3 rounded bg-green-200" /> Frontend / relevante
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="inline-block w-3 h-3 rounded bg-red-200" /> Backend / no requerido
        </span>
      </div>
    </div>
  )
}

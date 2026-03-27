'use client'

const FRONTEND_KEYWORDS = [
  'React Native', 'React.js', 'React',
  'TypeScript', 'JavaScript',
  'Next.js', 'NextJS',
  'Redux', 'Zustand', 'MobX',
  'GraphQL', 'Apollo',
  'Tailwind', 'SCSS', 'Sass', 'Styled Components',
  'HTML5', 'HTML',
  'Expo', 'React Navigation',
  'MUI', 'Material UI', 'Chakra', 'Ant Design',
  'Vite', 'Webpack',
  'iOS', 'Android',
  'Frontend', 'Front-end',
  'UI/UX', 'UX', 'UI',
  'Figma', 'Storybook',
  'Jest', 'Cypress', 'Playwright',
  'Firebase',
  'Mobile',
  'CSS',
  'JS', 'TS',
]

const BACKEND_KEYWORDS = [
  'Node.js', 'NodeJS',
  'Python', 'Django', 'Flask', 'FastAPI',
  'Java', 'Spring', 'Kotlin',
  'Golang', 'Go',
  'Ruby', 'Rails',
  'PHP', 'Laravel',
  'Rust',
  'C#', '.NET',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'NoSQL', 'SQL',
  'Microservices',
  'Docker', 'Kubernetes', 'K8s',
  'AWS', 'GCP', 'Azure',
  'DevOps', 'CI/CD', 'Jenkins',
  'Terraform', 'Ansible',
  'Linux', 'Bash',
  'Backend', 'Back-end',
  'Full Stack', 'Full-Stack', 'Fullstack',
  'Serverless',
  'Kafka', 'RabbitMQ',
  'nginx', 'gRPC',
]

type Segment = { text: string; type: 'frontend' | 'backend' | 'plain' }

function tokenize(text: string): Segment[] {
  const allKeywords = [...FRONTEND_KEYWORDS, ...BACKEND_KEYWORDS]
    .sort((a, b) => b.length - a.length)

  const escaped = allKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  // Use lookahead/lookbehind so we only match whole words,
  // not letters that happen to appear inside another word.
  const regex = new RegExp(
    `(?<![a-zA-Z0-9])(${escaped.join('|')})(?![a-zA-Z0-9])`,
    'gi',
  )

  const segments: Segment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(regex)) {
    const start   = match.index!
    const matched = match[0]

    if (start > lastIndex) {
      segments.push({ text: text.slice(lastIndex, start), type: 'plain' })
    }

    const lower      = matched.toLowerCase()
    const isFrontend = FRONTEND_KEYWORDS.some(k => k.toLowerCase() === lower)
    segments.push({ text: matched, type: isFrontend ? 'frontend' : 'backend' })

    lastIndex = start + matched.length
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), type: 'plain' })
  }

  return segments
}

export function HighlightedDescription({ text }: { text: string | null | undefined }) {
  if (!text) {
    return (
      <p className="text-sm text-gray-400 italic">No description available.</p>
    )
  }

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

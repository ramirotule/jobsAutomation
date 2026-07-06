export interface ScoringConfig {
  title?: string;
  target_roles?: string[];
  primary_skills?: string[];
  secondary_skills?: string[];
  blacklist_terms?: string[];
  location?: string;
  languages?: { lang: string; level: string }[];
  seniority?: string;
}

export type MatchType = 'intent' | 'blacklist' | 'role' | 'primary' | 'secondary';

export interface ScoringMatch {
  term: string;
  type: MatchType;
  points: number;
}

export interface ScoringResult {
  score: number;
  matches: ScoringMatch[];
  seniorityMismatch?: 'stretch' | 'down_level' | 'too_high';
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Crea una Regex segura para hacer match de términos técnicos.
 * Si el término empieza o termina con un caracter de palabra (a-z, 0-9), usa \b.
 * Si termina en un caracter no-palabra (ej: C++, C#), usa un límite de espacio o final de string.
 */
function createSafeRegex(term: string) {
  const escaped = escapeRegExp(term);
  const startBound = /^\\w/.test(term) ? "\\b" : "(?:^|\\s)";
  const endBound = /\\w$/.test(term) ? "\\b" : "(?:\\s|[.,!?;:)]|$)";
  return new RegExp(`${startBound}${escaped}${endBound}`, "i");
}

export function calculateHeuristicScore(postText: string, config: ScoringConfig): ScoringResult {
  let score = 0;
  const matches: ScoringMatch[] = [];
  
  if (!postText) return { score, matches };

  // 1. Intent Blacklist (Descarte por candidato buscando trabajo o compartiendo proyectos/certificados)
  const isJobPost = /(#hiring|we('re| are) hiring|estamos buscando|estamos contratando|se busca|buscamos|vagas?( de emprego)?|oportunidades?|posiciones abiertas|apply (here|now|via|link)|send (your )?cv|env[íi]a(nos)? tu cv|post[úu]late|te estamos buscando|sumate a(l equipo| nuestro equipo)?|join our team|vacante|job alert|(nueva|excelente) (oportunidad|vacante)|buscamos talento|b[úu]squeda (laboral|abierta)|we are looking for|is hiring|now hiring|estamos en b[úu]squeda)/i.test(postText);

  // Intentos explícitos de buscar trabajo
  const intentRegexes = [
    { regex: /(busco|buscando|en b[úu]squeda de)\s+(trabajo|empleo|nuevos desaf[íi]os|oportunidades)/i, bypassIfJobPost: true },
    { regex: /(disponible|disponibilidad) para (trabajar|escuchar propuestas)/i, bypassIfJobPost: true },
    { regex: /looking for (a )?job/i, bypassIfJobPost: true },
    { regex: /#opentowork/i, bypassIfJobPost: true },
    { regex: /mi cv/i, bypassIfJobPost: false }, // Casi exclusivo de candidatos
    { regex: /dejo mi cv/i, bypassIfJobPost: false },
    { regex: /en b[úu]squeda activa/i, bypassIfJobPost: true },
    { regex: /looking for a (new )?(role|job|opportunity)/i, bypassIfJobPost: true },
    { regex: /open to new opportunities/i, bypassIfJobPost: true }
  ];

  // Intentos de compartir proyectos, certificados o logros (suelen inflar skills y dar falsos positivos)
  const showcaseRegexes = [
    /(quiero|quer[íi]a)\s+compartir/i,
    /(me|estoy)\s+(orgulloso|enorgullece|alegra)\s+(de|compartir)/i,
    /proud to (share|announce)/i,
    /happy to (share|announce)/i,
    /I'm thrilled to share/i,
    /I'm happy to announce/i,
    /my latest project/i,
    /mi [úu]ltimo proyecto/i,
    /nuevo (logro|proyecto|desafío) superado/i,
    /acabo de (terminar|completar|certificar)/i,
    /just finished (my|a) (course|certification|project)/i,
    /certificado (de|en)/i,
    /mi certificado/i,
    /certificate of/i,
    /complet[é|e] el curso/i,
    /comparto( un)? (proyecto|logro)/i,
    /les comparto/i
  ];

  for (const { regex, bypassIfJobPost } of intentRegexes) {
    const match = postText.match(regex);
    if (match) {
      if (bypassIfJobPost && isJobPost) {
        continue; // Reclutador usando hashtags de candidatos para ganar alcance
      }
      score -= 1000;
      matches.push({ term: match[0], type: 'intent', points: -1000 });
    }
  }

  for (const regex of showcaseRegexes) {
    const match = postText.match(regex);
    if (match) {
      if (isJobPost) {
        continue; // A veces los reclutadores dicen "me enorgullece anunciar esta vacante"
      }
      score -= 500;
      matches.push({ term: match[0], type: 'blacklist', points: -500 });
    }
  }

  // 2. User Blacklist
  if (config.blacklist_terms && config.blacklist_terms.length > 0) {
    for (const term of config.blacklist_terms) {
      const t = term.trim();
      if (!t) continue;
      const regex = createSafeRegex(t);
      if (regex.test(postText)) {
        score -= 100;
        matches.push({ term: t, type: 'blacklist', points: -100 });
      }
    }
  }

  // 3. Target Role Match
  const allRoles = [];
  if (config.title && config.title.trim()) allRoles.push(config.title.trim());
  if (config.target_roles) allRoles.push(...config.target_roles.filter(r => r.trim()));
  
  let roleMatched = false;
  for (const r of allRoles) {
    if (roleMatched) break;
    const regex = createSafeRegex(r);
    if (regex.test(postText)) {
      score += 20;
      matches.push({ term: r, type: 'role', points: 20 });
      roleMatched = true;
    }
  }

  // 4. Primary Skills
  if (config.primary_skills && config.primary_skills.length > 0) {
    for (const skill of config.primary_skills) {
      const s = skill.trim();
      if (!s) continue;
      const regex = createSafeRegex(s);
      if (regex.test(postText)) {
        score += 10;
        matches.push({ term: s, type: 'primary', points: 10 });
      }
    }
  }

  // 5. Secondary Skills
  if (config.secondary_skills && config.secondary_skills.length > 0) {
    for (const skill of config.secondary_skills) {
      const s = skill.trim();
      if (!s) continue;
      const regex = createSafeRegex(s);
      if (regex.test(postText)) {
        score += 5;
        matches.push({ term: s, type: 'secondary', points: 5 });
      }
    }
  }

  // 6. Location Anti-pattern (Penalizar si la oferta es restrictiva y el candidato es de LATAM)
  if (config.location && config.location.trim()) {
    const loc = config.location.toLowerCase();
    const isLatam = /argentina|colombia|mexico|chile|peru|uruguay|latam/i.test(loc);
    if (isLatam) {
      const exclusiveZones = [
        /us only/i, /usa only/i, /uk only/i, /europe only/i, /eu only/i,
        /must be located in (the )?(us|uk|europe)/i,
        /only accepting.*(us|uk|europe)/i,
        /must live in (the )?(us|uk|europe)/i
      ];
      for (const regex of exclusiveZones) {
        const match = postText.match(regex);
        if (match) {
          score -= 500;
          matches.push({ term: match[0], type: 'blacklist', points: -500 });
          break; // penalizar una sola vez
        }
      }
    }
  }

  // 7. Language Anti-pattern (Penalizar si la oferta pide inglés avanzado y el candidato es básico)
  if (config.languages && config.languages.length > 0) {
    const english = config.languages.find(l => l.lang.toLowerCase().includes('english') || l.lang.toLowerCase().includes('inglés') || l.lang.toLowerCase().includes('ingles'));
    if (english) {
      const isBasic = ['A1', 'A2', 'B1'].includes(english.level);
      if (isBasic) {
        const fluentEnglishReqs = [
          /fluent english/i, /native english/i, /c1 english/i, /c2 english/i, /advanced english/i,
          /bilingual/i, /inglés biling[üu]e/i, /inglés avanzado/i, /excellent english/i, /strong english/i
        ];
        for (const regex of fluentEnglishReqs) {
          const match = postText.match(regex);
          if (match) {
            score -= 500;
            matches.push({ term: match[0], type: 'blacklist', points: -500 });
            break;
          }
        }
      }
    }
  }

  // 8. Seniority Mismatch Strategy
  let seniorityMismatch: 'stretch' | 'down_level' | 'too_high' | undefined;
  if (config.seniority && config.seniority !== "unknown") {
    const userSen = config.seniority.toLowerCase(); // "junior", "mid", "senior", "staff", "lead"
    
    // Detect Job Seniority
    const jobIsSr = /\b(senior|sr\b|lead|principal|arquitecto|architect)\b/i.test(postText);
    const jobIsMid = /\b(mid|ssr\b|semi[-\s]?senior)\b/i.test(postText);
    const jobIsJr = /\b(junior|jr\b|trainee|entry[-\s]?level)\b/i.test(postText);
    
    if (userSen === "mid") {
      if (jobIsSr && !jobIsMid && !jobIsJr) {
        seniorityMismatch = 'stretch';
        score += 10;
        matches.push({ term: "Senior Role (Stretch)", type: "role", points: 10 });
      } else if (jobIsJr && !jobIsMid && !jobIsSr) {
        seniorityMismatch = 'down_level';
        score -= 100; // Minor penalty
        matches.push({ term: "Junior Role (Down Level)", type: "blacklist", points: -100 });
      }
    } else if (userSen === "junior") {
      if (jobIsSr) {
        seniorityMismatch = 'too_high';
        score -= 300; // Strong penalty
        matches.push({ term: "Senior Role (Mismatch)", type: "blacklist", points: -300 });
      } else if (jobIsMid && !jobIsSr) {
        seniorityMismatch = 'stretch';
        score += 10;
        matches.push({ term: "Mid Role (Stretch)", type: "role", points: 10 });
      }
    } else if (["senior", "staff", "lead"].includes(userSen)) {
      if (jobIsJr) {
        seniorityMismatch = 'down_level';
        score -= 200;
        matches.push({ term: "Junior Role (Down Level)", type: "blacklist", points: -200 });
      } else if (jobIsMid && !jobIsSr) {
        seniorityMismatch = 'down_level';
        score -= 50;
        matches.push({ term: "Mid Role (Down Level)", type: "blacklist", points: -50 });
      }
    }
  }

  return { score, matches, seniorityMismatch };
}

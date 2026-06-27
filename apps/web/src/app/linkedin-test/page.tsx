"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface Author {
  name?: string;
  headline?: string;
  profileUrl?: string;
  profileImage?: string;
}

interface LinkedInPost {
  id?: string;
  url?: string;
  postUrl?: string;
  text?: string;
  postedAt?: string;
  publishedAt?: string;
  author?: Author;
  likesCount?: number;
  commentsCount?: number;
  repostsCount?: number;
}

interface FilteredResults {
  relevant: LinkedInPost[];
  review: LinkedInPost[];
  discarded: LinkedInPost[];
}

interface UserConfig {
  blacklist_terms: string[];
  blacklist_threshold: number;
  llm_provider: string;
  llm_api_key: string;
  title?: string;
  primary_skills?: string[];
  secondary_skills?: string[];
}

function applyBlacklistFilter(
  posts: LinkedInPost[],
  terms: string[],
  threshold: number
): FilteredResults {
  const relevant: LinkedInPost[] = [];
  const review: LinkedInPost[] = [];
  const discarded: LinkedInPost[] = [];

  for (const post of posts) {
    const text = (post.text ?? "").toLowerCase();
    let totalHits = 0;
    for (const term of terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = text.match(new RegExp(escaped, "gi"));
      if (matches) totalHits += matches.length;
    }
    if (totalHits === 0) relevant.push(post);
    else if (totalHits < threshold) review.push(post);
    else discarded.push(post);
  }

  return { relevant, review, discarded };
}

export default function LinkedInTestPage() {
  const [searchQuery, setSearchQuery] = useState("frontend developer React");
  const [maxResults, setMaxResults] = useState(50);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [results, setResults] = useState<LinkedInPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filter & scoring state
  const [userConfig, setUserConfig] = useState<UserConfig | null>(null);
  const [filteredResults, setFilteredResults] = useState<FilteredResults>({ relevant: [], review: [], discarded: [] });
  const [activeResultTab, setActiveResultTab] = useState<"relevant" | "review" | "discarded">("relevant");
  const [scoring, setScoring] = useState(false);
  const [scores, setScores] = useState<Record<string, { score: number; reason: string }>>({});

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("search_profiles")
        .select("blacklist_terms, blacklist_threshold, llm_provider, llm_api_key, title, primary_skills, secondary_skills")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setUserConfig(data as UserConfig);
    };
    loadConfig();
  }, []);

  const cleanupPolling = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    cleanupPolling();

    if (!searchQuery) {
      setError("El término de búsqueda no puede estar vacío.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setStatusMessage("Iniciando actor en Apify...");

    try {
      // 1. Iniciar el run usando la acción 'start'
      const startResponse = await fetch("/api/linkedin-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "start",
          searchQuery,
          maxResults,
        }),
      });

      const startData = await startResponse.json();

      if (!startResponse.ok) {
        throw new Error(startData.error || "No se pudo iniciar el Actor de Apify.");
      }

      const { runId, datasetId, status: initialStatus } = startData;
      setStatusMessage(`Run iniciado (${runId}). Estado: ${initialStatus}...`);

      // 2. Comenzar polling
      let attempts = 0;
      const maxAttempts = 100; // ~5 minutos max

      const pollStatus = async () => {
        attempts++;
        if (attempts > maxAttempts) {
          setError("Tiempo de espera agotado. El scraper sigue ejecutándose en Apify en segundo plano.");
          setLoading(false);
          return;
        }

        try {
          const statusResponse = await fetch("/api/linkedin-test", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "status",
              runId,
              datasetId,
            }),
          });

          const statusData = await statusResponse.json();

          if (!statusResponse.ok) {
            throw new Error(statusData.error || "Error consultando el estado del run.");
          }

          if (statusData.error) {
            throw new Error(statusData.error);
          }

          const currentStatus = statusData.status;

          if (currentStatus === "SUCCEEDED") {
            const allPosts: LinkedInPost[] = statusData.data || [];
            setResults(allPosts);

            const terms = userConfig?.blacklist_terms ?? [];
            const threshold = userConfig?.blacklist_threshold ?? 2;

            if (terms.length > 0) {
              const filtered = applyBlacklistFilter(allPosts, terms, threshold);
              setFilteredResults(filtered);
              setActiveResultTab("relevant");

              // LLM scoring for relevant posts
              if (userConfig?.llm_api_key && userConfig?.llm_provider && filtered.relevant.length > 0) {
                setScoring(true);
                setScores({});
                fetch("/api/linkedin-score", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    posts: filtered.relevant,
                    provider: userConfig.llm_provider,
                    apiKey: userConfig.llm_api_key,
                    profile: {
                      title: userConfig.title,
                      primary_skills: userConfig.primary_skills,
                      secondary_skills: userConfig.secondary_skills,
                    },
                  }),
                })
                  .then((r) => r.json())
                  .then((data) => {
                    if (data.scores) {
                      const map: Record<string, { score: number; reason: string }> = {};
                      for (const s of data.scores) {
                        const post = filtered.relevant[s.index];
                        const key = post?.id ?? String(s.index);
                        map[key] = { score: s.score, reason: s.reason };
                      }
                      setScores(map);
                    }
                  })
                  .catch(console.error)
                  .finally(() => setScoring(false));
              }
            } else {
              setFilteredResults({ relevant: allPosts, review: [], discarded: [] });
            }

            setLoading(false);
            setStatusMessage("");
          } else if (["FAILED", "ABORTED", "TIMED-OUT"].includes(currentStatus)) {
            throw new Error(`El run terminó de forma inesperada con estado: ${currentStatus}`);
          } else {
            // Sigue ejecutándose (RUNNING, READY, etc.)
            setStatusMessage(`Scrapeando LinkedIn (Estado: ${currentStatus}) - Intento ${attempts}...`);
            pollTimerRef.current = setTimeout(pollStatus, 3000);
          }
        } catch (pollErr: any) {
          setError(pollErr.message || "Error durante la verificación de estado.");
          setLoading(false);
        }
      };

      // Lanzar el primer control de estado
      pollTimerRef.current = setTimeout(pollStatus, 3000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al intentar iniciar la búsqueda.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 text-slate-100 py-12 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header con gradiente */}
        <div className="mb-10 text-center md:text-left">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-semibold transition-colors duration-200 mb-4"
          >
            ← Volver al Dashboard
          </Link>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-300">
            Prueba de Scraper LinkedIn Posts
          </h1>
          <p className="text-slate-400 mt-2 max-w-2xl text-sm md:text-base">
            Consumí en tiempo real el Actor de Apify <code className="text-slate-200 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">harvestapi/linkedin-post-search</code> usando el endpoint de runs y polling asíncrono para visualizar los resultados.
          </p>
        </div>

        {/* Panel principal: Formulario */}
        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 md:p-8 shadow-2xl mb-12">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">
                Búsqueda
              </label>
              <input
                type="text"
                placeholder="Ej. frontend developer React"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-200"
                required
              />
            </div>

            <div className="w-32 shrink-0">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">
                Resultados
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none transition-all duration-200"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="shrink-0 h-[46px] px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-white rounded-xl shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                "Buscar"
              )}
            </button>
          </form>

          {statusMessage && (
            <div className="mt-6 flex items-center gap-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl p-4 text-sm text-indigo-300 animate-pulse">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <p>{statusMessage}</p>
            </div>
          )}

          {error && (
            <div className="mt-6 bg-red-950/50 border border-red-700/60 rounded-xl p-4 text-sm text-red-300">
              <p className="font-semibold">⚠️ Ocurrió un error:</p>
              <p className="mt-1 opacity-90">{error}</p>
            </div>
          )}
        </div>

        {/* Resultados */}
        <div>
          <h2 className="text-xl font-bold text-slate-200 mb-6 flex items-center gap-2">
            <span>Posts Encontrados</span>
            {results.length > 0 && (
              <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                {results.length}
              </span>
            )}
          </h2>

          {loading && results.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-slate-700 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-slate-700 rounded w-1/3" />
                      <div className="h-2 bg-slate-700 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-2.5 bg-slate-700 rounded w-full" />
                    <div className="h-2.5 bg-slate-700 rounded w-5/6" />
                    <div className="h-2.5 bg-slate-700 rounded w-4/6" />
                  </div>
                  <div className="h-8 bg-slate-700 rounded-xl w-1/2 mt-auto" />
                </div>
              ))}
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="bg-slate-800/20 border border-slate-850 rounded-2xl p-12 text-center text-slate-500 max-w-md mx-auto">
              <span className="text-4xl block mb-3">🔍</span>
              <p className="font-semibold text-slate-400">Sin resultados aún</p>
              <p className="text-xs mt-1 text-slate-500">
                Ingresá tu API token de Apify y ejecutá una búsqueda para ver los posts aquí.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <>
              {/* Tab bar — only shown when blacklist is active */}
              {(userConfig?.blacklist_terms ?? []).length > 0 && (
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  {(
                    [
                      { key: "relevant", label: "Relevantes", count: filteredResults.relevant.length, color: "emerald" },
                      { key: "review", label: "A revisar", count: filteredResults.review.length, color: "amber" },
                      { key: "discarded", label: "Descartados", count: filteredResults.discarded.length, color: "rose" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveResultTab(tab.key)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                        activeResultTab === tab.key
                          ? tab.color === "emerald"
                            ? "bg-emerald-600 border-emerald-500 text-white"
                            : tab.color === "amber"
                            ? "bg-amber-600 border-amber-500 text-white"
                            : "bg-rose-700 border-rose-600 text-white"
                          : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tab.label}
                      <span className="ml-2 text-xs opacity-75">({tab.count})</span>
                    </button>
                  ))}
                  {scoring && (
                    <span className="flex items-center gap-2 text-xs text-indigo-400 ml-1">
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Calculando scores...
                    </span>
                  )}
                </div>
              )}

              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {((userConfig?.blacklist_terms ?? []).length > 0
                  ? activeResultTab === "relevant"
                    ? filteredResults.relevant
                    : activeResultTab === "review"
                    ? filteredResults.review
                    : filteredResults.discarded
                  : results
                ).map((post, idx) => (
                  <PostCard
                    key={post.id ?? idx}
                    post={post}
                    score={
                      activeResultTab === "relevant" && post.id
                        ? scores[post.id]
                        : undefined
                    }
                    dimmed={activeResultTab === "discarded"}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PostCard({
  post,
  score,
  dimmed = false,
}: {
  post: LinkedInPost;
  score?: { score: number; reason: string };
  dimmed?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const authorName = post.author?.name || "Usuario de LinkedIn";
  const authorHeadline = post.author?.headline || "Perfil Profesional";
  const authorImg = post.author?.profileImage;
  const postText = post.text || "";
  const postLink = post.id
    ? `https://www.linkedin.com/feed/update/urn:li:activity:${post.id}`
    : post.url || post.postUrl || "https://www.linkedin.com";
  const isLong = postText.length > 260;
  const displayText = expanded ? postText : postText.slice(0, 260) + (isLong ? "..." : "");

  // Formatear fecha
  const rawDate = post.postedAt || post.publishedAt;
  const displayDate = rawDate ? new Date(rawDate).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }) : "Reciente";

  const scoreColor =
    score && score.score >= 70
      ? "text-emerald-400"
      : score && score.score >= 40
      ? "text-amber-400"
      : "text-rose-400";

  return (
    <div className={`bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/40 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between group shadow-lg animate-fadeIn ${dimmed ? "opacity-50" : ""}`}>
      <div>
        {/* Autor */}
        <div className="flex items-start gap-3 mb-4">
          {authorImg ? (
            <img
              src={authorImg}
              alt={authorName}
              className="w-10 h-10 rounded-full object-cover border border-slate-700"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authorName)}`;
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-indigo-900/60 text-indigo-300 font-bold flex items-center justify-center border border-indigo-500/30 text-sm">
              {authorName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-bold text-slate-100 truncate text-sm hover:text-indigo-400 transition-colors">
              {post.author?.profileUrl ? (
                <a href={post.author.profileUrl} target="_blank" rel="noopener noreferrer">
                  {authorName}
                </a>
              ) : (
                authorName
              )}
            </h3>
            <p className="text-xs text-slate-400 truncate mt-0.5" title={authorHeadline}>
              {authorHeadline}
            </p>
          </div>
        </div>

        {/* Contenido */}
        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap mb-4 break-words">
          {displayText}
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold block mt-1 hover:underline focus:outline-none"
            >
              {expanded ? "Ver menos" : "Ver más"}
            </button>
          )}
        </div>
      </div>

      {/* Footer / Info */}
      <div className="mt-4 pt-4 border-t border-slate-700/40 flex flex-col gap-3">
        {/* Métricas */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span title="Likes" className="flex items-center gap-1">
              👍 {post.likesCount ?? 0}
            </span>
            <span title="Comments" className="flex items-center gap-1">
              💬 {post.commentsCount ?? 0}
            </span>
          </div>
          <span className="text-slate-500">{displayDate}</span>
        </div>

        {/* Score badge */}
        {score && (
          <div className="flex items-start gap-2 bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2">
            <span className={`font-black text-base leading-none ${scoreColor}`}>
              {score.score}
            </span>
            <span className="text-[11px] text-slate-400 leading-tight line-clamp-2">{score.reason}</span>
          </div>
        )}

        {/* Botón de acción */}
        <a
          href={postLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-center bg-slate-900/60 hover:bg-indigo-600/80 border border-slate-700 group-hover:border-indigo-500/50 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-all duration-200 block"
        >
          Ver post completo en LinkedIn ↗
        </a>
      </div>
    </div>
  );
}

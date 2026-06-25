"use client";

import { useState, useRef } from "react";
import Link from "next/link";

interface Author {
  name?: string;
  headline?: string;
  profileUrl?: string;
  profileImage?: string;
}

interface LinkedInPost {
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

export default function LinkedInTestPage() {
  const [token, setToken] = useState("");
  const [searchQuery, setSearchQuery] = useState("frontend developer React");
  const [maxResults, setMaxResults] = useState(6);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [results, setResults] = useState<LinkedInPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

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
          token: token || undefined, // Si está vacío, el backend usa el token de env.local
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
              token: token || undefined,
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
            setResults(statusData.data || []);
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
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">
                Apify API Token
              </label>
              <input
                type="password"
                placeholder="Usando token de .env.local..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-200"
              />
            </div>

            <div className="md:col-span-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">
                Término de Búsqueda
              </label>
              <input
                type="text"
                placeholder="Ej. react native remote argentina"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-200"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">
                Cant. Resultados
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none transition-all duration-200"
                required
              />
            </div>

            <div className="md:col-span-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[46px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-white rounded-xl shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition-all duration-200 flex items-center justify-center"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  "Scrape"
                )}
              </button>
            </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((post, idx) => (
                <PostCard key={idx} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: LinkedInPost }) {
  const [expanded, setExpanded] = useState(false);
  const authorName = post.author?.name || "Usuario de LinkedIn";
  const authorHeadline = post.author?.headline || "Perfil Profesional";
  const authorImg = post.author?.profileImage;
  const postText = post.text || "";
  const postLink = post.url || post.postUrl || "https://linkedin.com";
  const isLong = postText.length > 260;
  const displayText = expanded ? postText : postText.slice(0, 260) + (isLong ? "..." : "");

  // Formatear fecha
  const rawDate = post.postedAt || post.publishedAt;
  const displayDate = rawDate ? new Date(rawDate).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }) : "Reciente";

  return (
    <div className="bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/40 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between group shadow-lg hover:shadow-indigo-500/5 animate-fadeIn">
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

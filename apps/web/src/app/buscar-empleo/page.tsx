"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────
interface LIPost {
  id?: string;
  text?: string;
  url?: string;
  postUrl?: string;
  postedAt?: string;
  publishedAt?: string;
  author?: {
    name?: string;
    headline?: string;
    profileUrl?: string;
    profileImage?: string;
  };
  likesCount?: number;
  commentsCount?: number;
}

interface LIFiltered {
  relevant: LIPost[];
  review: LIPost[];
  discarded: LIPost[];
}

interface LIUserConfig {
  blacklist_terms: string[];
  blacklist_threshold: number;
  llm_provider: string;
  // per-provider keys (new schema)
  apify_key?: string;
  openai_key?: string;
  anthropic_key?: string;
  gemini_key?: string;
  // legacy fallback
  llm_api_key?: string;
  title?: string;
  primary_skills?: string[];
  secondary_skills?: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseLIDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const n = Number(raw);
  const d = Number.isFinite(n) && n > 1e10 ? new Date(n) : new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function sortLIPosts(posts: LIPost[], order: "newest" | "oldest"): LIPost[] {
  return [...posts].sort((a, b) => {
    const da = parseLIDate(a.postedAt || a.publishedAt)?.getTime() ?? 0;
    const db = parseLIDate(b.postedAt || b.publishedAt)?.getTime() ?? 0;
    return order === "newest" ? db - da : da - db;
  });
}

function applyBlacklistFilter(
  posts: LIPost[],
  terms: string[],
  threshold: number
): LIFiltered {
  const relevant: LIPost[] = [], review: LIPost[] = [], discarded: LIPost[] = [];
  for (const post of posts) {
    const text = (post.text ?? "").toLowerCase();
    let hits = 0;
    for (const term of terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      hits += (text.match(new RegExp(escaped, "gi")) ?? []).length;
    }
    if (hits === 0) relevant.push(post);
    else if (hits < threshold) review.push(post);
    else discarded.push(post);
  }
  return { relevant, review, discarded };
}

const CACHE_KEY = "li-posts-cache";

function saveCache(data: object) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}
function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BuscarEmpleoPage() {
  const router = useRouter();

  const [query, setQuery] = useState("frontend developer React");
  const [maxResults, setMaxResults] = useState(50);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<LIPost[]>([]);
  const [filtered, setFiltered] = useState<LIFiltered>({ relevant: [], review: [], discarded: [] });
  const [activeTab, setActiveTab] = useState<"relevant" | "review" | "discarded">("relevant");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [textSearch, setTextSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scoring, setScoring] = useState(false);
  const [scores, setScores] = useState<Record<string, { score: number; reason: string }>>({});
  const [config, setConfig] = useState<LIUserConfig | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Load user config + restore cache
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("search_profiles")
            .select("blacklist_terms, blacklist_threshold, llm_provider, llm_api_key, apify_key, openai_key, anthropic_key, gemini_key, title, primary_skills, secondary_skills")
            .eq("user_id", user.id)
            .maybeSingle();
          if (data) setConfig(data as LIUserConfig);
        }
      } catch { /* ignore */ }

      // Restore cache
      const cache = loadCache();
      if (cache?.results?.length) {
        setQuery(cache.query ?? "frontend developer React");
        setMaxResults(cache.maxResults ?? 50);
        setResults(cache.results);
        setFiltered(cache.filtered ?? { relevant: cache.results, review: [], discarded: [] });
        setScores(cache.scores ?? {});
        setSort(cache.sort ?? "newest");
        setActiveTab(cache.activeTab ?? "relevant");
      }
    };
    init();
  }, []);

  // Persist sort preference
  useEffect(() => {
    const cache = loadCache();
    if (cache) saveCache({ ...cache, sort });
  }, [sort]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }

    setLoading(true);
    setError(null);
    setResults([]);
    setFiltered({ relevant: [], review: [], discarded: [] });
    setScores({});
    setStatus("Iniciando búsqueda en LinkedIn...");

    try {
      const startRes = await fetch("/api/linkedin-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", searchQuery: query, maxResults }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || "No se pudo iniciar la búsqueda.");

      const { runId, datasetId } = startData;
      setStatus(`Run iniciado (${runId}). Scrapeando...`);

      let attempts = 0;
      const poll = async () => {
        attempts++;
        if (attempts > 100) {
          setError("Tiempo de espera agotado.");
          setLoading(false);
          return;
        }
        try {
          const statusRes = await fetch("/api/linkedin-test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "status", runId, datasetId }),
          });
          const statusData = await statusRes.json();
          if (!statusRes.ok) throw new Error(statusData.error);

          if (statusData.status === "SUCCEEDED") {
            const all: LIPost[] = statusData.data || [];
            setResults(all);

            const terms = config?.blacklist_terms ?? [];
            const threshold = config?.blacklist_threshold ?? 2;
            const fil = terms.length > 0
              ? applyBlacklistFilter(all, terms, threshold)
              : { relevant: all, review: [], discarded: [] };

            setFiltered(fil);
            setActiveTab("relevant");

            saveCache({ query, maxResults, results: all, filtered: fil, scores: {}, sort: "newest", activeTab: "relevant", savedAt: Date.now() });

            // LLM scoring — pick key from per-provider tokens, fallback to legacy llm_api_key
            const providerKeyMap: Record<string, string | undefined> = {
              gemini: config?.gemini_key,
              openai: config?.openai_key,
              anthropic: config?.anthropic_key,
            };
            const resolvedKey = config?.llm_provider
              ? (providerKeyMap[config.llm_provider] || config?.llm_api_key)
              : config?.llm_api_key;

            if (resolvedKey && config?.llm_provider && fil.relevant.length > 0) {
              setScoring(true);
              fetch("/api/linkedin-score", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  posts: fil.relevant,
                  provider: config.llm_provider,
                  apiKey: resolvedKey,
                  profile: { title: config.title, primary_skills: config.primary_skills, secondary_skills: config.secondary_skills },
                }),
              })
                .then((r) => r.json())
                .then((d) => {
                  if (d.scores) {
                    const map: Record<string, { score: number; reason: string }> = {};
                    for (const s of d.scores) {
                      const post = fil.relevant[s.index];
                      const key = post?.id ?? String(s.index);
                      map[key] = { score: s.score, reason: s.reason };
                    }
                    setScores(map);
                    const cached = loadCache();
                    if (cached) saveCache({ ...cached, scores: map });
                  }
                })
                .catch(console.error)
                .finally(() => setScoring(false));
            }

            setLoading(false);
            setStatus("");
          } else if (["FAILED", "ABORTED", "TIMED-OUT"].includes(statusData.status)) {
            throw new Error(`Run finalizado con estado: ${statusData.status}`);
          } else {
            setStatus(`Scrapeando... (${statusData.status}) — intento ${attempts}`);
            pollRef.current = setTimeout(poll, 3000);
          }
        } catch (err: any) {
          setError(err.message);
          setLoading(false);
        }
      };
      pollRef.current = setTimeout(poll, 3000);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const selectAll = () => setSelectedIds(new Set(sortedPosts.map((p, i) => p.id ?? String(i))));
  const clearSelection = () => setSelectedIds(new Set());

  const deleteSelected = () => {
    const remove = (arr: LIPost[]) => arr.filter((p, i) => !selectedIds.has(p.id ?? String(i)));
    setResults((prev) => { const next = remove(prev); const cache = loadCache(); if (cache) saveCache({ ...cache, results: next }); return next; });
    setFiltered((prev) => {
      const next = { relevant: remove(prev.relevant), review: remove(prev.review), discarded: remove(prev.discarded) };
      const cache = loadCache(); if (cache) saveCache({ ...cache, filtered: next }); return next;
    });
    setSelectedIds(new Set());
  };

  const openAll = () => {
    sortedPosts.forEach((post) => {
      const link = post.id
        ? `https://www.linkedin.com/feed/update/urn:li:activity:${post.id}`
        : post.url || post.postUrl;
      if (link) window.open(link, "_blank", "noopener,noreferrer");
    });
  };

  const deletePost = (post: LIPost) => {
    const remove = (arr: LIPost[]) => arr.filter((p) => (post.id ? p.id !== post.id : p !== post));
    setResults((prev) => { const next = remove(prev); const cache = loadCache(); if (cache) saveCache({ ...cache, results: next }); return next; });
    setFiltered((prev) => {
      const next = { relevant: remove(prev.relevant), review: remove(prev.review), discarded: remove(prev.discarded) };
      const cache = loadCache();
      if (cache) saveCache({ ...cache, filtered: next });
      return next;
    });
  };

  const hasBlacklist = (config?.blacklist_terms ?? []).length > 0;
  // Derived — declared before helpers that use them
  const activePosts = (hasBlacklist
    ? activeTab === "relevant" ? filtered.relevant
      : activeTab === "review" ? filtered.review
      : filtered.discarded
    : results
  ).filter((p) => {
    if (!textSearch.trim()) return true;
    const q = textSearch.toLowerCase();
    return (
      (p.text ?? "").toLowerCase().includes(q) ||
      (p.author?.name ?? "").toLowerCase().includes(q) ||
      (p.author?.headline ?? "").toLowerCase().includes(q)
    );
  });

  const sortedPosts = sortLIPosts(activePosts, sort);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Buscar Empleo</h1>
          <p className="text-gray-500 text-sm mt-1">Buscá posts de LinkedIn con Apify y filtralos con tu lista negra</p>
        </div>

        {/* Search form */}
        <form
          onSubmit={handleSearch}
          className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row gap-4 items-end"
        >
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Búsqueda
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej. frontend developer React"
              required
              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 outline-none transition-all"
            />
          </div>
          <div className="w-32 shrink-0">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Resultados
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 outline-none transition-all"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 h-[42px] px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-95"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : "Buscar"}
          </button>
        </form>

        {/* Status */}
        {status && (
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4 text-sm text-indigo-700 animate-pulse">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            {status}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <>
            {/* Bucket tabs */}
            {hasBlacklist && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {([
                  { key: "relevant", label: "Relevantes", count: filtered.relevant.length, cls: "bg-green-600 text-white" },
                  { key: "review", label: "A revisar", count: filtered.review.length, cls: "bg-amber-500 text-white" },
                  { key: "discarded", label: "Descartados", count: filtered.discarded.length, cls: "bg-red-500 text-white" },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${activeTab === tab.key ? `${tab.cls} border-transparent shadow-sm` : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
                  >
                    {tab.label} <span className="opacity-70">({tab.count})</span>
                  </button>
                ))}
                {scoring && (
                  <span className="flex items-center gap-1.5 text-xs text-indigo-500 ml-1">
                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Calculando scores...
                  </span>
                )}
              </div>
            )}

            {/* Sort + search + count */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-1.5">
                {(["newest", "oldest"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${sort === s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
                  >
                    {s === "newest" ? "Más reciente" : "Más antiguo"}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-48">
                <input
                  type="text"
                  value={textSearch}
                  onChange={(e) => setTextSearch(e.target.value)}
                  placeholder="Buscar en posts..."
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none transition-all pr-7"
                />
                {textSearch && (
                  <button
                    onClick={() => setTextSearch("")}
                    className="absolute inset-y-0 right-2 flex items-center text-gray-300 hover:text-gray-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-400 font-medium shrink-0">{activePosts.length} posts</span>
              <button
                onClick={openAll}
                disabled={sortedPosts.length === 0}
                className="text-xs px-3 py-1.5 rounded-lg border bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 transition-all"
              >
                Abrir todos
              </button>
              {selectedIds.size > 0 ? (
                <>
                  <button
                    onClick={deleteSelected}
                    className="text-xs px-3 py-1.5 rounded-lg border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition-all font-semibold"
                  >
                    Borrar {selectedIds.size} seleccionados
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-xs px-3 py-1.5 rounded-lg border bg-white text-gray-400 border-gray-200 hover:border-gray-300 transition-all"
                  >
                    Deseleccionar
                  </button>
                </>
              ) : (
                <button
                  onClick={selectAll}
                  disabled={sortedPosts.length === 0}
                  className="text-xs px-3 py-1.5 rounded-lg border bg-white text-gray-500 border-gray-200 hover:border-gray-300 disabled:opacity-40 transition-all"
                >
                  Seleccionar todos
                </button>
              )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedPosts.map((post, idx) => (
                <PostCard
                  key={post.id ?? idx}
                  post={post}
                  score={(!hasBlacklist || activeTab === "relevant") && post.id ? scores[post.id] : undefined}
                  dimmed={activeTab === "discarded"}
                  selected={selectedIds.has(post.id ?? String(idx))}
                  onToggleSelect={() => toggleSelect(post.id ?? String(idx))}
                  onDelete={() => deletePost(post)}
                  onApply={() => {
                    const postLink = post.id
                      ? `https://www.linkedin.com/feed/update/urn:li:activity:${post.id}`
                      : post.url || post.postUrl || "";
                    const params = new URLSearchParams();
                    params.set("company", post.author?.name || "");
                    params.set("url", postLink);
                    params.set("title", (post.text || "").split("\n")[0].slice(0, 80));
                    router.push(`/postulaciones/nueva?${params.toString()}`);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {!loading && results.length === 0 && !status && !error && (
          <div className="text-center py-24 text-gray-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-medium text-gray-500">Sin resultados aún</p>
            <p className="text-sm mt-1">Ejecutá una búsqueda para ver posts de LinkedIn aquí.</p>
            {!config?.blacklist_terms?.length && (
              <p className="text-xs mt-3 text-indigo-400">
                Tip: configurá tu lista negra en{" "}
                <button onClick={() => router.push("/perfil")} className="underline font-semibold">Perfil → Criterios</button>
                {" "}para filtrar automáticamente.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────────
function PostCard({
  post,
  score,
  dimmed = false,
  selected = false,
  onToggleSelect,
  onDelete,
  onApply,
}: {
  post: LIPost;
  score?: { score: number; reason: string };
  dimmed?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onDelete: () => void;
  onApply: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const authorName = post.author?.name || "Usuario de LinkedIn";
  const authorHeadline = post.author?.headline || "";
  const authorImg = post.author?.profileImage;
  const postText = post.text || "";
  const postLink = post.id
    ? `https://www.linkedin.com/feed/update/urn:li:activity:${post.id}`
    : post.url || post.postUrl || "https://www.linkedin.com";
  const isLong = postText.length > 260;
  const displayText = expanded ? postText : postText.slice(0, 260) + (isLong ? "..." : "");

  const parsedDate = parseLIDate(post.postedAt || post.publishedAt);
  const displayDate = parsedDate
    ? parsedDate.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
    : "Reciente";

  const scoreColor =
    score && score.score >= 70 ? "text-green-600" :
    score && score.score >= 40 ? "text-amber-500" :
    "text-red-500";

  return (
    <div className={`relative bg-white border rounded-2xl p-5 flex flex-col gap-3 transition-all hover:shadow-md ${selected ? "border-indigo-400 ring-2 ring-indigo-100 shadow-sm" : dimmed ? "opacity-40 border-gray-200" : "border-gray-200 hover:border-indigo-200"}`}>
      {/* Checkbox (top-left) */}
      <button
        onClick={onToggleSelect}
        className={`absolute top-3 left-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selected ? "bg-indigo-600 border-indigo-600" : "bg-white border-gray-300 hover:border-indigo-400"}`}
        title={selected ? "Deseleccionar" : "Seleccionar"}
      >
        {selected && (
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
        title="Eliminar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>

      {/* Author */}
      <div className="flex items-start gap-3 px-6">
        {authorImg ? (
          <img
            src={authorImg}
            alt={authorName}
            className="w-9 h-9 rounded-full object-cover border border-gray-100 shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authorName)}`; }}
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-500 font-bold flex items-center justify-center border border-indigo-100 text-xs shrink-0">
            {authorName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">
            {post.author?.profileUrl ? (
              <a href={post.author.profileUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition-colors">
                {authorName}
              </a>
            ) : authorName}
          </p>
          {authorHeadline && <p className="text-xs text-gray-400 truncate">{authorHeadline}</p>}
        </div>
      </div>

      {/* Text */}
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words flex-1">
        {displayText}
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold block mt-1"
          >
            {expanded ? "Ver menos" : "Ver más"}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-50 pt-3 flex flex-col gap-2 mt-auto">
        <div className="flex items-center justify-end text-xs text-gray-400">
          <span>{displayDate}</span>
        </div>

        {score && (
          <div className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
            <span className={`font-black text-base leading-none shrink-0 ${scoreColor}`}>{score.score}</span>
            <span className="text-[11px] text-gray-500 leading-tight line-clamp-2">{score.reason}</span>
          </div>
        )}

        <div className="flex gap-2">
          <a
            href={postLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-[11px] font-bold py-3 rounded-xl bg-[#0a66c2] text-white hover:bg-[#004182] transition-all shadow-lg shadow-blue-100 active:scale-95"
          >
            Ver empleo
          </a>
          <button
            onClick={onApply}
            className="flex-1 text-[11px] font-bold py-3 rounded-xl bg-gray-900 text-white hover:bg-indigo-600 transition-all shadow-lg shadow-gray-200 active:scale-95"
          >
            Postular →
          </button>
        </div>
      </div>
    </div>
  );
}

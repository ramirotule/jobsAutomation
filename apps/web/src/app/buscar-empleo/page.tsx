"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────
interface LIPost {
  // Apify current schema
  id?: string;
  type?: string;
  linkedinUrl?: string;
  content?: string;
  author?: {
    id?: string;
    name?: string;
    universalName?: string;
    type?: "company" | "person" | string;
    linkedinUrl?: string;
    info?: string;          // "21,555 followers"
    avatar?: { url?: string; width?: number; height?: number };
    // legacy
    headline?: string;
    profileUrl?: string;
    profileImage?: string;
  };
  postedAt?: string | { timestamp?: number; date?: string; postedAgoShort?: string; postedAgoText?: string };
  postImages?: { url?: string; width?: number; height?: number }[];
  engagement?: { likes?: number; comments?: number; shares?: number };
  // legacy fields kept for cached data
  text?: string;
  url?: string;
  postUrl?: string;
  publishedAt?: string;
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
type LIDateField = LIPost["postedAt"];

function parseLIDate(raw: LIDateField): Date | null {
  if (!raw) return null;

  // Object form: { date: "2026-06-27T00:43:51.804Z", timestamp: 1782521031804 }
  if (typeof raw === "object") {
    if (raw.date) {
      const d = new Date(raw.date);
      return isNaN(d.getTime()) ? null : d;
    }
    if (raw.timestamp) {
      const d = new Date(raw.timestamp);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  // String form: ISO string or Unix ms as string
  const n = Number(raw);
  const d = Number.isFinite(n) && n > 1e10 ? new Date(n) : new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function formatARDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())} hs`;
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
    const text = (post.content ?? post.text ?? "").toLowerCase();
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

const CACHE_KEY   = "li-posts-cache";
const IGNORED_KEY = "li-ignored-posts";

function saveCache(data: object) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}
function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Ignore list helpers ───────────────────────────────────────────────────────
/** Stable key for a post: prefer the Apify ID, fallback to content fingerprint */
function postKey(post: LIPost): string {
  if (post.id) return `id:${post.id}`;
  // simple djb2 hash of first 200 chars of content
  const text = (post.content ?? post.text ?? "").slice(0, 200);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h) ^ text.charCodeAt(i);
  return `fp:${Math.abs(h >>> 0)}`;
}

function loadIgnored(): Set<string> {
  try {
    const raw = localStorage.getItem(IGNORED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveIgnored(set: Set<string>) {
  try { localStorage.setItem(IGNORED_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

function filterIgnored(posts: LIPost[], ignored: Set<string>): LIPost[] {
  return posts.filter((p) => !ignored.has(postKey(p)));
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BuscarEmpleoPage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
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
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [ignoredCount, setIgnoredCount] = useState(0);

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

      // Restore ignore list
      const ign = loadIgnored();
      setIgnored(ign);

      // Restore cache (filtering out any previously ignored posts)
      const cache = loadCache();
      if (cache?.results?.length) {
        setQuery(cache.query ?? "frontend developer React");
        setMaxResults(cache.maxResults ?? 50);
        const filteredResults = filterIgnored(cache.results, ign);
        setResults(filteredResults);
        setFiltered({
          relevant: filterIgnored(cache.filtered?.relevant ?? filteredResults, ign),
          review:   filterIgnored(cache.filtered?.review   ?? [], ign),
          discarded:filterIgnored(cache.filtered?.discarded ?? [], ign),
        });
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
            const raw: LIPost[] = statusData.data || [];
            // Filter out permanently ignored posts
            const all = filterIgnored(raw, ignored);
            setIgnoredCount(raw.length - all.length);
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
            setStatus("Buscando trabajos relacionados con tu rol...");
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

  const ignorePost = (post: LIPost) => {
    const key = postKey(post);
    const next = new Set(ignored);
    next.add(key);
    setIgnored(next);
    saveIgnored(next);
    // Also remove from current results
    const remove = (arr: LIPost[]) => arr.filter((p) => postKey(p) !== key);
    setResults((prev) => { const n = remove(prev); const cache = loadCache(); if (cache) saveCache({ ...cache, results: n }); return n; });
    setFiltered((prev) => {
      const n = { relevant: remove(prev.relevant), review: remove(prev.review), discarded: remove(prev.discarded) };
      const cache = loadCache(); if (cache) saveCache({ ...cache, filtered: n }); return n;
    });
  };

  const clearIgnored = () => {
    const empty = new Set<string>();
    setIgnored(empty);
    saveIgnored(empty);
    setIgnoredCount(0);
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
      (p.content ?? p.text ?? "").toLowerCase().includes(q) ||
      (p.author?.name ?? "").toLowerCase().includes(q) ||
      (p.author?.headline ?? "").toLowerCase().includes(q)
    );
  });

  const sortedPosts = sortLIPosts(activePosts, sort);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-5 lg:py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Buscar Empleo</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Buscá posts de LinkedIn con Apify y filtralos con tu lista negra</p>
        </div>

        {/* Search form */}
        <form
          onSubmit={handleSearch}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 mb-4 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Búsqueda
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="¿Qué posición estás buscando?"
              required
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:bg-white dark:focus:bg-gray-700 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 outline-none transition-all"
            />
          </div>
          <div className="flex items-end gap-3 sm:contents">
            <div className="flex-1 sm:w-32 sm:flex-none sm:shrink-0">
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Resultados
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:bg-white dark:focus:bg-gray-700 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 outline-none transition-all"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="shrink-0 sm:self-end h-[42px] px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : "Buscar"}
            </button>
          </div>
        </form>

        {/* Status */}
        {status && (
          <div className="flex items-center gap-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 rounded-2xl px-5 py-4 mb-4">
            <div className="shrink-0 relative w-8 h-8">
              <svg className="animate-spin w-8 h-8 text-indigo-300 dark:text-indigo-700" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              </svg>
              <svg className="animate-spin w-8 h-8 text-indigo-600 dark:text-indigo-400 absolute inset-0" style={{ animationDuration: "0.75s" }} fill="none" viewBox="0 0 24 24">
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{status}</p>
              <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-0.5">Esto puede tardar unos segundos</p>
            </div>
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
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${activeTab === tab.key ? `${tab.cls} border-transparent shadow-sm` : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"}`}
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
            <div className="flex flex-col gap-2 mb-4">
              {/* Row 1: text search (full width) */}
              <div className="relative">
                <input
                  type="text"
                  value={textSearch}
                  onChange={(e) => setTextSearch(e.target.value)}
                  placeholder="Buscar en posts..."
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none transition-all pr-7"
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

              {/* Row 2: sort + count + badges + action buttons (scrollable) */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                {(["newest", "oldest"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-all ${sort === s ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"}`}
                  >
                    {s === "newest" ? "Más reciente" : "Más antiguo"}
                  </button>
                ))}
                <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500 font-medium">{activePosts.length} posts</span>
                {(ignored.size > 0 || ignoredCount > 0) && (
                  <span className="shrink-0 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                    {ignored.size} ignorados
                    <button onClick={clearIgnored} className="text-indigo-400 hover:text-indigo-600 font-semibold ml-0.5">· limpiar</button>
                  </span>
                )}
                <button
                  onClick={openAll}
                  disabled={sortedPosts.length === 0}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-lg border bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 transition-all"
                >
                  Abrir todos
                </button>
                {selectedIds.size > 0 ? (
                  <>
                    <button
                      onClick={deleteSelected}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition-all font-semibold"
                    >
                      Borrar {selectedIds.size}
                    </button>
                    <button
                      onClick={clearSelection}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg border bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300 transition-all"
                    >
                      Deseleccionar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={selectAll}
                    disabled={sortedPosts.length === 0}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg border bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 disabled:opacity-40 transition-all"
                  >
                    Seleccionar todos
                  </button>
                )}
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
              {sortedPosts.map((post, idx) => (
                <PostCard
                  key={post.id ?? idx}
                  post={post}
                  score={(!hasBlacklist || activeTab === "relevant") && post.id ? scores[post.id] : undefined}
                  dimmed={activeTab === "discarded"}
                  selected={selectedIds.has(post.id ?? String(idx))}
                  onToggleSelect={() => toggleSelect(post.id ?? String(idx))}
                  onIgnore={() => ignorePost(post)}
                  onDelete={() => deletePost(post)}
                  onApply={() => {
                    const postLink = post.linkedinUrl
                      || (post.id ? `https://www.linkedin.com/feed/update/urn:li:activity:${post.id}` : "")
                      || post.url || post.postUrl || "";
                    const params = new URLSearchParams();
                    params.set("company", post.author?.name || "");
                    params.set("url", postLink);
                    params.set("title", (post.content || post.text || "").split("\n")[0].slice(0, 80));
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
  onIgnore,
  onDelete,
  onApply,
}: {
  post: LIPost;
  score?: { score: number; reason: string };
  dimmed?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onIgnore: () => void;
  onDelete: () => void;
  onApply: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const authorName = post.author?.name || "Usuario de LinkedIn";
  const authorImg = post.author?.avatar?.url || post.author?.profileImage;
  const authorUrl = post.author?.linkedinUrl || post.author?.profileUrl;
  const authorInfo = post.author?.info || post.author?.headline || "";
  const isCompany = post.author?.type === "company";

  const postText = post.content || post.text || "";
  const postLink = post.linkedinUrl
    || (post.id ? `https://www.linkedin.com/feed/update/urn:li:activity:${post.id}` : "")
    || post.url || post.postUrl || "https://www.linkedin.com";

  const isLong = postText.length > 280;
  const displayText = expanded ? postText : postText.slice(0, 280) + (isLong ? "…" : "");

  const parsedDate = parseLIDate(post.postedAt ?? post.publishedAt);
  const displayDate = parsedDate ? formatARDate(parsedDate) : null;
  const agoText = typeof post.postedAt === "object" ? post.postedAt?.postedAgoShort : null;

  const likes = post.engagement?.likes ?? 0;
  const comments = post.engagement?.comments ?? 0;
  const shares = post.engagement?.shares ?? 0;
  const hasEngagement = likes > 0 || comments > 0 || shares > 0;

  const scoreColor =
    !score ? "" :
    score.score >= 70 ? "text-green-600" :
    score.score >= 40 ? "text-amber-500" :
    "text-red-500";

  const firstImage = post.postImages?.[0]?.url;

  return (
    <div className={`relative bg-white dark:bg-gray-900 border rounded-2xl flex flex-col transition-all hover:shadow-md overflow-hidden ${selected ? "border-indigo-400 ring-2 ring-indigo-100 dark:ring-indigo-900 shadow-sm" : dimmed ? "opacity-40 border-gray-200 dark:border-gray-800" : "border-gray-200 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-700"}`}>

      {/* Image banner (if post has image) */}
      {firstImage && (
        <div className="w-full h-36 overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800">
          <img
            src={firstImage}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Checkbox (top-left) */}
        <button
          onClick={onToggleSelect}
          className={`absolute top-3 left-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all z-10 ${selected ? "bg-indigo-600 border-indigo-600" : "bg-white/90 dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-indigo-400"}`}
          title={selected ? "Deseleccionar" : "Seleccionar"}
        >
          {selected && (
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {/* Ignore + Delete buttons stacked top-right */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10">
          <button
            onClick={onIgnore}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 shadow-sm transition-all active:scale-95"
            title="Ignorar para siempre"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-950 shadow-sm transition-all active:scale-95"
            title="Eliminar de esta búsqueda"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>

        {/* Author */}
        <div className="flex items-center gap-3 pr-8 pl-6">
          {/* Avatar */}
          <div className="shrink-0 relative">
            {authorImg ? (
              <img
                src={authorImg}
                alt={authorName}
                className={`w-10 h-10 object-cover border border-gray-100 dark:border-gray-700 ${isCompany ? "rounded-lg" : "rounded-full"}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authorName)}`;
                }}
              />
            ) : (
              <div className={`w-10 h-10 bg-indigo-50 dark:bg-indigo-950 text-indigo-500 font-bold flex items-center justify-center border border-indigo-100 dark:border-indigo-900 text-xs ${isCompany ? "rounded-lg" : "rounded-full"}`}>
                {authorName.slice(0, 2).toUpperCase()}
              </div>
            )}
            {/* company / person badge */}
            <span
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border border-white dark:border-gray-900 ${isCompany ? "bg-blue-500 text-white" : "bg-violet-500 text-white"}`}
              title={isCompany ? "Empresa" : "Persona"}
            >
              {isCompany ? "E" : "P"}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate leading-tight">
              {authorUrl ? (
                <a href={authorUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  {authorName}
                </a>
              ) : authorName}
            </p>
            {authorInfo && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">{authorInfo}</p>
            )}
          </div>
        </div>

        {/* Post text */}
        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words flex-1">
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
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex flex-col gap-2.5 mt-auto">
          {/* Date + engagement */}
          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <div className="flex items-center gap-1">
              {agoText && (
                <span className="font-semibold text-gray-500 dark:text-gray-400">{agoText}</span>
              )}
              {agoText && displayDate && <span>·</span>}
              {displayDate && <span>{displayDate}</span>}
              {!agoText && !displayDate && <span>Fecha desconocida</span>}
            </div>
            {hasEngagement && (
              <div className="flex items-center gap-2.5">
                {likes > 0 && (
                  <span className="flex items-center gap-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-blue-400">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                    {likes}
                  </span>
                )}
                {comments > 0 && (
                  <span className="flex items-center gap-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {comments}
                  </span>
                )}
                {shares > 0 && (
                  <span className="flex items-center gap-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                    {shares}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Score */}
          {score && (
            <div className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2">
              <span className={`font-black text-base leading-none shrink-0 ${scoreColor}`}>{score.score}</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight line-clamp-2">{score.reason}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <a
              href={postLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-[11px] font-bold py-2.5 rounded-xl bg-[#0a66c2] text-white hover:bg-[#004182] transition-all shadow-sm active:scale-95"
            >
              Ver empleo
            </a>
            <button
              onClick={onApply}
              className="flex-1 text-[11px] font-bold py-2.5 rounded-xl bg-gray-900 dark:bg-gray-700 text-white hover:bg-indigo-600 dark:hover:bg-indigo-600 transition-all shadow-sm active:scale-95"
            >
              Postular →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

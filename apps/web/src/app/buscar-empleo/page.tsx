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
  const [missingApifyKey, setMissingApifyKey] = useState(false);
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
          const { data, error } = await supabase
            .from("search_profiles")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();
          if (data) setConfig(data as LIUserConfig);
        }
      } catch (e) { console.error("[config load] catch:", e); }

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
        body: JSON.stringify({
          action: "start",
          searchQuery: query,
          maxResults,
          token: config?.apify_key,
        }),
      });
      const startData = await startRes.json();
      if (startRes.status === 402 && startData.error === 'apify_key_missing') {
        setMissingApifyKey(true);
        setLoading(false);
        return;
      }
      if (!startRes.ok) throw new Error(startData.error || "No se pudo iniciar la búsqueda.");

      const { runId, datasetId } = startData;
      setStatus("Buscando trabajos relacionados con tu rol...");

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
            body: JSON.stringify({ action: "status", runId, datasetId, token: config?.apify_key }),
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
                  apiKey: resolvedKey?.trim(),
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 overflow-x-hidden">
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

        {/* Missing Apify key — actionable banner */}
        {missingApifyKey && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 text-sm text-amber-800">
              <p className="font-bold mb-0.5">Falta tu token de Apify</p>
              <p className="text-amber-700">Para buscar posts en LinkedIn necesitás configurar tu token personal de Apify. Es gratis y tarda menos de 2 minutos.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <a
                href="/perfil?tab=tokens"
                className="text-xs font-bold bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors whitespace-nowrap"
              >
                Configurar token →
              </a>
              <button
                onClick={() => setMissingApifyKey(false)}
                className="text-xs text-amber-600 hover:text-amber-800 px-2"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Generic error */}
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
                  config={config}
                  score={(!hasBlacklist || activeTab === "relevant") && post.id ? scores[post.id] : undefined}
                  dimmed={activeTab === "discarded"}
                  selected={selectedIds.has(post.id ?? String(idx))}
                  onToggleSelect={() => toggleSelect(post.id ?? String(idx))}
                  onIgnore={() => ignorePost(post)}
                  onDelete={() => deletePost(post)}
                  onApply={() => {
                    ignorePost(post); // never show this post again in searches
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

// ── Post Modal ────────────────────────────────────────────────────────────────
function PostModal({
  post,
  score: initialScore,
  config,
  onClose,
  onIgnore,
  onDelete,
  onApply,
}: {
  post: LIPost;
  score?: { score: number; reason: string };
  config: LIUserConfig | null;
  onClose: () => void;
  onIgnore: () => void;
  onDelete: () => void;
  onApply: () => void;
}) {
  const [aiScore, setAiScore] = useState<{ score: number; reason: string } | null>(initialScore ?? null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState("");

  const authorName = post.author?.name || "Usuario de LinkedIn";
  const authorImg = post.author?.avatar?.url || post.author?.profileImage;
  const authorUrl = post.author?.linkedinUrl || post.author?.profileUrl;
  const authorInfo = post.author?.info || post.author?.headline || "";
  const isCompany = post.author?.type === "company";
  const postText = post.content || post.text || "";
  const postLink = post.linkedinUrl
    || (post.id ? `https://www.linkedin.com/feed/update/urn:li:activity:${post.id}` : "")
    || post.url || post.postUrl || "https://www.linkedin.com";
  const parsedDate = parseLIDate(post.postedAt ?? post.publishedAt);
  const displayDate = parsedDate ? formatARDate(parsedDate) : null;
  const agoText = typeof post.postedAt === "object" ? post.postedAt?.postedAgoShort : null;
  const likes = post.engagement?.likes ?? 0;
  const comments = post.engagement?.comments ?? 0;
  const shares = post.engagement?.shares ?? 0;
  const firstImage = post.postImages?.[0]?.url;

  // Contact helpers
  const liVanity = authorUrl?.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? null;
  const liDmUrl = liVanity ? `https://www.linkedin.com/messaging/compose/?recipient=${liVanity}` : authorUrl ?? null;

  function openGmail() {
    if (!contactEmail.trim()) return;
    const role = config?.title || "desarrollador Frontend";
    const company = authorName;
    const subject = encodeURIComponent(`Postulación — ${role}`);
    const body = encodeURIComponent(
      `Hola ${company},\n\nVi tu publicación en LinkedIn y me gustaría postularme para el rol de ${role}.\n\nQuedo a disposición para compartir mi CV y coordinar una llamada.\n\nSaludos,`
    );
    window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(contactEmail)}&su=${subject}&body=${body}`, "_blank", "noopener,noreferrer");
  }

  const scoreValue = aiScore?.score ?? 0;
  const scoreColor = !aiScore ? "" : scoreValue >= 70 ? "text-green-500 dark:text-green-400" : scoreValue >= 40 ? "text-amber-400" : "text-red-400";
  const scoreBarColor = !aiScore ? "" : scoreValue >= 70 ? "bg-green-500" : scoreValue >= 40 ? "bg-amber-400" : "bg-red-400";

  const providerKeyMap: Record<string, string | undefined> = {
    gemini: config?.gemini_key,
    openai: config?.openai_key,
    anthropic: config?.anthropic_key,
    nvidia: config?.llm_api_key,
  };
  const availableProviders = Object.entries(providerKeyMap)
    .filter(([, k]) => k && k.trim().length > 0)
    .map(([p]) => p);
  const defaultProvider = config?.llm_provider && providerKeyMap[config.llm_provider]
    ? config.llm_provider
    : availableProviders[0] ?? null;
  const effectiveProvider = selectedProvider ?? defaultProvider;
  const resolvedKey = effectiveProvider ? providerKeyMap[effectiveProvider] : null;
  const canAnalyze = !!(resolvedKey && effectiveProvider);

  async function analyze() {
    setAnalyzeError(null);
    if (!effectiveProvider) {
      setAnalyzeError("No tenés un proveedor de IA configurado. Guardá tu API key en Perfil → Tokens.");
      return;
    }
    if (!resolvedKey) {
      setAnalyzeError(`Falta la API key de ${effectiveProvider}. Configurala en Perfil → Tokens.`);
      return;
    }
    if (!postText.trim()) {
      setAnalyzeError("Este post no tiene contenido para analizar.");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/linkedin-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posts: [{ id: post.id, text: postText }],
          provider: effectiveProvider!,
          apiKey: resolvedKey?.trim(),
          profile: {
            title: config?.title,
            primary_skills: config?.primary_skills,
            secondary_skills: config?.secondary_skills,
            blacklist_terms: config?.blacklist_terms,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const s = data.scores?.[0];
      if (s) setAiScore({ score: s.score, reason: s.reason });
    } catch (e: any) {
      setAnalyzeError(e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="shrink-0 relative">
            {authorImg ? (
              <img src={authorImg} alt={authorName}
                className={`w-12 h-12 object-cover border border-gray-100 dark:border-gray-700 ${isCompany ? "rounded-lg" : "rounded-full"}`}
                onError={e => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authorName)}`; }} />
            ) : (
              <div className={`w-12 h-12 bg-indigo-50 dark:bg-indigo-950 text-indigo-500 font-bold flex items-center justify-center text-sm ${isCompany ? "rounded-lg" : "rounded-full"}`}>
                {authorName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border border-white dark:border-gray-900 ${isCompany ? "bg-blue-500 text-white" : "bg-violet-500 text-white"}`}>
              {isCompany ? "E" : "P"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
              {authorUrl
                ? <a href={authorUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 dark:hover:text-indigo-400">{authorName}</a>
                : authorName}
            </p>
            {authorInfo && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{authorInfo}</p>}
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-gray-500">
              {agoText && <span className="font-medium">{agoText}</span>}
              {agoText && displayDate && <span>·</span>}
              {displayDate && <span>{displayDate}</span>}
              {likes > 0 && <span className="ml-1">👍 {likes}</span>}
              {comments > 0 && <span>💬 {comments}</span>}
              {shares > 0 && <span>🔁 {shares}</span>}
            </div>
          </div>
          <button onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
            {postText || <span className="text-gray-400 italic">Sin contenido</span>}
          </p>

          {/* Contact section */}
          <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setContactOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Contactar
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${contactOpen ? "rotate-180" : ""}`}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {contactOpen && (
              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100 dark:border-gray-800">
                {/* LinkedIn DM */}
                {liDmUrl && (
                  <a
                    href={liDmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border border-[#0a66c2]/30 dark:border-[#0a66c2]/40 bg-[#0a66c2]/5 dark:bg-[#0a66c2]/10 text-[#0a66c2] dark:text-[#5b9fd4] text-sm font-semibold hover:bg-[#0a66c2]/10 dark:hover:bg-[#0a66c2]/20 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    Enviar mensaje en LinkedIn
                    {liVanity && <span className="ml-auto text-xs opacity-60">@{liVanity}</span>}
                  </a>
                )}

                {/* Gmail */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") openGmail(); }}
                      placeholder="Email del recruiter"
                      className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:border-red-400 focus:ring-1 focus:ring-red-100 outline-none transition-all"
                    />
                    <button
                      onClick={openGmail}
                      disabled={!contactEmail.trim()}
                      className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-bold transition-colors active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                      </svg>
                      Gmail
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    Abre Gmail con asunto y cuerpo prellenados. Solo tocás Enviar.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── AI result / error — floating overlay centrado en el modal ── */}
        {(aiScore || analyzeError) && (
          <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none z-10">
            <div className="pointer-events-auto w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-5 space-y-4">

              {/* close */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {analyzeError ? "Error" : "Resultado IA"}
                </span>
                <button
                  onClick={() => { setAiScore(null); setAnalyzeError(null); }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {analyzeError && (
                <div className="space-y-3">
                  <p className="text-sm text-red-600 dark:text-red-400 leading-relaxed">{analyzeError}</p>
                  <a
                    href="/perfil?tab=tokens"
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
                  >
                    Ir a configurar tokens →
                  </a>
                </div>
              )}

              {aiScore && (
                <>
                  <div className="flex items-center gap-4">
                    <span className={`font-black text-5xl leading-none tabular-nums ${scoreColor}`}>{aiScore.score}</span>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        <span>Match</span><span>/100</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${scoreBarColor}`} style={{ width: `${aiScore.score}%` }} />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{aiScore.reason}</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-5 py-4 flex flex-col gap-2">
          {availableProviders.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Modelo:</span>
              <div className="flex gap-1 flex-wrap">
                {availableProviders.map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedProvider(p)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${
                      effectiveProvider === p
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-400"
                    }`}
                  >
                    {p === "nvidia" ? "Nvidia / Gemma 4" : p === "gemini" ? "Gemini" : p === "openai" ? "OpenAI" : "Anthropic"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Primary actions row */}
          <div className="flex gap-2">
            <button
              onClick={analyze}
              disabled={analyzing}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 text-white transition-all active:scale-95 whitespace-nowrap"
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Analizando...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
                  </svg>
                  {aiScore ? "Re-analizar" : "Analizar con IA"}
                </>
              )}
            </button>
            <button
              onClick={() => { onApply(); onClose(); }}
              className="flex-1 text-sm font-bold py-2.5 rounded-xl bg-gray-900 dark:bg-gray-700 text-white hover:bg-indigo-600 transition-all active:scale-95 whitespace-nowrap"
            >
              Postular →
            </button>
          </div>

          {/* Secondary actions row */}
          <div className="flex gap-2">
            <a href={postLink} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[#0a66c2] dark:text-[#5b9fd4] hover:bg-blue-50 dark:hover:bg-blue-950 transition-all text-xs font-medium"
              title="Ver en LinkedIn">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn
            </a>
            <button onClick={() => { onIgnore(); onClose(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-xs font-medium"
              title="Ignorar para siempre">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
              Ignorar
            </button>
            <button onClick={() => { onDelete(); onClose(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-all text-xs font-medium"
              title="Eliminar">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────────
function PostCard({
  post,
  score,
  config,
  dimmed = false,
  selected = false,
  onToggleSelect,
  onIgnore,
  onDelete,
  onApply,
}: {
  post: LIPost;
  score?: { score: number; reason: string };
  config: LIUserConfig | null;
  dimmed?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onIgnore: () => void;
  onDelete: () => void;
  onApply: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

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
    <>
    {modalOpen && (
      <PostModal
        post={post}
        score={score}
        config={config}
        onClose={() => setModalOpen(false)}
        onIgnore={onIgnore}
        onDelete={onDelete}
        onApply={onApply}
      />
    )}
    <div
      onClick={() => setModalOpen(true)}
      className={`relative bg-white dark:bg-gray-900 border rounded-2xl flex flex-col transition-all hover:shadow-md overflow-hidden cursor-pointer ${selected ? "border-indigo-400 ring-2 ring-indigo-100 dark:ring-indigo-900 shadow-sm" : dimmed ? "opacity-40 border-gray-200 dark:border-gray-800" : "border-gray-200 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-700"}`}>

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Checkbox (top-left) */}
        <button
          onClick={e => { e.stopPropagation(); onToggleSelect?.(); }}
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
            onClick={e => { e.stopPropagation(); onIgnore(); }}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 shadow-sm transition-all active:scale-95"
            title="Ignorar para siempre"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
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
              onClick={e => e.stopPropagation()}
              className="flex-1 text-center text-[11px] font-bold py-2.5 rounded-xl bg-[#0a66c2] text-white hover:bg-[#004182] transition-all shadow-sm active:scale-95"
            >
              Ver empleo
            </a>
            <button
              onClick={e => { e.stopPropagation(); onApply(); }}
              className="flex-1 text-[11px] font-bold py-2.5 rounded-xl bg-gray-900 dark:bg-gray-700 text-white hover:bg-indigo-600 dark:hover:bg-indigo-600 transition-all shadow-sm active:scale-95"
            >
              Postular →
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

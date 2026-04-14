"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getJobPosts,
  deleteJobPost,
  deleteAllJobPosts,
  deleteFilteredJobPosts,
  supabase,
} from "@/lib/supabase";
import { saveApplication, getApplications } from "@/lib/applications";
import { AlertModal, ConfirmModal } from "@/components/Modal";
import type { JobPost, JobFilters } from "@/types";

const TODAY = new Date().toISOString().split("T")[0];

type SortOption = "newest" | "oldest";
const SORT_LABELS: Record<SortOption, string> = {
  newest: "Más reciente",
  oldest: "Más antiguo",
};

export default function VacantesPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<JobFilters>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortOption>("newest");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [isScraping, setIsScraping] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const [scrapeTerm, setScrapeTerm] = useState("");
  const [scrapeHours, setScrapeHours] = useState(24);
  const [confirmClear, setConfirmClear] = useState(false);

  const PAGE_SIZE = 25;

  const toggleSelect = (id: string, e?: React.BaseSyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(jobs.map((j) => j.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const doBulkDelete = async () => {
    setConfirmBulkDelete(false);
    setClearingAll(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await deleteJobPost(id);
      }
      setJobs((prev) => prev.filter((j) => !selectedIds.has(j.id)));
      setTotal((prev) => prev - selectedIds.size);
      setSelectedIds(new Set());
      setAlertMsg(`Se han eliminado ${selectedIds.size} vacantes.`);
    } catch (err: any) {
      setAlertMsg("Error al borrar masivamente: " + err.message);
    } finally {
      setClearingAll(false);
    }
  };

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getJobPosts(
        { ...filters, search: search || undefined },
        page,
        PAGE_SIZE,
      );
      setJobs(result.data);
      setTotal(result.total);
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar vacantes");
    } finally {
      setLoading(false);
    }
  }, [filters, search, page]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const setFilter = (key: keyof JobFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const handleApply = (job: JobPost, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Redirigir al formulario de nueva postulación con la data precargada
    const params = new URLSearchParams();
    params.set("title", job.title || "");
    params.set("company", job.company || "");
    if (job.applyUrl) params.set("url", job.applyUrl);
    if (job.location) params.set("location", job.location);

    router.push(`/postulaciones/nueva?${params.toString()}`);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(id);
    try {
      await deleteJobPost(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      setAlertMsg(
        "Error al borrar: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setDeleting(null);
    }
  };

  const handleClearAll = () => setConfirmClear(true);

  const doClearAll = async () => {
    setConfirmClear(false);
    setClearingAll(true);
    try {
      await deleteAllJobPosts();
      setJobs([]);
      setTotal(0);
      setAlertMsg("Se han eliminado todas las vacantes del historial.");
    } catch (err) {
      setAlertMsg(
        "Error al vaciar: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setClearingAll(false);
    }
  };

  const handleBuscarVacantes = async (
    site: string,
    searchTerm?: string,
    hoursOld?: number,
  ) => {
    setIsScraping(site);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site,
          searchTerm: searchTerm || "frontend developer",
          hoursOld: hoursOld || 24,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await fetchJobs();
        setAlertMsg(
          `¡Búsqueda finalizada! Se agregaron ${data.count} empleos desde múltiples portales.`,
        );
      } else {
        throw new Error(data.error || "Error desconocido");
      }
    } catch (err: any) {
      console.error(err);
      setAlertMsg(
        "Error al intentar buscar vacantes (asegurate de tener python3): " +
          err.message,
      );
    } finally {
      setIsScraping(null);
    }
  };

  return (
    <>
      <ConfirmModal
        open={confirmClear}
        title="¿Vaciar todas las vacantes?"
        message={`Se eliminarán las ${total} vacantes de la base de datos. Esta acción no se puede deshacer.`}
        confirmLabel="Sí, vaciar todo"
        variant="danger"
        onConfirm={doClearAll}
        onCancel={() => setConfirmClear(false)}
      />
      <ConfirmModal
        open={confirmBulkDelete}
        title="¿Eliminar seleccionados?"
        message={`Se eliminarán ${selectedIds.size} vacantes. Esta acción no se puede deshacer.`}
        confirmLabel="Confirmar"
        variant="danger"
        onConfirm={doBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
      <ScrapeModal
        open={showScrapeModal}
        onClose={() => setShowScrapeModal(false)}
        onConfirm={(site, term, hours) => {
          setShowScrapeModal(false);
          handleBuscarVacantes(site, term, hours);
        }}
        initialTerm={scrapeTerm}
        initialHours={scrapeHours}
      />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Vacantes</h1>
              <p className="text-gray-500 text-sm mt-1">
                {total} oportunidades pendientes
              </p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  disabled={clearingAll || loading}
                  className="bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 transition-all flex items-center gap-2 shadow-lg shadow-red-100 animate-in slide-in-from-right-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  Borrar {selectedIds.size}
                </button>
              )}
              <button
                onClick={handleClearAll}
                disabled={clearingAll || loading}
                className="text-sm border border-gray-400 text-gray-400 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {clearingAll ? "Vaciando..." : "Vaciar todo"}
              </button>
              <button
                onClick={() => setShowScrapeModal(true)}
                disabled={isScraping !== null || loading}
                className="flex items-center justify-center min-w-[160px] gap-2 text-sm bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-75 shadow-lg shadow-indigo-100 font-bold"
              >
                {isScraping ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>🔍 Search Jobs</>
                )}
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-4 shadow-sm">
            <div className="flex items-center gap-2 px-3 py-1 border-r border-gray-100 pr-4">
              <input
                type="checkbox"
                checked={jobs.length > 0 && selectedIds.size === jobs.length}
                onChange={handleSelectAll}
                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-tighter">
                Todos
              </span>
            </div>
            <div className="flex-1 min-w-48 relative">
              <input
                type="text"
                placeholder="Buscar por título o empresa..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="w-full text-sm border-none focus:ring-0 outline-none placeholder:text-gray-300 pr-10"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setPage(0);
                  }}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    sort === s
                      ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {SORT_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse"
                >
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                  <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                  <div className="h-8 bg-gray-100 rounded w-1/3 mt-4" />
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg font-medium">No hay vacantes pendientes</p>
              <p className="text-sm mt-2">
                Nuevas oportunidades aparecerán aquí tras realizar un scrape.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...jobs]
                  .sort((a, b) => {
                    const dateA = new Date(
                      a.postedAt || a.createdAt || 0,
                    ).getTime();
                    const dateB = new Date(
                      b.postedAt || b.createdAt || 0,
                    ).getTime();
                    if (sort === "oldest") return dateA - dateB;
                    return dateB - dateA;
                  })
                  .map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      isNew={(job.postedAt ?? job.createdAt ?? "").startsWith(
                        TODAY,
                      )}
                      deleting={deleting === job.id}
                      selected={selectedIds.has(job.id)}
                      onSelect={(e) => toggleSelect(job.id, e)}
                      onApply={handleApply}
                      onDelete={handleDelete}
                    />
                  ))}
              </div>

              {total > PAGE_SIZE && (
                <div className="flex justify-center gap-2 mt-8">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="text-sm px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    ← Anterior
                  </button>
                  <span className="text-sm text-gray-500 px-4 py-2">
                    Pág {page + 1} / {Math.ceil(total / PAGE_SIZE)}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(page + 1) * PAGE_SIZE >= total}
                    className="text-sm px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AlertModal
        open={!!alertMsg}
        onClose={() => setAlertMsg(null)}
        message={alertMsg || ""}
      />
    </>
  );
}

function JobCard({
  job,
  isNew,
  deleting,
  selected,
  onSelect,
  onApply,
  onDelete,
}: {
  job: JobPost;
  isNew: boolean;
  deleting: boolean;
  selected: boolean;
  onSelect: (e: React.BaseSyntheticEvent) => void;
  onApply: (job: JobPost, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const router = useRouter();
  return (
    <div
      className={`relative group transition-all ${selected ? "scale-[0.98]" : ""}`}
    >
      <div
        onClick={onSelect}
        className={`absolute top-4 left-4 z-10 w-5 h-5 rounded-md border-2 cursor-pointer transition-all flex items-center justify-center ${
          selected
            ? "bg-indigo-600 border-indigo-600"
            : "bg-white/80 border-gray-300 opacity-0 group-hover:opacity-100"
        }`}
      >
        {selected && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        )}
      </div>

      <div
        onClick={() => router.push(`/vacantes/${job.id}`)}
        className={`border rounded-2xl p-6 bg-white transition-all flex flex-col gap-3 block h-full cursor-pointer ${
          selected
            ? "border-indigo-200 ring-2 ring-indigo-50 shadow-sm"
            : "border-gray-200 hover:border-indigo-200 hover:shadow-md"
        }`}
      >
        <div className="pr-7 pl-8">
          <div className="flex items-start gap-2">
            <h3 className="font-bold text-gray-900 text-sm leading-snug group-hover:text-indigo-600 transition-colors flex-1 ">
              {job.title}
            </h3>
            {isNew && (
              <span className="shrink-0 text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Nuevo
              </span>
            )}
          </div>
          <p className="text-gray-400 text-xs mt-1 font-medium italic">
            {job.company}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 pl-8">
          {job.modality && job.modality !== "unknown" && (
            <Tag variant={job.modality === "remote" ? "green" : "blue"}>
              {job.modality}
            </Tag>
          )}
          {job.seniority && job.seniority !== "unknown" && (
            <Tag variant="purple">{job.seniority}</Tag>
          )}
          {job.location && <Tag variant="gray">{job.location}</Tag>}
        </div>

        <div className="mt-auto pt-4 border-t border-gray-50">
          <div className="flex items-center justify-between mb-4 pl-8 pr-2">
            <span className="text-[10px] font-bold text-gray-300 uppercase">
              {job.postedAt
                ? new Date(job.postedAt).toLocaleDateString("es-AR")
                : job.createdAt
                  ? new Date(job.createdAt).toLocaleDateString("es-AR")
                  : "—"}
            </span>
            {job.applyUrl && (
              <span className="text-[10px] font-bold text-indigo-300 truncate max-w-32 uppercase">
                {new URL(job.applyUrl).hostname.replace("www.", "")}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (job.applyUrl) {
                  window.open(job.applyUrl, "_blank", "noopener,noreferrer");
                  window.focus();
                }
              }}
              className="flex-1 text-center text-[11px] font-bold py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all active:scale-95"
            >
              Ver empleo
            </button>
            <button
              onClick={(e) => onApply(job, e)}
              className="flex-[2] text-[11px] font-bold py-3 rounded-xl bg-gray-900 text-white hover:bg-indigo-600 transition-all shadow-lg shadow-gray-200 active:scale-95"
            >
              Postular ahora →
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={(e) => onDelete(job.id, e)}
        disabled={deleting}
        title="Borrar vacante"
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50 z-10"
      >
        {deleting ? (
          <span className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        )}
      </button>
    </div>
  );
}

type TagVariant = "gray" | "green" | "blue" | "purple";
const TAG_STYLES: Record<TagVariant, string> = {
  gray: "bg-gray-100 text-gray-500 border-gray-200",
  green: "bg-green-50 text-green-600 border-green-100",
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  purple: "bg-purple-50 text-purple-600 border-purple-100",
};

function Tag({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: TagVariant;
}) {
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${TAG_STYLES[variant]}`}
    >
      {children}
    </span>
  );
}

function ScrapeModal({
  open,
  onClose,
  onConfirm,
  initialTerm,
  initialHours,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (site: string, term: string, hours: number) => void;
  initialTerm: string;
  initialHours: number;
}) {
  const [term, setTerm] = useState(initialTerm);
  const [hours, setHours] = useState(initialHours);
  const [site, setSite] = useState("all");

  const SITES = [
    { id: "all", label: "Todos", icon: "🌍" },
    { id: "linkedin", label: "LinkedIn", icon: "🔗" },
    { id: "indeed", label: "Indeed", icon: "💼" },
    { id: "glassdoor", label: "Glassdoor", icon: "🏢" },
    { id: "google", label: "Google", icon: "🔍" },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              Buscar nuevas vacantes
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Configura los parámetros de búsqueda
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Plataforma
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SITES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSite(s.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                    site === s.id
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200"
                  }`}
                >
                  <span className="text-lg">{s.icon}</span>
                  <span className="text-[10px] font-bold uppercase">
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              {site === "google"
                ? "Término de búsqueda de Google"
                : "Título del trabajo"}
            </label>
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={
                site === "google"
                  ? "Ej: software engineer jobs remote..."
                  : "Ej: Frontend Developer, React..."
              }
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all outline-none font-medium text-gray-700"
              autoFocus
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Antigüedad de la oferta
              </label>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                Últimas {hours} {hours === 1 ? "hora" : "horas"}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
              <span>1h</span>
              <span>12h</span>
              <span>24h</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 text-gray-500 text-sm font-bold py-3.5 rounded-2xl hover:bg-gray-50 transition-all active:scale-95"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(site, term, hours)}
            disabled={!term.trim()}
            className="flex-[2] bg-indigo-600 text-white text-sm font-bold py-3.5 rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
          >
            Iniciar búsqueda
          </button>
        </div>
      </div>
    </div>
  );
}

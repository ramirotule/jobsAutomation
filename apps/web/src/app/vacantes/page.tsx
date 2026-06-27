"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getJobPosts,
  deleteJobPost,
  deleteAllJobPosts,
  deleteFilteredJobPosts,
} from "@/lib/supabase";
import { saveApplication, getApplications } from "@/lib/applications";
import { AlertModal, ConfirmModal } from "@/components/Modal";
import type { JobPost, JobFilters } from "@/types";

const TODAY = new Date().toISOString().split("T")[0];

type SortOption = "newest" | "oldest" | "best_match";
const SORT_LABELS: Record<SortOption, string> = {
  newest: "Más reciente",
  oldest: "Más antiguo",
  best_match: "Best match",
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
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [appliedCompanies, setAppliedCompanies] = useState<Record<string, string>>({});
  const [companySearch, setCompanySearch] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [tailoring, setTailoring] = useState<string | null>(null);
  const [tailorResult, setTailorResult] = useState<any>(null);
  const [batchProgress, setBatchProgress] = useState<{ total: number; processed: number; isComplete: boolean } | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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
      // setAlertMsg(`Se han eliminado ${selectedIds.size} vacantes.`);
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
    const fetchHistory = async () => {
      try {
        const apps = await getApplications();
        const companies: Record<string, string> = {};
        apps.forEach((a) => {
          const name = a.company.toLowerCase().trim();
          if (name && !companies[name]) {
            companies[name] = a.appliedAt;
          }
        });
        setAppliedCompanies(companies);
      } catch (e) {
        console.error("Error fetching history:", e);
      }
    };
    fetchHistory();
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

  const handleIgnore = async (
    job: JobPost,
    muteCompany: boolean,
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsScraping("ignoring"); // Reuse state or add new one
    try {
      const { ignoreJobPost } = await import("@/lib/supabase");
      await ignoreJobPost(job, muteCompany);

      setJobs((prev) =>
        muteCompany
          ? prev.filter((j) => j.company !== job.company)
          : prev.filter((j) => j.id !== job.id),
      );
    } catch (err: any) {
      setAlertMsg("Error al silenciar: " + err.message);
    } finally {
      setIsScraping(null);
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
      // setAlertMsg("Se han eliminado todas las vacantes del historial.");
    } catch (err) {
      setAlertMsg(
        "Error al vaciar: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setClearingAll(false);
    }
  };

  const stopBatch = useCallback(() => {
    pollingRef.current = null;
    setBatchProgress(null);
  }, []);

  const processNextJob = useCallback(async (total: number, processed: number) => {
    // Check if cancelled
    if (!pollingRef.current) return;

    try {
      const res = await fetch("/api/match/batch", { method: "POST" });

      if (res.status === 429) {
        // Rate limited — wait and retry
        setBatchProgress((prev) => prev ? { ...prev, total, processed } : null);
        setTimeout(() => processNextJob(total, processed), 60000);
        return;
      }

      const data = await res.json();

      if (data.error) {
        console.error("Batch error:", data.error);
        stopBatch();
        return;
      }

      if (data.isComplete) {
        stopBatch();
        await fetchJobs();
        return;
      }

      const newProcessed = processed + 1;
      const newTotal = newProcessed + (data.remaining || 0);
      setBatchProgress({ total: newTotal, processed: newProcessed, isComplete: false });

      // Refresh job list periodically (every 3 processed jobs)
      if (newProcessed % 3 === 0) {
        await fetchJobs();
      }

      // Process next job after a short delay (rate limit: 4s between Gemini calls)
      setTimeout(() => processNextJob(newTotal, newProcessed), data.score === -1 ? 200 : 4500);
    } catch (err) {
      console.error("Batch match error:", err);
      stopBatch();
    }
  }, [fetchJobs, stopBatch]);

  const triggerBatchMatch = useCallback(async () => {
    // First call to get the initial count
    try {
      const res = await fetch("/api/match/batch", { method: "POST" });
      const data = await res.json();

      if (data.isComplete || data.remaining === 0) return;

      const total = (data.remaining || 0) + 1;
      pollingRef.current = {} as any; // flag as active
      setBatchProgress({ total, processed: data.score != null ? 1 : 0, isComplete: false });

      // Start processing chain
      const delay = data.score === -1 ? 200 : 4500;
      setTimeout(() => processNextJob(total, data.score != null ? 1 : 0), delay);
    } catch (err) {
      console.error("Batch match error:", err);
    }
  }, [processNextJob]);

  const handleOpenAllJobs = () => {
    jobs.forEach((job) => {
      if (job.applyUrl) {
        window.open(job.applyUrl, "_blank", "noopener,noreferrer");
      }
    });
  };

  const handleJobSearch = async (query: string, location: string, datePosted: string, remoteOnly: boolean, provider: string) => {
    setIsScraping(provider);
    try {
      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, location, datePosted, remoteOnly, provider }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchJobs();
        if (data.count > 0) {
          triggerBatchMatch();
          setAlertMsg(`${data.count} new jobs found! AI matching started...`);
        } else {
          setAlertMsg(data.message || 'No new results.');
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setAlertMsg('Error searching jobs: ' + err.message);
    } finally {
      setIsScraping(null);
    }
  };

  const handleTailorCV = async (job: JobPost, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTailoring(job.id);
    try {
      const res = await fetch('/api/cv/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setTailorResult({ job, data });
      } else {
        setAlertMsg(data.error || 'Error tailoring CV');
      }
    } catch (err: any) {
      setAlertMsg('Error tailoring CV: ' + err.message);
    } finally {
      setTailoring(null);
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
      <JobSearchModal
        open={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onConfirm={(query, location, datePosted, remoteOnly, provider) => {
          setShowSearchModal(false);
          handleJobSearch(query, location, datePosted, remoteOnly, provider);
        }}
      />
      <TailorResultModal
        open={!!tailorResult}
        result={tailorResult}
        onClose={() => setTailorResult(null)}
      />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Vacantes</h1>
              <p className="text-gray-500 text-sm mt-1">{total} oportunidades pendientes</p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  disabled={clearingAll || loading}
                  className="bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 transition-all flex items-center gap-2 animate-in slide-in-from-right-2"
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
                onClick={handleOpenAllJobs}
                disabled={jobs.length === 0 || loading}
                className="text-sm bg-green-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-green-700 transition-all disabled:opacity-50"
              >
                Abrir todas
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearingAll || loading}
                className="text-sm border border-gray-400 text-gray-400 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Vaciar todo
              </button>
            </div>
          </div>


          {batchProgress && !batchProgress.isComplete && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-4 flex items-center gap-3">
              <span className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin shrink-0" />
              <div className="flex-1">
                <span className="text-sm font-bold text-indigo-700">
                  Analyzing jobs with AI... {batchProgress.processed}/{batchProgress.total}
                </span>
                <div className="w-full bg-indigo-100 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${(batchProgress.processed / batchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

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
                placeholder="Buscar vacantes..."
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
            <div className="flex-1 min-w-48 relative border-l border-gray-100 pl-4">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <input
                  type="text"
                  placeholder="Check Historial Empresa..."
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="w-full text-sm border-none focus:ring-0 outline-none placeholder:text-gray-300 pr-10"
                />
              </div>
              {companySearch && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-20 p-3 animate-in fade-in slide-in-from-top-1 max-h-60 overflow-y-auto">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {Object.keys(appliedCompanies).filter(c => c.includes(companySearch.toLowerCase().trim())).length > 0 
                      ? "Coincidencias encontradas" 
                      : "Sin historial previo"}
                  </p>
                  <div className="space-y-1">
                    {Object.keys(appliedCompanies)
                      .filter(c => c.includes(companySearch.toLowerCase().trim()))
                      .map((c, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-orange-600 bg-orange-50 p-2 rounded-lg text-xs font-bold border border-orange-100">
                          <div className="flex flex-col">
                            <span className="capitalize">{c}</span>
                            <span className="text-[10px] text-orange-400 font-medium">Última: {new Date(appliedCompanies[c]).toLocaleDateString('es-AR')}</span>
                          </div>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path></svg>
                        </div>
                      ))}
                    {Object.keys(appliedCompanies).filter(c => c.includes(companySearch.toLowerCase().trim())).length === 0 && (
                      <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded-lg text-xs font-bold border border-green-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
                        No has postulado aún a "{companySearch}"
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setCompanySearch("")} 
                    className="mt-3 w-full py-1 text-[9px] font-black uppercase text-gray-400 hover:text-gray-600 transition-colors border-t border-gray-50 pt-2"
                  >
                    Limpiar
                  </button>
                </div>
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
                    if (sort === "best_match") {
                      const scoreA = a.matchScore ?? -2;
                      const scoreB = b.matchScore ?? -2;
                      return scoreB - scoreA;
                    }
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
                      onIgnore={handleIgnore}
                      onTailorCV={handleTailorCV}
                      hasHistory={appliedCompanies[job.company?.toLowerCase().trim()] !== undefined}
                      lastAppliedDate={appliedCompanies[job.company?.toLowerCase().trim()]}
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

      {(isScraping || clearingAll || deleting || tailoring) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
            <span className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-gray-800 font-bold tracking-tight">
              {isScraping === "ignoring"
                ? "Silenciando vacante..."
                : tailoring
                  ? "Adapting CV..."
                  : isScraping
                    ? "Searching jobs..."
                    : clearingAll
                      ? "Deleting jobs..."
                      : "Deleting job..."}
            </p>
          </div>
        </div>
      )}
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
  onIgnore,
  onTailorCV,
  hasHistory,
  lastAppliedDate,
}: {
  job: JobPost;
  isNew: boolean;
  deleting: boolean;
  selected: boolean;
  onSelect: (e: React.BaseSyntheticEvent) => void;
  onApply: (job: JobPost, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onIgnore: (job: JobPost, muteCompany: boolean, e: React.MouseEvent) => void;
  onTailorCV: (job: JobPost, e: React.MouseEvent) => void;
  hasHistory?: boolean;
  lastAppliedDate?: string;
}) {
  const router = useRouter();
  const [showMuteMenu, setShowMuteMenu] = useState(false);


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
        // Disabilitado temporalmente por pedido del usuario
        // onClick={() => router.push(`/vacantes/${job.id}`)}
        className={`border rounded-2xl p-6 bg-white transition-all flex flex-col gap-3 block h-full ${
          selected
            ? "border-indigo-200 ring-2 ring-indigo-50 shadow-sm"
            : "border-gray-200 hover:border-indigo-200 hover:shadow-md"
        }`}
      >
        <div className="pr-24 pl-8">
          <div className="flex items-start gap-2">
            <h3 className="font-bold text-gray-900 text-sm leading-snug group-hover:text-indigo-600 transition-colors flex-1 ">
              {job.title}
            </h3>
            {job.matchScore != null && job.matchScore >= 0 && (
              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                job.matchScore >= 80 ? 'bg-green-50 text-green-600' :
                job.matchScore >= 50 ? 'bg-yellow-50 text-yellow-600' :
                'bg-red-50 text-red-500'
              }`}>
                {job.matchScore}%
              </span>
            )}
            {job.matchScore == null && (
              <span className="shrink-0 text-[10px] bg-gray-50 text-gray-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                ...
              </span>
            )}
            {isNew && (
              <span className="shrink-0 text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Nuevo
              </span>
            )}
          </div>
          <p className="text-gray-400 text-xs mt-1 font-medium italic">
            {job.company}
          </p>
          {hasHistory && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-black uppercase bg-orange-100 text-orange-600 px-2 py-1 rounded-md border border-orange-200 animate-in fade-in duration-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path></svg>
              Ya postulaste {lastAppliedDate && `el ${new Date(lastAppliedDate).toLocaleDateString('es-AR')}`}
            </div>
          )}
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
              className="flex-1 text-center text-[11px] font-bold py-3 rounded-xl bg-[#0a66c2] text-white hover:bg-[#004182] transition-all active:scale-95"
            >
              Ver empleo
            </button>
            <button
              onClick={(e) => onApply(job, e)}
              className="flex-1 text-[11px] font-bold py-3 rounded-xl bg-gray-900 text-white hover:bg-indigo-600 transition-all active:scale-95"
            >
              Postular ahora →
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTailorCV(job, e);
              }}
              className="text-[11px] font-bold py-3 px-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all active:scale-95"
              title="Adapt CV for this position"
            >
              CV
            </button>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMuteMenu(!showMuteMenu);
            }}
            title="Opciones de silencio"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-orange-500 hover:bg-orange-50 transition-all"
          >
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
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          </button>

          {showMuteMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-1 duration-200 overflow-hidden">
              <button
                onClick={(e) => {
                  setShowMuteMenu(false);
                  onIgnore(job, false, e);
                }}
                className="w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 hover:bg-orange-50 hover:text-orange-600 transition-colors"
              >
                No mostrar esta oferta
              </button>
              <button
                onClick={(e) => {
                  setShowMuteMenu(false);
                  onIgnore(job, true, e);
                }}
                className="w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                Poner en Lista Negra {job.company}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={(e) => onDelete(job.id, e)}
          disabled={deleting}
          title="Borrar vacante"
          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
        >
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
        </button>
      </div>
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

function JobSearchModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (query: string, location: string, datePosted: string, remoteOnly: boolean, provider: string) => void;
}) {
  const [query, setQuery] = useState('frontend developer');
  const [location, setLocation] = useState('Remote');
  const [datePosted, setDatePosted] = useState('week');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [provider, setProvider] = useState('jobspy');

  const PROVIDERS = [
    { value: 'jobspy', label: 'JobSpy', desc: 'LinkedIn + Indeed + Glassdoor (free)' },
    { value: 'linkedin-api', label: 'LinkedIn API', desc: 'Direct LinkedIn search (RapidAPI)' },
    { value: 'jsearch', label: 'JSearch', desc: 'Multi-source aggregator (RapidAPI)' },
  ];

  const LOCATIONS = [
    { value: 'Argentina', label: 'Argentina' },
    { value: 'United States', label: 'USA' },
    { value: 'España', label: 'Spain' },
    { value: 'México', label: 'Mexico' },
    { value: 'Colombia', label: 'Colombia' },
    { value: 'Remote', label: 'Remote' },
  ];

  const DATE_OPTIONS = [
    { value: 'today', label: 'Today' },
    { value: '3days', label: '3 days' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'all', label: 'All' },
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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Search Jobs</h2>
            <p className="text-xs text-gray-500 font-medium">{PROVIDERS.find(p => p.value === provider)?.desc}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              API Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setProvider(p.value)}
                  className={`flex flex-col items-center gap-0.5 p-3 rounded-xl border-2 transition-all ${
                    provider === p.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                  }`}
                >
                  <span className="text-xs font-bold">{p.label}</span>
                  <span className="text-[9px] font-medium opacity-70">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Search query
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. React developer, Frontend Engineer..."
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all outline-none font-medium text-gray-700"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Location
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LOCATIONS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLocation(l.value)}
                  className={`flex items-center justify-center gap-1 p-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                    location === l.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Posted within
            </label>
            <div className="flex flex-wrap gap-2">
              {DATE_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDatePosted(d.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg border-2 font-bold transition-all ${
                    datePosted === d.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setRemoteOnly(!remoteOnly)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                remoteOnly ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  remoteOnly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm font-bold text-gray-600">Remote only</span>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 text-gray-500 text-sm font-bold py-3.5 rounded-2xl hover:bg-gray-50 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(query, location, datePosted, remoteOnly, provider)}
            disabled={!query.trim()}
            className="flex-[2] bg-indigo-600 text-white text-sm font-bold py-3.5 rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
          >
            Search Jobs
          </button>
        </div>
      </div>
    </div>
  );
}

function TailorResultModal({
  open,
  result,
  onClose,
}: {
  open: boolean;
  result: { job: JobPost; data: any } | null;
  onClose: () => void;
}) {
  if (!open || !result) return null;

  const { job, data } = result;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Tailored CV</h2>
            <p className="text-xs text-gray-500 font-medium">{job.title} at {job.company}</p>
          </div>
        </div>

        {data.match_improvement && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-4">
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Match Improvement</p>
            <p className="text-sm text-emerald-800">{data.match_improvement}</p>
          </div>
        )}

        {data.keywords_added && data.keywords_added.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {data.keywords_added.map((kw: string, i: number) => (
              <span key={i} className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-indigo-50 text-indigo-600 border-indigo-100">
                {kw}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tailored CV</p>
              <button
                onClick={() => copyToClipboard(data.tailored_cv)}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors"
              >
                Copy
              </button>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto font-mono leading-relaxed">
              {data.tailored_cv}
            </div>
          </div>

          {data.cover_letter_suggestion && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Cover Letter</p>
                <button
                  onClick={() => copyToClipboard(data.cover_letter_suggestion)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm text-gray-700 whitespace-pre-wrap">
                {data.cover_letter_suggestion}
              </div>
            </div>
          )}

          {data.changes_made && data.changes_made.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Changes Made</p>
              <ul className="space-y-1">
                {data.changes_made.map((change: string, i: number) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8">
          <button
            onClick={onClose}
            className="w-full text-gray-500 text-sm font-bold py-3.5 rounded-2xl hover:bg-gray-50 transition-all active:scale-95 border border-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


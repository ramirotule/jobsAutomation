"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getApplications,
  deleteApplication,
  bulkUpdateApplicationStatus,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/applications";
import { ConfirmModal, AlertModal } from "@/components/Modal";
import type { StoredApplication, AppStatus } from "@/lib/applications";

const STATUS_ORDER: AppStatus[] = [
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "ghosted",
  "ignored",
];

type SortOption = "newest" | "oldest";
const SORT_LABELS: Record<SortOption, string> = {
  newest: "Más reciente",
  oldest: "Más antiguo",
};

export default function PostulacionesPage() {
  const [apps, setApps] = useState<StoredApplication[]>([]);
  const [filter, setFilter] = useState<AppStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  useEffect(() => {
    getApplications().then(setApps);
  }, []);

  const filtered =
    filter === "all" ? apps : apps.filter((a) => a.status === filter);
  
  const searched =
    search.trim() === ""
      ? filtered
      : filtered.filter(
          (a) =>
            a.title.toLowerCase().includes(search.toLowerCase()) ||
            a.company.toLowerCase().includes(search.toLowerCase()) ||
            a.recruiterName?.toLowerCase().includes(search.toLowerCase()),
        );

  const visible = [...searched].sort((a, b) => {
    const dateA = new Date(a.appliedAt || 0).getTime();
    const dateB = new Date(b.appliedAt || 0).getTime();
    return sort === "newest" ? dateB - dateA : dateA - dateB;
  });

  const counts = STATUS_ORDER.reduce(
    (acc, s) => {
      acc[s] = apps.filter((a) => a.status === s).length;
      return acc;
    },
    {} as Record<AppStatus, number>,
  );

  const handleDelete = (id: string) => setDeletingId(id);

  const doDelete = async () => {
    if (!deletingId) return;
    await deleteApplication(deletingId);
    setApps(await getApplications());
    setDeletingId(null);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(visible.map(a => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkStatusUpdate = async (status: AppStatus) => {
    if (selectedIds.size === 0) return;
    setIsUpdating(true);
    try {
      await bulkUpdateApplicationStatus(Array.from(selectedIds), status);
      setApps(await getApplications());
      setSelectedIds(new Set());
      setAlertMsg(`Se actualizaron ${selectedIds.size} postulaciones.`);
    } catch (err: any) {
      setAlertMsg("Error al actualizar: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsUpdating(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await deleteApplication(id);
      }
      setApps(await getApplications());
      setSelectedIds(new Set());
      setAlertMsg(`Se eliminaron ${selectedIds.size} postulaciones.`);
    } catch (err: any) {
      setAlertMsg("Error al eliminar masivamente: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <ConfirmModal
        open={!!deletingId}
        title="¿Eliminar postulación?"
        message="Se eliminará el registro de esta postulación y todas sus notas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setDeletingId(null)}
      />
      
      <AlertModal 
        open={!!alertMsg} 
        onClose={() => setAlertMsg(null)} 
        message={alertMsg || ""} 
      />

      {/* Bulk action bar — above bottom nav on mobile */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 w-[calc(100%-2rem)] max-w-lg">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex flex-col gap-2 border border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">{selectedIds.size} seleccionadas</span>
              <button
                onClick={handleBulkDelete}
                disabled={isUpdating}
                className="text-red-400 hover:bg-red-900/40 p-1.5 rounded-lg transition-colors"
                title="Eliminar seleccionadas"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
            <div className="flex gap-1 flex-wrap">
              {(["ghosted","ignored","rejected","applied"] as AppStatus[]).map((st, i) => (
                <button
                  key={st}
                  onClick={() => handleBulkStatusUpdate(st)}
                  disabled={isUpdating}
                  className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors ${
                    i === 1 ? "text-orange-400" : i === 2 ? "text-red-300" : i === 3 ? "text-blue-300" : ""
                  }`}
                >
                  {STATUS_LABELS[st]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-4xl mx-auto px-4 py-5 lg:py-8 pb-32">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Postulaciones</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {apps.length} registro{apps.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Link
              href="/postulaciones/nueva"
              className="self-start sm:self-auto text-sm bg-green-600 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-green-700 transition-all flex items-center gap-2 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nueva
            </Link>
          </div>

          {/* Search + sort bar */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 mb-4 shadow-sm space-y-3">
            {/* Row 1: checkbox + search */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={visible.length > 0 && selectedIds.size === visible.length}
                onChange={handleSelectAll}
                className="w-5 h-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Buscar puesto, empresa o recruiter..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 outline-none focus:border-indigo-300 placeholder:text-gray-300 dark:text-gray-200 pr-8 transition-all"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute inset-y-0 right-2 flex items-center text-gray-300 hover:text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                )}
              </div>
            </div>
            {/* Row 2: sort */}
            <div className="flex gap-1.5">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    sort === s
                      ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900"
                      : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {SORT_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter chips — horizontal scroll on mobile */}
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap">
            <button
              onClick={() => setFilter("all")}
              className={`text-[10px] uppercase font-black tracking-widest px-3 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
                filter === "all"
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-sm"
                  : "bg-white dark:bg-gray-900 text-gray-400 border border-gray-200 dark:border-gray-700"
              }`}
            >
              Todas ({apps.length})
            </button>
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-[10px] uppercase font-black tracking-widest px-3 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
                  filter === s
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-sm"
                    : "bg-white dark:bg-gray-900 text-gray-400 border border-gray-200 dark:border-gray-700"
                }`}
              >
                {STATUS_LABELS[s]} ({counts[s]})
              </button>
            ))}
          </div>

          {apps.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg font-medium">Sin postulaciones todavía</p>
              <p className="text-sm mt-2">
                Hacé click en "Aplicar" en una vacante para registrarla acá.
              </p>
              <Link
                href="/vacantes"
                className="inline-block mt-4 text-sm text-blue-600 hover:underline"
              >
                Ver vacantes →
              </Link>
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-2xl">
              <p className="text-gray-400">
                No se encontraron postulaciones que coincidan con la búsqueda.
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="mt-2 text-sm text-blue-600 hover:underline"
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visible.map((app) => (
                <AppCard 
                  key={app.id} 
                  app={app} 
                  onDelete={handleDelete}
                  selected={selectedIds.has(app.id)}
                  onSelect={() => toggleSelect(app.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function AppCard({
  app,
  onDelete,
  selected,
  onSelect,
}: {
  app: StoredApplication;
  onDelete: (id: string) => void;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer flex items-start gap-3 ${
        selected
          ? "border-indigo-500 ring-2 ring-indigo-50 dark:ring-indigo-950"
          : "border-gray-200 dark:border-gray-800"
      }`}
    >
      {/* Checkbox */}
      <div className="pt-0.5 shrink-0">
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
          selected ? "bg-indigo-600 border-indigo-600" : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
        }`}>
          {selected && (
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
        {/* Title + badge */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-snug">{app.title}</h3>
          <span className={`shrink-0 text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-lg ${STATUS_COLORS[app.status]}`}>
            {STATUS_LABELS[app.status]}
          </span>
        </div>

        {/* Company + location */}
        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium truncate">
          {app.company}{app.location ? ` · ${app.location}` : ""}
        </p>

        {/* Recruiter */}
        {app.recruiterName && (
          <span className="inline-block mt-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[9px] uppercase font-black tracking-widest">
            Recruiter: {app.recruiterName}
          </span>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] font-bold text-gray-400 dark:text-gray-500">
          <span>
            Postulado:{" "}
            <span className="text-gray-700 dark:text-gray-300">
              {new Date(app.appliedAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </span>
          {app.salaryExpectation && (
            <span className="text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-2 rounded-lg">
              Pretensión: {app.currency} {app.salaryExpectation.toLocaleString()}
            </span>
          )}
          {app.salaryOffered && (
            <span className="text-green-600 bg-green-50 dark:bg-green-950/50 px-2 rounded-lg">
              Oferta: {app.currency} {app.salaryOffered.toLocaleString()}
            </span>
          )}
        </div>

        {/* Notes */}
        {app.notes && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 italic leading-relaxed">
            "{app.notes}"
          </p>
        )}

        {/* Actions — full width row on mobile */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Link
            href={`/postulaciones/${app.id}`}
            className="flex-1 text-center text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-3 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95"
          >
            Ver detalle
          </Link>
          {app.applyUrl && (
            <a
              href={app.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-center text-[11px] font-bold border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-all active:scale-95"
            >
              Oferta ↗
            </a>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(app.id); }}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-all"
            title="Eliminar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

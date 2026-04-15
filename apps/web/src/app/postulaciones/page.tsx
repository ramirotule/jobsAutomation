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

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl p-2 pl-6 flex items-center gap-4 border border-gray-800 backdrop-blur-sm">
            <span className="text-xs font-bold whitespace-nowrap">
              {selectedIds.size} seleccionadas
            </span>
            <div className="h-4 w-px bg-gray-700" />
            <div className="flex gap-1">
              <button
                onClick={() => handleBulkStatusUpdate("ghosted")}
                disabled={isUpdating}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Ghosteado
              </button>
              <button
                onClick={() => handleBulkStatusUpdate("ignored")}
                disabled={isUpdating}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-orange-400"
              >
                Ignorado
              </button>
              <button
                onClick={() => handleBulkStatusUpdate("rejected")}
                disabled={isUpdating}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-red-300"
              >
                Rechazado
              </button>
              <button
                onClick={() => handleBulkStatusUpdate("applied")}
                disabled={isUpdating}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-blue-300"
              >
                Reset Applied
              </button>
              <div className="h-8 w-px bg-gray-700 mx-1" />
              <button
                onClick={handleBulkDelete}
                disabled={isUpdating}
                className="text-red-400 hover:bg-red-900/40 p-2 rounded-lg transition-colors"
                title="Eliminar seleccionadas"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8 pb-32">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Postulaciones
              </h1>
              <p className="text-sm text-gray-500 mt-1 font-medium">
                {apps.length} registro{apps.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/postulaciones/nueva"
                className="text-sm bg-green-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center gap-2 active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Nueva postulación
              </Link>
              <Link
                href="/vacantes"
                className="text-sm font-bold border border-gray-300 text-gray-400 px-4 py-2 rounded-xl hover:bg-white hover:text-gray-600 transition-all active:scale-95"
              >
                Ver vacantes
              </Link>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-4 shadow-sm">
             <div className="flex items-center gap-2 px-3 py-1 border-r border-gray-100 pr-4">
               <input
                 type="checkbox"
                 checked={visible.length > 0 && selectedIds.size === visible.length}
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
                placeholder="Buscar por puesto, empresa o recruiter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm border-none focus:ring-0 outline-none placeholder:text-gray-300 pr-10"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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

          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setFilter("all")}
              className={`text-[10px] uppercase font-black tracking-widest px-4 py-2 rounded-xl transition-all ${
                filter === "all"
                  ? "bg-gray-900 text-white shadow-lg shadow-gray-200"
                  : "bg-white text-gray-400 border border-gray-200 hover:border-gray-300"
              }`}
            >
              Todas ({apps.length})
            </button>
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-[10px] uppercase font-black tracking-widest px-4 py-2 rounded-xl transition-all ${
                  filter === s
                    ? "bg-gray-900 text-white shadow-lg shadow-gray-200"
                    : "bg-white text-gray-400 border border-gray-200 hover:border-gray-300"
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
      className={`bg-white border rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer relative flex items-start gap-4 ${
        selected ? 'border-indigo-600 ring-2 ring-indigo-50 bg-indigo-50/10' : 'border-gray-200'
      }`}
    >
      <div className="pt-1">
        <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${
          selected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'
        }`}>
          {selected && (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold text-gray-900 text-sm">{app.title}</h3>
              <span
                className={`text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-lg ${STATUS_COLORS[app.status]}`}
              >
                {STATUS_LABELS[app.status]}
              </span>
            </div>
            <p className="text-xs text-gray-400 font-medium">
              {app.company}
              {app.location ? ` · ${app.location}` : ""}
              {app.recruiterName && (
                <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] uppercase font-black tracking-widest">
                  Recruiter: {app.recruiterName}
                </span>
              )}
            </p>

            <div className="flex flex-wrap gap-4 mt-4 text-[11px] font-bold text-gray-400 uppercase tracking-tight">
              <span>
                Postulado:{" "}
                <span className="text-gray-900">
                  {new Date(app.appliedAt).toLocaleDateString("es-AR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </span>
              {app.salaryExpectation && (
                <span className="text-blue-600 bg-blue-50 px-2 rounded-lg">
                  Pretensión: {app.currency}{" "}
                  {app.salaryExpectation.toLocaleString()}
                </span>
              )}
              {app.salaryOffered && (
                <span className="text-green-600 bg-green-50 px-2 rounded-lg">
                  Oferta: {app.currency} {app.salaryOffered.toLocaleString()}
                </span>
              )}
            </div>

            {app.notes && (
              <p className="mt-3 text-xs text-gray-500 line-clamp-2 bg-gray-50/50 rounded-xl px-4 py-2 border border-gray-100/50 italic leading-relaxed">
                "{app.notes}"
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/postulaciones/${app.id}`}
              className="text-[11px] font-bold bg-gray-100 text-gray-400 px-4 py-2 rounded-xl hover:bg-gray-200 hover:text-gray-600 transition-all active:scale-95"
            >
              Ver detalle
            </Link>
            {app.applyUrl && (
              <a
                href={app.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-bold border border-gray-200 text-gray-400 px-4 py-2 rounded-xl hover:bg-white hover:text-gray-600 transition-all active:scale-95"
              >
                Oferta ↗
              </a>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(app.id);
              }}
              className="text-gray-300 hover:text-red-500 transition-all p-2 rounded-xl hover:bg-red-50"
              title="Eliminar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

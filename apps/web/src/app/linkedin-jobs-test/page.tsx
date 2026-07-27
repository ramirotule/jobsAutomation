"use client";

import { useState, useRef } from "react";
import Link from "next/link";

interface LinkedInJob {
  title?: string;
  location?: string;
  postedTime?: string;
  publishedAt?: string;
  jobUrl?: string;
  companyName?: string;
  companyUrl?: string;
}

const WORK_SCHEDULES = ["Any", "On-site", "Remote", "Hybrid"];
const EXPERIENCE_LEVELS = ["Any", "Internship", "Entry level", "Associate", "Mid-Senior level", "Director", "Executive"];
const JOB_TYPES = ["Any", "Full-time", "Part-time", "Contract", "Temporary", "Volunteer", "Internship", "Other"];
const JOB_POSTING_TIMES = ["Any Time", "Past 24 hours", "Past week", "Past month"];

export default function LinkedInJobsTestPage() {
  const [jobTitle, setJobTitle] = useState("Frontend");
  const [location, setLocation] = useState("Argentina");
  const [workSchedule, setWorkSchedule] = useState("Remote");
  const [maxJobs, setMaxJobs] = useState(50);
  const [experienceLevel, setExperienceLevel] = useState("Any");
  const [jobType, setJobType] = useState("Any");
  const [jobPostingTime, setJobPostingTime] = useState("Past month");
  const [companyNamesInput, setCompanyNamesInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [results, setResults] = useState<LinkedInJob[]>([]);
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

    if (!jobTitle) {
      setError("El título de búsqueda no puede estar vacío.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setStatusMessage("Iniciando actor en Apify...");

    const companyNames = companyNamesInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    try {
      const startResponse = await fetch("/api/linkedin-jobs-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          jobTitle,
          location,
          workSchedule,
          maxJobs,
          companyNames,
          experienceLevel,
          jobType,
          jobPostingTime,
          searchAfterJobs: 0,
        }),
      });

      const startData = await startResponse.json();

      if (!startResponse.ok) {
        throw new Error(startData.error || "No se pudo iniciar el Actor de Apify.");
      }

      const { runId, datasetId, status: initialStatus } = startData;
      setStatusMessage(`Run iniciado (${runId}). Estado: ${initialStatus}...`);

      let attempts = 0;
      const maxAttempts = 100;

      const pollStatus = async () => {
        attempts++;
        if (attempts > maxAttempts) {
          setError("Tiempo de espera agotado. El scraper sigue ejecutándose en Apify en segundo plano.");
          setLoading(false);
          return;
        }

        try {
          const statusResponse = await fetch("/api/linkedin-jobs-test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "status", runId, datasetId }),
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
            const jobs: LinkedInJob[] = statusData.data || [];
            const sorted = [...jobs].sort((a, b) => {
              const dateA = new Date(a.postedTime || a.publishedAt || 0).getTime();
              const dateB = new Date(b.postedTime || b.publishedAt || 0).getTime();
              return dateB - dateA;
            });
            setResults(sorted);
            setLoading(false);
            setStatusMessage("");
          } else if (["FAILED", "ABORTED", "TIMED-OUT"].includes(currentStatus)) {
            throw new Error(`El run terminó de forma inesperada con estado: ${currentStatus}`);
          } else {
            setStatusMessage(`Scrapeando vacantes de LinkedIn (Estado: ${currentStatus}) - Intento ${attempts}...`);
            pollTimerRef.current = setTimeout(pollStatus, 3000);
          }
        } catch (pollErr: any) {
          setError(pollErr.message || "Error durante la verificación de estado.");
          setLoading(false);
        }
      };

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
        <div className="mb-10 text-center md:text-left">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-semibold transition-colors duration-200 mb-4"
          >
            ← Volver al Dashboard
          </Link>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-300">
            Prueba de Scraper LinkedIn Jobs
          </h1>
          <p className="text-slate-400 mt-2 max-w-2xl text-sm md:text-base">
            Consumí el Actor de Apify <code className="text-slate-200 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">Dr_Linkedln_Scrappy</code> (vacantes estructuradas, no posts) para evaluar si conviene como alternativa a JobSpy.
          </p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 md:p-8 shadow-2xl mb-12">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Título (jobTitle)</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Ubicación</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Modalidad</label>
              <select
                value={workSchedule}
                onChange={(e) => setWorkSchedule(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
              >
                {WORK_SCHEDULES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Seniority</label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
              >
                {EXPERIENCE_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Tipo de empleo</label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
              >
                {JOB_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Publicado</label>
              <select
                value={jobPostingTime}
                onChange={(e) => setJobPostingTime(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
              >
                {JOB_POSTING_TIMES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Empresas (opcional, separadas por coma)</label>
              <input
                type="text"
                value={companyNamesInput}
                onChange={(e) => setCompanyNamesInput(e.target.value)}
                placeholder="Mercado Libre, Globant"
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Máx. resultados</label>
              <input
                type="number"
                min="1"
                max="100"
                value={maxJobs}
                onChange={(e) => setMaxJobs(Number(e.target.value))}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[46px] px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-white rounded-xl shadow-lg active:scale-95 transition-all duration-200"
              >
                {loading ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </form>

          <p className="text-[11px] text-slate-500 mt-4">
            "Publicado" ya está confirmado contra el actor (400 de validación). Modalidad/Seniority/Tipo siguen siendo una estimación basada en los filtros estándar de LinkedIn — si alguno no matchea, el actor debería devolver el mismo error 400 con los valores permitidos.
          </p>

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

        <div>
          <h2 className="text-xl font-bold text-slate-200 mb-6 flex items-center gap-2">
            <span>Vacantes encontradas</span>
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
                  <div className="h-3 bg-slate-700 rounded w-2/3 mb-3" />
                  <div className="h-2 bg-slate-700 rounded w-1/2 mb-2" />
                  <div className="h-2 bg-slate-700 rounded w-1/3" />
                </div>
              ))}
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="bg-slate-800/20 border border-slate-850 rounded-2xl p-12 text-center text-slate-500 max-w-md mx-auto">
              <span className="text-4xl block mb-3">🔍</span>
              <p className="font-semibold text-slate-400">Sin resultados aún</p>
              <p className="text-xs mt-1 text-slate-500">Ejecutá una búsqueda para ver las vacantes acá.</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((job, idx) => (
                <JobCard key={job.jobUrl ?? idx} job={job} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JobCard({ job }: { job: LinkedInJob }) {
  const rawDate = job.postedTime || job.publishedAt;
  const displayDate = rawDate
    ? new Date(rawDate).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
    : "Sin fecha";

  return (
    <div className="bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/40 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between group shadow-lg">
      <div>
        <h3 className="font-bold text-slate-100 text-sm mb-1">{job.title || "Sin título"}</h3>
        <p className="text-xs text-indigo-300 mb-2">
          {job.companyUrl ? (
            <a href={job.companyUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {job.companyName || "Empresa desconocida"}
            </a>
          ) : (
            job.companyName || "Empresa desconocida"
          )}
        </p>
        <p className="text-xs text-slate-400">{job.location || "Ubicación no especificada"}</p>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700/40 flex flex-col gap-3">
        <span className="text-xs text-slate-500">{displayDate}</span>
        <a
          href={job.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-center bg-slate-900/60 hover:bg-indigo-600/80 border border-slate-700 group-hover:border-indigo-500/50 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-all duration-200 block"
        >
          Ver vacante en LinkedIn ↗
        </a>
      </div>
    </div>
  );
}

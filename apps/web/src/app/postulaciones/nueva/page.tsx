"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  saveApplication,
  STATUS_LABELS,
  type AppStatus,
} from "@/lib/applications";

const STATUS_ORDER: AppStatus[] = [
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "ghosted",
];

const formatAmount = (val: string) => {
  if (!val) return "";
  const numeric = val.replace(/\D/g, "");
  return new Intl.NumberFormat("es-AR").format(Number(numeric));
};

const parseAmount = (val: string) => val.replace(/\D/g, "");

const getLocalDatetime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const inputCls =
  "w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all";

const selectCls =
  "w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all";

const labelCls = "text-sm font-medium text-gray-700 dark:text-gray-300";

function NuevaPostulacionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    company: "",
    location: "",
    applyUrl: "",
    appliedAt: getLocalDatetime(),
    status: "applied" as AppStatus,
    salaryExpectation: "",
    currency: "USD",
    recruiterName: "",
    recruiterLinkedin: "",
    contactType: "self_initiated" as "self_initiated" | "recruiter_initiated",
    notes: "",
    jobId: undefined as string | undefined,
  });

  useEffect(() => {
    const title = searchParams.get("title");
    const company = searchParams.get("company");
    const jobId = searchParams.get("job_id");
    const loc = searchParams.get("location");
    const url = searchParams.get("url");

    if (title || company || url || loc || jobId) {
      setFormData(prev => ({
        ...prev,
        title: title || prev.title,
        company: company || prev.company,
        applyUrl: url || prev.applyUrl,
        location: loc || prev.location,
        jobId: jobId || prev.jobId,
      }));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await saveApplication({
        ...formData,
        salaryExpectation: formData.salaryExpectation
          ? parseInt(parseAmount(formData.salaryExpectation))
          : undefined,
        appliedAt: new Date(formData.appliedAt).toISOString(),
      });
      router.push("/postulaciones");
    } catch (error) {
      console.error("Error saving application:", error);
      alert("Error al guardar la postulación");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <Link
            href="/postulaciones"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-1 mb-4 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Volver a postulaciones
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Nueva Postulación</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Registrá manualmente una postulación que no provenga de las vacantes sugeridas.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="space-y-2">
              <label htmlFor="title" className={labelCls}>Puesto *</label>
              <input type="text" id="title" name="title" required
                value={formData.title} onChange={handleChange}
                placeholder="Ej: Senior Frontend Developer"
                className={inputCls} />
            </div>

            <div className="space-y-2">
              <label htmlFor="company" className={labelCls}>Empresa *</label>
              <input type="text" id="company" name="company" required
                value={formData.company} onChange={handleChange}
                placeholder="Ej: Google"
                className={inputCls} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="applyUrl" className={labelCls}>URL del aviso / LinkedIn</label>
              <input type="url" id="applyUrl" name="applyUrl"
                value={formData.applyUrl} onChange={handleChange}
                placeholder="https://..."
                className={inputCls} />
            </div>

            <div className="space-y-2">
              <label htmlFor="appliedAt" className={labelCls}>Fecha y hora de postulación</label>
              <input type="datetime-local" id="appliedAt" name="appliedAt" required
                value={formData.appliedAt} onChange={handleChange}
                className={inputCls} />
            </div>

            <div className="space-y-2">
              <label htmlFor="status" className={labelCls}>Estado inicial</label>
              <select id="status" name="status"
                value={formData.status} onChange={handleChange}
                className={selectCls}>
                {STATUS_ORDER.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="recruiterName" className={labelCls}>Recruiter</label>
              <input type="text" id="recruiterName" name="recruiterName"
                value={formData.recruiterName} onChange={handleChange}
                placeholder="Nombre del contacto"
                className={inputCls} />
            </div>

            <div className="space-y-2">
              <label htmlFor="recruiterLinkedin" className={labelCls}>LinkedIn del Recruiter</label>
              <input type="url" id="recruiterLinkedin" name="recruiterLinkedin"
                value={formData.recruiterLinkedin} onChange={handleChange}
                placeholder="https://linkedin.com/in/..."
                className={inputCls} />
            </div>

            <div className="space-y-2">
              <label htmlFor="contactType" className={labelCls}>Tipo de contacto</label>
              <select id="contactType" name="contactType"
                value={formData.contactType} onChange={handleChange}
                className={selectCls}>
                <option value="self_initiated">Por mi parte</option>
                <option value="recruiter_initiated">Me contactó el recruiter</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="salaryExpectation" className={labelCls}>Sueldo pretendido</label>
              <div className="relative rounded-lg overflow-hidden">
                <div className="absolute inset-y-0 left-0 flex items-center px-3 border-r border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 pointer-events-none">
                  <span className="text-gray-500 dark:text-gray-300 text-[10px] font-bold">
                    {formData.currency === "ARS" ? "$AR" : formData.currency === "USD" ? "U$S" : "€"}
                  </span>
                </div>
                <input type="text" id="salaryExpectation" name="salaryExpectation"
                  inputMode="numeric"
                  value={formData.salaryExpectation}
                  onChange={e => setFormData(prev => ({ ...prev, salaryExpectation: formatAmount(e.target.value) }))}
                  placeholder="0"
                  className={`${inputCls} pl-16`} />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="currency" className={labelCls}>Moneda</label>
              <select id="currency" name="currency"
                value={formData.currency} onChange={handleChange}
                className={selectCls}>
                <option value="USD">USD - Dólares</option>
                <option value="ARS">ARS - Pesos Argentinos</option>
                <option value="EUR">EUR - Euros</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="notes" className={labelCls}>Notas adicionales</label>
              <textarea id="notes" name="notes" rows={3}
                value={formData.notes} onChange={handleChange}
                placeholder="Detalles sobre el proceso, feedback, etc."
                className={inputCls} />
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Guardando..." : "Guardar postulación"}
            </button>
            <Link
              href="/postulaciones"
              className="px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NuevaPostulacionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center text-gray-500 dark:text-gray-400">
        Cargando formulario...
      </div>
    }>
      <NuevaPostulacionContent />
    </Suspense>
  );
}

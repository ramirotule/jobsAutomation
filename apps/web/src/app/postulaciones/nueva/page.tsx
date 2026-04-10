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

const parseAmount = (val: string) => {
  return val.replace(/\D/g, "");
};

const getLocalDatetime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

function NuevaPostulacionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    company: "",
    location: "",
    applyUrl: "",
    appliedAt: getLocalDatetime(), // Local datetime
    status: "applied" as AppStatus,
    salaryExpectation: "",
    currency: "USD",
    recruiterName: "",
    recruiterLinkedin: "",
    contactType: "self_initiated" as "self_initiated" | "recruiter_initiated",
    notes: "",
  });

  useEffect(() => {
    const title = searchParams.get("title");
    const company = searchParams.get("company");
    const url = searchParams.get("url");
    const loc = searchParams.get("location");

    if (title || company || url || loc) {
      setFormData(prev => ({
        ...prev,
        title: title || prev.title,
        company: company || prev.company,
        applyUrl: url || prev.applyUrl,
        location: loc || prev.location,
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
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <Link
            href="/postulaciones"
            className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 mb-4"
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
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Volver a postulaciones
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            Nueva Postulación
          </h1>
          <p className="text-gray-500 mt-2">
            Registrá manualmente una postulación que no provenga de las vacantes
            sugeridas.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label
                htmlFor="title"
                className="text-sm font-medium text-gray-700"
              >
                Puesto *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                placeholder="Ej: Senior Frontend Developer"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="company"
                className="text-sm font-medium text-gray-700"
              >
                Empresa *
              </label>
              <input
                type="text"
                id="company"
                name="company"
                required
                value={formData.company}
                onChange={handleChange}
                placeholder="Ej: Google"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label
                htmlFor="applyUrl"
                className="text-sm font-medium text-gray-700"
              >
                URL del aviso / LinkedIn
              </label>
              <input
                type="url"
                id="applyUrl"
                name="applyUrl"
                value={formData.applyUrl}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="appliedAt"
                className="text-sm font-medium text-gray-700"
              >
                Fecha y hora de postulación
              </label>
              <input
                type="datetime-local"
                id="appliedAt"
                name="appliedAt"
                required
                value={formData.appliedAt}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="status"
                className="text-sm font-medium text-gray-700"
              >
                Estado inicial
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="recruiterName"
                className="text-sm font-medium text-gray-700"
              >
                Recruiter
              </label>
              <input
                type="text"
                id="recruiterName"
                name="recruiterName"
                value={formData.recruiterName}
                onChange={handleChange}
                placeholder="Nombre del contacto"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="recruiterLinkedin"
                className="text-sm font-medium text-gray-700"
              >
                LinkedIn del Recruiter
              </label>
              <input
                type="url"
                id="recruiterLinkedin"
                name="recruiterLinkedin"
                value={formData.recruiterLinkedin}
                onChange={handleChange}
                placeholder="https://linkedin.com/in/..."
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="contactType"
                className="text-sm font-medium text-gray-700"
              >
                Tipo de contacto
              </label>
              <select
                id="contactType"
                name="contactType"
                value={formData.contactType}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
              >
                <option value="self_initiated">Por mi parte</option>
                <option value="recruiter_initiated">
                  Me contactó el recruiter
                </option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="salaryExpectation"
                className="text-sm font-medium text-gray-700"
              >
                Sueldo pretendido
              </label>
              <div className="relative shadow-sm rounded-lg overflow-hidden">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none bg-gray-50 border-r border-gray-200 px-2.5">
                  <span className="text-gray-500 text-[10px] font-bold">
                    {formData.currency === "ARS"
                      ? "$AR"
                      : formData.currency === "USD"
                        ? "U$S"
                        : "€"}
                  </span>
                </div>
                <input
                  type="text"
                  id="salaryExpectation"
                  name="salaryExpectation"
                  inputMode="numeric"
                  value={formData.salaryExpectation}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      salaryExpectation: formatAmount(e.target.value),
                    }));
                  }}
                  placeholder="0"
                  className="w-full pl-16 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="currency"
                className="text-sm font-medium text-gray-700"
              >
                Moneda
              </label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
              >
                <option value="USD">USD - Dólares</option>
                <option value="ARS">ARS - Pesos Argentinos</option>
                <option value="EUR">EUR - Euros</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label
                htmlFor="notes"
                className="text-sm font-medium text-gray-700"
              >
                Notas adicionales
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Detalles sobre el proceso, feedback, etc."
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Guardando..." : "Guardar postulación"}
            </button>
            <Link
              href="/postulaciones"
              className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
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
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando formulario...</div>}>
      <NuevaPostulacionContent />
    </Suspense>
  );
}

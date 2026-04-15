"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getApplication,
  updateApplication,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/applications";
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

const formatAmount = (val: string) => {
  if (!val) return "";
  const numeric = val.replace(/\D/g, "");
  return new Intl.NumberFormat("es-AR").format(Number(numeric));
};

const parseAmount = (val: string) => {
  return val.replace(/\D/g, "");
};

const STATUS_DESCRIPTIONS: Record<AppStatus, string> = {
  applied: "Postulación enviada, esperando respuesta",
  screening: "En proceso de revisión inicial / HR",
  interview: "Entrevista agendada o en curso",
  offer: "Oferta recibida",
  rejected: "Candidatura rechazada",
  ghosted: "Sin respuesta tras seguimiento",
  ignored: "Postulación ignorada",
};

export default function PostulacionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [app, setApp] = useState<StoredApplication | null>(null);
  const [saved, setSaved] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    applyUrl: "",
    appliedAt: "",
    status: "applied" as AppStatus,
    salaryExpectation: "",
    salaryOffered: "",
    currency: "USD",
    benefits: "",
    notes: "",
    recruiterName: "",
    recruiterLinkedin: "",
    contactType: "self_initiated" as "self_initiated" | "recruiter_initiated",
    interviewAt: "",
  });

  useEffect(() => {
    getApplication(id).then((data) => {
      if (!data) {
        router.push("/postulaciones");
        return;
      }
      setApp(data);
      setForm({
        title: data.title,
        company: data.company,
        location: data.location ?? "",
        applyUrl: data.applyUrl ?? "",
        appliedAt: data.appliedAt
          ? new Date(data.appliedAt).toISOString().slice(0, 16)
          : "",
        status: data.status,
        salaryExpectation: data.salaryExpectation ? formatAmount(data.salaryExpectation.toString()) : "",
        salaryOffered: data.salaryOffered ? formatAmount(data.salaryOffered.toString()) : "",
        currency: data.currency ?? "USD",
        benefits: data.benefits ?? "",
        notes: data.notes ?? "",
        recruiterName: data.recruiterName ?? "",
        recruiterLinkedin: data.recruiterLinkedin ?? "",
        contactType: data.contactType ?? "self_initiated",
        interviewAt: data.interviewAt
          ? new Date(data.interviewAt).toISOString().slice(0, 16)
          : "",
      });
    });
  }, [id, router]);

  const handleSave = async (updates: Partial<typeof form> = {}) => {
    const finalForm = { ...form, ...updates };
    await updateApplication(id, {
      title: finalForm.title,
      company: finalForm.company,
      location: finalForm.location || undefined,
      applyUrl: finalForm.applyUrl || undefined,
      appliedAt: finalForm.appliedAt
        ? new Date(finalForm.appliedAt).toISOString()
        : undefined,
      status: finalForm.status,
      salaryExpectation: finalForm.salaryExpectation
        ? Number(parseAmount(finalForm.salaryExpectation))
        : undefined,
      salaryOffered: finalForm.salaryOffered
        ? Number(parseAmount(finalForm.salaryOffered))
        : undefined,
      currency: finalForm.currency,
      benefits: finalForm.benefits || undefined,
      notes: finalForm.notes || undefined,
      recruiterName: finalForm.recruiterName || undefined,
      recruiterLinkedin: finalForm.recruiterLinkedin || undefined,
      contactType: finalForm.contactType,
      interviewAt: finalForm.interviewAt
        ? new Date(finalForm.interviewAt).toISOString()
        : undefined,
    });
    setApp((prev) =>
      prev
        ? {
            ...prev,
            status: finalForm.status,
            title: finalForm.title,
            company: finalForm.company,
            appliedAt: finalForm.appliedAt
              ? new Date(finalForm.appliedAt).toISOString()
              : prev.appliedAt,
            interviewAt: finalForm.interviewAt
              ? new Date(finalForm.interviewAt).toISOString()
              : prev.interviewAt,
          }
        : prev,
    );
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.push("/postulaciones");
    }, 1500);
  };

  const set = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "status" && value === "interview") {
      setShowInterviewModal(true);
    }
  };

  if (!app) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {showInterviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              🗓️ Programar Entrevista
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Seleccioná la fecha y hora para agendar la entrevista con{" "}
              {form.company}.
            </p>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase">
                  Fecha y Hora
                </label>
                <input
                  type="datetime-local"
                  value={form.interviewAt}
                  onChange={(e) => set("interviewAt", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                />
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setShowInterviewModal(false);
                  }}
                  className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition-colors shadow-md"
                >
                  Confirmar Horario
                </button>
                <button
                  onClick={() => setShowInterviewModal(false)}
                  className="w-full text-gray-500 text-sm py-2 hover:text-gray-700 transition-colors"
                >
                  Omitir por ahora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/postulaciones"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          ← Volver a postulaciones
        </Link>

        {/* Header / Basic Info */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Información de la Vacante
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Puesto</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-semibold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Empresa</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Ubicación</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">
                Fecha de postulación
              </label>
              <input
                type="datetime-local"
                value={form.appliedAt}
                onChange={(e) => set("appliedAt", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs text-gray-500">URL del aviso</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={form.applyUrl}
                  onChange={(e) => set("applyUrl", e.target.value)}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
                {form.applyUrl && (
                  <a
                    href={form.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-sm border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Interview Schedule (New Section) */}
        {app.status === "interview" && (
          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-6 mb-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <span className="text-sm">🗓️</span> Entrevista Programada
                </h2>
                {form.interviewAt ? (
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-purple-900">
                      {new Date(form.interviewAt).toLocaleDateString("es-AR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                    <p className="text-sm text-purple-700">
                      A las{" "}
                      {new Date(form.interviewAt).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      hs
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-purple-600 italic">
                    No hay fecha definida todavía.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowInterviewModal(true)}
                  className="text-xs bg-white text-purple-700 px-3 py-1.5 rounded-lg border border-purple-200 font-bold hover:bg-purple-100 transition-colors shadow-sm"
                >
                  Editar fecha
                </button>
                {form.interviewAt && (
                  <a
                    href={`https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Entrevista: ${form.title} @ ${form.company}`)}&dates=${new Date(form.interviewAt).toISOString().replace(/-|:|\.\d+/g, "")}/${new Date(new Date(form.interviewAt).getTime() + 60 * 60 * 1000).toISOString().replace(/-|:|\.\d+/g, "")}&details=${encodeURIComponent(`Entrevista técnica/hr para el puesto de ${form.title}.\nEmpresa: ${form.company}`)}&location=${encodeURIComponent(form.company)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] bg-white text-blue-600 px-3 py-1.5 rounded-lg border border-blue-100 font-bold hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-1"
                  >
                    <span>➕ Google Cal</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recruiter & Contact */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Contacto
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">
                Recruiter / Contacto
              </label>
              <input
                type="text"
                value={form.recruiterName}
                onChange={(e) => set("recruiterName", e.target.value)}
                placeholder="Nombre del contacto"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">
                LinkedIn del Recruiter
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={form.recruiterLinkedin}
                  onChange={(e) => set("recruiterLinkedin", e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
                {form.recruiterLinkedin && (
                  <a
                    href={form.recruiterLinkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-sm border border-gray-200 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    in
                  </a>
                )}
              </div>
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs text-gray-500">
                Origen del contacto
              </label>
              <select
                value={form.contactType}
                onChange={(e) => set("contactType", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
              >
                <option value="self_initiated">Por mi parte</option>
                <option value="recruiter_initiated">
                  Me contactó el recruiter
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Estado del Proceso
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => set("status", s)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  form.status === s
                    ? "border-gray-900 bg-gray-900 text-white shadow-md"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <p
                  className={`text-xs font-semibold ${form.status === s ? "text-white" : "text-gray-900"}`}
                >
                  {STATUS_LABELS[s]}
                </p>
                <p
                  className={`text-[10px] mt-0.5 leading-tight ${form.status === s ? "text-gray-300" : "text-gray-400"}`}
                >
                  {STATUS_DESCRIPTIONS[s]}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Salary */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Compensación
          </h2>

          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-2 block">Moneda</label>
            <div className="flex gap-2">
              {["USD", "ARS", "EUR"].map((c) => (
                <button
                  key={c}
                  onClick={() => set("currency", c)}
                  className={`text-sm px-4 py-1.5 rounded-lg border transition-colors ${
                    form.currency === c
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 mb-1 block">
                Sueldo pretendido ({form.currency}/mes)
              </label>
              <div className="relative shadow-sm rounded-lg overflow-hidden">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none bg-gray-50 border-r border-gray-200 px-2.5">
                  <span className="text-gray-500 text-[10px] font-bold">
                    {form.currency === "ARS"
                      ? "$AR"
                      : form.currency === "USD"
                        ? "U$S"
                        : "€"}
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.salaryExpectation}
                  onChange={(e) => {
                    set("salaryExpectation", formatAmount(e.target.value));
                  }}
                  placeholder="Ingrese el monto..."
                  className="w-full text-sm border border-gray-200 rounded-lg pl-16 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 mb-1 block">
                Salario ofrecido ({form.currency}/mes)
              </label>
              <div className="relative shadow-sm rounded-lg overflow-hidden">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none bg-gray-50 border-r border-gray-200 px-2.5">
                  <span className="text-gray-500 text-[10px] font-bold">
                    {form.currency === "ARS"
                      ? "$AR"
                      : form.currency === "USD"
                        ? "U$S"
                        : "€"}
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.salaryOffered}
                  onChange={(e) => {
                    set("salaryOffered", formatAmount(e.target.value));
                  }}
                  placeholder="Ingrese el monto..."
                  className="w-full text-sm border border-gray-200 rounded-lg pl-16 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Benefits & Notes (keep same as before but styled a bit more) */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Beneficios
          </h2>
          <textarea
            value={form.benefits}
            onChange={(e) => set("benefits", e.target.value)}
            rows={3}
            placeholder="ej: OSDE 410, bono anual, días extra, equipamiento, budget de capacitación..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Bitácora del Proceso
          </h2>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={8}
            placeholder={`# Entrevista 1 — ${new Date().toLocaleDateString("es-AR")}\n\nEntrevistador:\nStack técnico:\nPreguntas:\n\nSensación general:\nPróximos pasos:`}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono whitespace-pre-wrap"
          />
        </div>

        {/* Save */}
        <div className="sticky bottom-6 flex items-center justify-between bg-white/80 backdrop-blur-md border border-gray-200 p-4 rounded-2xl shadow-lg">
          <Link
            href="/postulaciones"
            className="text-sm text-gray-500 hover:text-gray-900 px-2 transition-colors"
          >
            Cerrar
          </Link>
          <button
            onClick={() => handleSave()}
            className={`text-sm font-semibold px-8 py-2.5 rounded-xl transition-all ${
              saved
                ? "bg-green-600 text-white"
                : "bg-gray-900 text-white hover:bg-gray-800"
            } shadow-sm active:scale-95`}
          >
            {saved ? "Cambios guardados ✓" : "Guardar todo"}
          </button>
        </div>
      </div>
    </div>
  );
}

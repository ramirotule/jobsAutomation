"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Seniority, Modality } from "@/types";

const PROFILE_ID = process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID ?? "";

interface ProfileForm {
  title: string;
  seniority: Seniority;
  primary_skills: string;
  secondary_skills: string;
  target_roles: string;
  preferred_modality: Modality;
  location: string;
  years_experience: number;
  min_score_threshold: number;
  alert_score_threshold: number;
}

const DEFAULT_FORM: ProfileForm = {
  title: "Senior Frontend Developer",
  seniority: "senior",
  primary_skills: "React, React Native, TypeScript, JavaScript, Next.js",
  secondary_skills: "Redux, GraphQL, Tailwind, Firebase, Node.js, MUI, Expo",
  target_roles:
    "Frontend Developer, Senior Frontend Developer, React Developer, React Native Developer",
  preferred_modality: "remote",
  location: "Santa Rosa, La Pampa, Argentina",
  years_experience: 5,
  min_score_threshold: 60,
  alert_score_threshold: 75,
};

export default function PerfilPage() {
  const [form, setForm] = useState<ProfileForm>(DEFAULT_FORM);
  const [cvText, setCvText] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingCv, setSavingCv] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savedCv, setSavedCv] = useState(false);
  const [activeTab, setActiveTab] = useState<"perfil" | "cv" | "kit">("perfil");
  const [coverLang, setCoverLang] = useState<"es" | "en">("es");
  const [coverES, setCoverES] = useState("");
  const [coverEN, setCoverEN] = useState("");
  
  const [dmLang, setDMLang] = useState<"es" | "en">("es");
  const [dmES, setDmES] = useState("");
  const [dmEN, setDmEN] = useState("");

  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setCoverES(localStorage.getItem("job_hunter_cover_es") ?? COVER_ES);
    setCoverEN(localStorage.getItem("job_hunter_cover_en") ?? COVER_EN);
    setDmES(localStorage.getItem("job_hunter_dm_es") ?? DM_ES);
    setDmEN(localStorage.getItem("job_hunter_dm_en") ?? DM_EN);
  }, []);

  const coverLetter = coverLang === "es" ? coverES : coverEN;
  const setCoverLetter = coverLang === "es" ? setCoverES : setCoverEN;

  const directMessage = dmLang === "es" ? dmES : dmEN;
  const setDirectMessage = dmLang === "es" ? setDmES : setDmEN;

  function saveCoverLetter() {
    localStorage.setItem(`job_hunter_cover_${coverLang}`, coverLetter);
    setCopied("saved");
    setTimeout(() => setCopied(null), 2000);
  }

  function saveDirectMessage() {
    localStorage.setItem(`job_hunter_dm_${dmLang}`, directMessage);
    setCopied("saved_dm");
    setTimeout(() => setCopied(null), 2000);
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function copyCoverAsHTML(text: string, key: string) {
    const html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .split('\n')
      .map(line => {
        // Convert URLs to hyperlinks
        const linked = line.replace(
          /(https?:\/\/[^\s]+)/g,
          '<a href="$1">$1</a>',
        )
        return linked
      })
      .join('<br>\n')

    const htmlBlob  = new Blob([`<div style="font-family:sans-serif;font-size:14px;line-height:1.7">${html}</div>`], { type: 'text/html' })
    const plainBlob = new Blob([text], { type: 'text/plain' })

    navigator.clipboard
      .write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': plainBlob })])
      .catch(() => navigator.clipboard.writeText(text)) // fallback
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  useEffect(() => {
    loadProfile();
    loadCv();
  }, []);

  async function loadProfile() {
    if (!PROFILE_ID || PROFILE_ID === "uuid-del-search-profile") return;
    const { data } = await supabase
      .from("search_profiles")
      .select("*")
      .eq("id", PROFILE_ID)
      .single();

    if (data) {
      setForm({
        title: data.title ?? "",
        seniority: data.seniority ?? "senior",
        primary_skills: (data.primary_skills ?? []).join(", "),
        secondary_skills: (data.secondary_skills ?? []).join(", "),
        target_roles: (data.target_roles ?? []).join(", "),
        preferred_modality: data.preferred_modality ?? "remote",
        location: data.location ?? "",
        years_experience: data.years_experience ?? 0,
        min_score_threshold: data.min_score_threshold ?? 60,
        alert_score_threshold: data.alert_score_threshold ?? 75,
      });
    }
  }

  async function loadCv() {
    if (!PROFILE_ID || PROFILE_ID === "uuid-del-search-profile") return;
    const { data } = await supabase
      .from("resumes")
      .select("raw_text")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data?.raw_text) setCvText(data.raw_text);
  }

  async function saveProfile() {
    setSaving(true);
    const payload = {
      title: form.title,
      seniority: form.seniority,
      primary_skills: form.primary_skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      secondary_skills: form.secondary_skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      target_roles: form.target_roles
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      preferred_modality: form.preferred_modality,
      location: form.location,
      years_experience: form.years_experience,
      min_score_threshold: form.min_score_threshold,
      alert_score_threshold: form.alert_score_threshold,
      is_active: true,
    };

    if (PROFILE_ID && PROFILE_ID !== "uuid-del-search-profile") {
      await supabase
        .from("search_profiles")
        .update(payload)
        .eq("id", PROFILE_ID);
    } else {
      await supabase.from("search_profiles").insert(payload);
    }

    setSaving(false);
    setSavedProfile(true);
    setTimeout(() => setSavedProfile(false), 3000);
  }

  async function saveCv() {
    setSavingCv(true);
    await supabase
      .from("resumes")
      .update({ is_active: false })
      .eq("is_active", true);
    await supabase
      .from("resumes")
      .insert({ raw_text: cvText, is_active: true });
    setSavingCv(false);
    setSavedCv(true);
    setTimeout(() => setSavedCv(false), 3000);
  }

  const set =
    (key: keyof ProfileForm) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const noProfileId = !PROFILE_ID || PROFILE_ID === "uuid-del-search-profile";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="text-gray-500 text-sm mt-1">
            Criterios de búsqueda y CV para el matching
          </p>
        </div>

        {noProfileId && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>Falta configurar NEXT_PUBLIC_DEFAULT_PROFILE_ID</strong> en
            el archivo <code>.env.local</code>. Creá un perfil en Supabase →
            tabla <code>search_profiles</code> y copiá el UUID generado.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: "perfil", label: "Criterios de búsqueda" },
            { key: "cv", label: "Mi CV" },
            { key: "kit", label: "Kit de postulación" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "perfil" | "cv" | "kit")}
              className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "perfil" && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
            <Field label="Título profesional">
              <input
                value={form.title}
                onChange={set("title")}
                className={inputCls}
                placeholder="Senior Frontend Developer"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Seniority">
                <select
                  value={form.seniority}
                  onChange={set("seniority")}
                  className={inputCls}
                >
                  {(
                    ["junior", "mid", "senior", "staff", "lead"] as Seniority[]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Años de experiencia">
                <input
                  type="number"
                  value={form.years_experience}
                  onChange={set("years_experience")}
                  className={inputCls}
                  min={0}
                  max={30}
                />
              </Field>
            </div>

            <Field label="Skills primarios" hint="Separados por coma">
              <textarea
                value={form.primary_skills}
                onChange={set("primary_skills")}
                rows={2}
                className={inputCls}
                placeholder="React, TypeScript, React Native, Next.js"
              />
            </Field>

            <Field label="Skills secundarios" hint="Separados por coma">
              <textarea
                value={form.secondary_skills}
                onChange={set("secondary_skills")}
                rows={2}
                className={inputCls}
                placeholder="Redux, GraphQL, Tailwind, Firebase"
              />
            </Field>

            <Field label="Roles target" hint="Separados por coma">
              <textarea
                value={form.target_roles}
                onChange={set("target_roles")}
                rows={2}
                className={inputCls}
                placeholder="Frontend Developer, React Developer, React Native Developer"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Modalidad preferida">
                <select
                  value={form.preferred_modality}
                  onChange={set("preferred_modality")}
                  className={inputCls}
                >
                  {(["remote", "hybrid", "onsite"] as Modality[]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ubicación">
                <input
                  value={form.location}
                  onChange={set("location")}
                  className={inputCls}
                  placeholder="Santa Rosa, La Pampa, Argentina"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Score mínimo para guardar" hint="0–100">
                <input
                  type="number"
                  value={form.min_score_threshold}
                  onChange={set("min_score_threshold")}
                  className={inputCls}
                  min={0}
                  max={100}
                />
              </Field>
              <Field label="Score mínimo para alerta" hint="0–100">
                <input
                  type="number"
                  value={form.alert_score_threshold}
                  onChange={set("alert_score_threshold")}
                  className={inputCls}
                  min={0}
                  max={100}
                />
              </Field>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Guardando..." : "Guardar perfil"}
              </button>
              {savedProfile && (
                <span className="text-sm text-green-600 font-medium">
                  ✓ Guardado
                </span>
              )}
            </div>
          </div>
        )}

        {activeTab === "cv" && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Pegá el texto de tu CV. Se usa para el contexto de matching y
              puede usarse en el futuro para parseo automático de skills.
            </p>
            <textarea
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              rows={20}
              className={`${inputCls} font-mono text-xs`}
              placeholder="Pegá aquí el texto completo de tu CV..."
            />
            <div className="flex items-center gap-3">
              <button
                onClick={saveCv}
                disabled={savingCv || !cvText.trim()}
                className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {savingCv ? "Guardando..." : "Guardar CV"}
              </button>
              {cvText && (
                <span className="text-xs text-gray-400">
                  {cvText.length.toLocaleString()} caracteres
                </span>
              )}
              {savedCv && (
                <span className="text-sm text-green-600 font-medium">
                  ✓ CV guardado
                </span>
              )}
            </div>
          </div>
        )}

        {activeTab === "kit" && (
          <div className="space-y-4">
            {/* Links */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Mis redes y portfolio
              </h2>
              <div className="space-y-3">
                {LINKS.map((link) => (
                  <div
                    key={link.key}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-lg">{link.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 font-medium">
                        {link.label}
                      </p>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline truncate block"
                      >
                        {link.display}
                      </a>
                    </div>
                    <button
                      onClick={() => copyToClipboard(link.url, link.key)}
                      className="shrink-0 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {copied === link.key ? "✓ Copiado" : "Copiar"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cover Letter */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-700">
                    Cover Letter
                  </h2>
                  <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                    {(["es", "en"] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setCoverLang(lang)}
                        className={`text-xs px-3 py-1 font-medium transition-colors ${
                          coverLang === lang
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {lang === "es" ? "🇦🇷 Español" : "🇺🇸 English"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyCoverAsHTML(coverLetter, "cover")}
                    className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {copied === "cover" ? "✓ Copiado" : "Copiar"}
                  </button>
                  <button
                    onClick={saveCoverLetter}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {copied === "saved" ? "✓ Guardado" : "Guardar"}
                  </button>
                </div>
              </div>
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={16}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
              />
            </div>

            {/* Direct Message */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-700">
                    Direct Message
                  </h2>
                  <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                    {(["es", "en"] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setDMLang(lang)}
                        className={`text-xs px-3 py-1 font-medium transition-colors ${
                          dmLang === lang
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {lang === "es" ? "🇦🇷 Español" : "🇺🇸 English"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(directMessage, "dm")}
                    className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {copied === "dm" ? "✓ Copiado" : "Copiar"}
                  </button>
                  <button
                    onClick={saveDirectMessage}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {copied === "saved_dm" ? "✓ Guardado" : "Guardar"}
                  </button>
                </div>
              </div>
              <textarea
                value={directMessage}
                onChange={(e) => setDirectMessage(e.target.value)}
                rows={12}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const LINKS = [
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: "💼",
    url: "https://www.linkedin.com/in/ramirotoulemonde",
    display: "linkedin.com/in/ramirotoulemonde",
  },
  {
    key: "github",
    label: "GitHub",
    icon: "🐙",
    url: "https://github.com/ramirotule",
    display: "github.com/ramirotule",
  },
  {
    key: "portfolio",
    label: "Portfolio",
    icon: "🌐",
    url: "https://www.ramirotoulemonde.com.ar",
    display: "ramirotoulemonde.com.ar",
  },
];

const COVER_ES = `Hola,

Mi nombre es Ramiro Toulemonde, soy desarrollador Frontend Senior con más de 5 años de experiencia construyendo productos web y mobile con React, React Native y TypeScript.

A lo largo de mi carrera he trabajado en proyectos de escala real, colaborando con equipos distribuidos y entregando interfaces robustas, accesibles y performantes. Me apasiona el detalle en la experiencia de usuario y la calidad del código.

Stack principal: React · React Native · TypeScript · Mobx  State Tree · Redux · GraphQL · Tailwind CSS

Stack secundario: Firebase · Google Analytics · MUI · Expo · Vite

Estoy buscando roles remotos como Frontend Developer o React Native Developer, donde pueda aportar experiencia real y seguir creciendo técnicamente.

Portfolio: https://www.ramirotoulemonde.com.ar
LinkedIn: https://www.linkedin.com/in/ramirotoulemonde
GitHub: https://github.com/ramirotule

Quedo a disposición para una llamada o entrevista técnica cuando lo consideren conveniente.

Saludos,
Ramiro Toulemonde`;

const COVER_EN = `Hi,

My name is Ramiro Toulemonde. I'm a Senior Frontend Developer with 5+ years of experience building web and mobile products using React, React Native, and TypeScript.

Throughout my career I've worked on real-scale projects alongside distributed teams, delivering robust, accessible, and performant interfaces. I care deeply about user experience and code quality.

Core stack: React · React Native · TypeScript · Mobx  State Tree · Redux · GraphQL · Tailwind CSS

Supporting stack: Firebase · Google Analytics · MUI · Expo · Vite

I'm looking for remote roles as a Frontend Developer or React Native Developer, where I can bring real experience and continue growing technically.

Portfolio: https://www.ramirotoulemonde.com.ar
LinkedIn: https://www.linkedin.com/in/ramirotoulemonde
GitHub: https://github.com/ramirotule

I'm available for a call or technical interview at your convenience.

Best regards,
Ramiro Toulemonde`;

const DM_ES = `Hola [Nombre]!

Espero que estés muy bien. Te escribo porque actualmente estoy buscando nuevos desafíos profesionales como Senior Frontend Developer.

Con más de 5 años de experiencia especializándome en React JS y React Native, tengo un historial sólido construyendo aplicaciones web y móviles escalables. Me interesan particularmente aquellos roles donde se valora la calidad del código y las arquitecturas modernas.

Podés ver mi CV, trayectoria y proyectos acá: www.ramirotoulemonde.com.ar

Me encantaría que tengamos una breve llamada para comentar cómo mi experiencia puede sumar a tu equipo.

Saludos,
Ramiro.`;

const DM_EN = `Hi [Name]!

I hope you're doing well. I'm reaching out because I'm currently looking for new professional challenges as a Senior Frontend Developer.

With over 5 years of experience specializing in React JS and React Native, I have a strong track record of building scalable web and mobile applications. I'm particularly interested in roles that value high-quality code and modern architectures.

You can check out my resume, works and projects here: www.ramirotoulemonde.com.ar

I'd love to jump on a quick call to discuss how my background could contribute to your team.

Best regards,
Ramiro.`;

const inputCls =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {hint && (
          <span className="text-xs text-gray-400 font-normal ml-1">
            ({hint})
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

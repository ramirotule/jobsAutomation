"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Seniority, Modality } from "@/types";

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
  primary_skills: "",
  secondary_skills: "",
  target_roles: "",
  preferred_modality: "remote",
  location: "",
  years_experience: 0,
  min_score_threshold: 60,
  alert_score_threshold: 75,
};

export default function PerfilPage() {
  const supabase = createClient();
  const [form, setForm] = useState<ProfileForm>(DEFAULT_FORM);
  const [cvText, setCvText] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingCv, setSavingCv] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savedCv, setSavedCv] = useState(false);
  const [activeTab, setActiveTab] = useState<"perfil" | "cv" | "kit" | "cuenta">("perfil");
  
  // User metadata state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");

  const [coverLang, setCoverLang] = useState<"es" | "en">("en");
  const [coverES, setCoverES] = useState("");
  const [coverEN, setCoverEN] = useState("");

  const [dmLang, setDMLang] = useState<"es" | "en">("en");
  const [dmES, setDmES] = useState("");
  const [dmEN, setDmEN] = useState("");

  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setCoverES(localStorage.getItem("job_hunter_cover_es") ?? COVER_ES);
    setCoverEN(localStorage.getItem("job_hunter_cover_en") ?? COVER_EN);
    setDmES(localStorage.getItem("job_hunter_dm_es") ?? DM_ES);
    setDmEN(localStorage.getItem("job_hunter_dm_en") ?? DM_EN);
  }, []);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserEmail(user.email ?? "");
    setFirstName(user.user_metadata?.first_name ?? "");
    setLastName(user.user_metadata?.last_name ?? "");

    // Load Profile
    const { data: profile } = await supabase
      .from("search_profiles")
      .select("*")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (profile) {
      setForm({
        title: profile.title ?? "",
        seniority: profile.seniority ?? "senior",
        primary_skills: (profile.primary_skills ?? []).join(", "),
        secondary_skills: (profile.secondary_skills ?? []).join(", "),
        target_roles: (profile.target_roles ?? []).join(", "),
        preferred_modality: profile.preferred_modality ?? "remote",
        location: profile.location ?? "",
        years_experience: profile.years_experience ?? 0,
        min_score_threshold: profile.min_score_threshold ?? 60,
        alert_score_threshold: profile.alert_score_threshold ?? 75,
      });
    }

    // Load CV
    const { data: cv } = await supabase
      .from("resumes")
      .select("raw_text")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cv?.raw_text) setCvText(cv.raw_text);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function saveProfile() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      title: form.title,
      seniority: form.seniority,
      primary_skills: form.primary_skills.split(",").map(s => s.trim()).filter(Boolean),
      secondary_skills: form.secondary_skills.split(",").map(s => s.trim()).filter(Boolean),
      target_roles: form.target_roles.split(",").map(s => s.trim()).filter(Boolean),
      preferred_modality: form.preferred_modality,
      location: form.location,
      years_experience: form.years_experience,
      min_score_threshold: form.min_score_threshold,
      alert_score_threshold: form.alert_score_threshold,
      is_active: true,
    };

    const { data: existing } = await supabase
      .from("search_profiles")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase.from("search_profiles").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("search_profiles").insert(payload);
    }

    setSaving(false);
    setSavedProfile(true);
    setTimeout(() => setSavedProfile(false), 3000);
  }

  async function saveCv() {
    setSavingCv(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("resumes").update({ is_active: false }).eq("user_id", user.id);
    await supabase.from("resumes").insert({ user_id: user.id, raw_text: cvText, is_active: true });
    
    setSavingCv(false);
    setSavedCv(true);
    setTimeout(() => setSavedCv(false), 3000);
  }

  async function updateAccount() {
    setSavingAccount(true);
    setAccountMessage("");
    try {
      const updates: any = {
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      };
      
      if (newPassword) {
        updates.password = newPassword;
      }

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      
      setAccountMessage("✓ Información actualizada correctamente");
      setNewPassword("");
      // Opcional: recargar el layout para actualizar el nombre en el sidebar
      window.location.reload();
    } catch (error: any) {
      setAccountMessage("Error: " + error.message);
    } finally {
      setSavingAccount(false);
    }
  }

  const coverLetter = coverLang === "es" ? coverES : coverEN;
  const setCoverLetter = coverLang === "es" ? setCoverES : setCoverEN;
  const directMessage = dmLang === "es" ? dmES : dmEN;
  const setDirectMessage = dmLang === "es" ? setDmES : setDmEN;

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const set = (key: keyof ProfileForm) => (e: any) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="text-gray-500 text-sm mt-1">Configura tu identidad, criterios de búsqueda y CV</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: "cuenta", label: "Mi Cuenta" },
            { key: "perfil", label: "Criterios" },
            { key: "cv", label: "Mi CV" },
            { key: "kit", label: "Kit Postulación" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
                activeTab === tab.key
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "cuenta" && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nombre">
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Apellido">
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Email" hint="No se puede cambiar">
              <input value={userEmail} disabled className={`${inputCls} bg-gray-50 text-gray-400 cursor-not-allowed`} />
            </Field>
            <Field label="Nueva Contraseña" hint="Dejar vacío para no cambiar">
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className={inputCls} 
                placeholder="Mínimo 6 caracteres"
              />
            </Field>

            <div className="pt-2 flex items-center gap-4">
              <button
                onClick={updateAccount}
                disabled={savingAccount}
                className="bg-indigo-600 text-white text-sm px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {savingAccount ? "Guardando..." : "Actualizar Datos"}
              </button>
              {accountMessage && (
                <span className={`text-sm font-medium ${accountMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                  {accountMessage}
                </span>
              )}
            </div>
          </div>
        )}

        {activeTab === "perfil" && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Field label="Título profesional">
              <input value={form.title} onChange={set("title")} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Seniority">
                <select value={form.seniority} onChange={set("seniority")} className={inputCls}>
                  {["junior", "mid", "senior", "staff", "lead"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Años de experiencia">
                <input type="number" value={form.years_experience} onChange={set("years_experience")} className={inputCls} />
              </Field>
            </div>
            <Field label="Skills primarios" hint="Separados por coma">
              <textarea value={form.primary_skills} onChange={set("primary_skills")} rows={2} className={inputCls} />
            </Field>
            <Field label="Skills secundarios" hint="Separados por coma">
              <textarea value={form.secondary_skills} onChange={set("secondary_skills")} rows={2} className={inputCls} />
            </Field>
            <Field label="Roles target" hint="Separados por coma">
              <textarea value={form.target_roles} onChange={set("target_roles")} rows={2} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Modalidad">
                <select value={form.preferred_modality} onChange={set("preferred_modality")} className={inputCls}>
                  {["remote", "hybrid", "onsite"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Ubicación">
                <input value={form.location} onChange={set("location")} className={inputCls} />
              </Field>
            </div>
            <div className="pt-2 flex items-center gap-3">
              <button onClick={saveProfile} disabled={saving} className="bg-indigo-600 text-white text-sm px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all">
                {saving ? "Guardando..." : "Guardar Criterios"}
              </button>
              {savedProfile && <span className="text-sm text-green-600 font-medium">✓ Guardado</span>}
            </div>
          </div>
        )}

        {activeTab === "cv" && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <textarea
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              rows={20}
              className={`${inputCls} font-mono text-xs`}
              placeholder="Pegá aquí el texto completo de tu CV..."
            />
            <div className="flex items-center gap-3">
              <button onClick={saveCv} disabled={savingCv || !cvText.trim()} className="bg-indigo-600 text-white text-sm px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all">
                {savingCv ? "Guardando..." : "Guardar CV"}
              </button>
              {savedCv && <span className="text-sm text-green-600 font-medium">✓ CV guardado</span>}
            </div>
          </div>
        )}

        {activeTab === "kit" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Direct Message */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-700">Mensaje Directo</h2>
                  <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                    {["en", "es"].map((lang) => (
                      <button 
                        key={lang} 
                        onClick={() => setDMLang(lang as any)} 
                        className={`text-xs px-3 py-1 font-medium ${dmLang === lang ? "bg-indigo-600 text-white" : "bg-white text-gray-600"}`}
                      >
                        {lang === "en" ? "🇺🇸" : "🇦🇷"}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => copyToClipboard(directMessage, "dm")} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                  {copied === "dm" ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <textarea
                value={directMessage}
                onChange={(e) => setDirectMessage(e.target.value)}
                rows={10}
                className={`${inputCls} font-mono`}
              />
            </div>
            {/* Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {LINKS.map(link => (
                <div key={link.key} className="bg-white border border-gray-200 p-4 rounded-xl flex flex-col gap-2">
                  <span className="text-xl">{link.icon}</span>
                  <p className="text-xs font-bold text-gray-400 uppercase">{link.label}</p>
                  <button onClick={() => copyToClipboard(link.url, link.key)} className="text-xs text-indigo-600 font-bold hover:underline text-left truncate">
                    {copied === link.key ? "¡Copiado!" : link.display}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
        {label} 
        {hint && <span className="text-[10px] text-slate-300 normal-case font-normal ml-2">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm";

const LINKS = [
  { key: "linkedin", label: "LinkedIn", icon: "💼", url: "https://www.linkedin.com/in/ramirotoulemonde", display: "linkedin.com/in/ramirotoulemonde" },
  { key: "github", label: "GitHub", icon: "🐙", url: "https://github.com/ramirotule", display: "github.com/ramirotule" },
  { key: "portfolio", label: "Portfolio", icon: "🌐", url: "https://www.ramirotoulemonde.com.ar", display: "ramirotoulemonde.com.ar" },
];

const COVER_ES = `Hola,

Mi nombre es Ramiro Toulemonde, soy desarrollador Frontend Senior con más de 5 años de experiencia construyendo productos web y mobile con React, React Native y TypeScript.

A lo largo de mi carrera he trabajado en proyectos de escala real, colaborando con equipos distribuidos y entregando interfaces robustas, accesibles y performantes. Me apasiona el detalle en la experiencia de usuario y la calidad del código.

Stack principal: React · React Native · TypeScript · Mobx State Tree · Redux · GraphQL · Tailwind CSS

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

Core stack: React · React Native · TypeScript · Mobx State Tree · Redux · GraphQL · Tailwind CSS

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

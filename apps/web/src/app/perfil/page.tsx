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
  title: "",
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
  const [savingKit, setSavingKit] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savedCv, setSavedCv] = useState(false);
  const [savedKit, setSavedKit] = useState(false);
  const [activeTab, setActiveTab] = useState<"perfil" | "cv" | "kit" | "cuenta" | "links">("perfil");
  
  // User metadata state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");

  // Links
  const [linkedin_url, setLinkedinUrl] = useState("");
  const [github_url, setGithubUrl] = useState("");
  const [portfolio_url, setPortfolioUrl] = useState("");

  const [coverLang, setCoverLang] = useState<"es" | "en">("en");
  const [coverES, setCoverES] = useState("");
  const [coverEN, setCoverEN] = useState("");

  const [dmLang, setDMLang] = useState<"es" | "en">("en");
  const [dmES, setDmES] = useState("");
  const [dmEN, setDmEN] = useState("");

  const [copied, setCopied] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserEmail(user.email ?? "");
    
    // Load Public Profile (Metadata)
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      setFirstName(profile.first_name ?? "");
      setLastName(profile.last_name ?? "");
      setLinkedinUrl(profile.linkedin_url ?? "");
      setGithubUrl(profile.github_url ?? "");
      setPortfolioUrl(profile.portfolio_url ?? "");
      setCoverES(profile.cover_letter_es ?? "");
      setCoverEN(profile.cover_letter_en ?? "");
      setDmES(profile.dm_es ?? "");
      setDmEN(profile.dm_en ?? "");
    }

    // Load Search Profile
    const { data: searchProfile } = await supabase
      .from("search_profiles")
      .select("*")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (searchProfile) {
      setForm({
        title: searchProfile.title ?? "",
        seniority: searchProfile.seniority ?? "senior",
        primary_skills: (searchProfile.primary_skills ?? []).join(", "),
        secondary_skills: (searchProfile.secondary_skills ?? []).join(", "),
        target_roles: (searchProfile.target_roles ?? []).join(", "),
        preferred_modality: searchProfile.preferred_modality ?? "remote",
        location: searchProfile.location ?? "",
        years_experience: searchProfile.years_experience ?? 0,
        min_score_threshold: searchProfile.min_score_threshold ?? 60,
        alert_score_threshold: searchProfile.alert_score_threshold ?? 75,
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

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

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

    try {
      if (existing) {
        await supabase.from("search_profiles").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("search_profiles").insert(payload);
      }
      showToast("Criterios de búsqueda actualizados");
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveCv() {
    setSavingCv(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase.from("resumes").update({ is_active: false }).eq("user_id", user.id);
      await supabase.from("resumes").insert({ user_id: user.id, raw_text: cvText, is_active: true });
      showToast("CV actualizado correctamente");
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSavingCv(false);
    }
  }

  async function saveKit() {
    setSavingKit(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        linkedin_url,
        github_url,
        portfolio_url,
        cover_letter_es: coverES,
        cover_letter_en: coverEN,
        dm_es: dmES,
        dm_en: dmEN,
      });

    if (error) {
      console.error(error);
      showToast("Error al guardar el kit: " + error.message, 'error');
    } else {
      showToast("Kit de postulación guardado");
    }
    setSavingKit(false);
  }

  async function updateAccount() {
    setSavingAccount(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa");

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({ 
          id: user.id,
          first_name: firstName, 
          last_name: lastName,
          linkedin_url,
          github_url,
          portfolio_url
        });

      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.updateUser({
        data: { first_name: firstName, last_name: lastName }
      });
      if (authError) throw authError;
      
      showToast("Información de cuenta actualizada");
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setSavingAccount(false);
    }
  }

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const coverLetter = coverLang === "es" ? coverES : coverEN;
  const setCoverLetter = (val: string) => coverLang === "es" ? setCoverES(val) : setCoverEN(val);
  const directMessage = dmLang === "es" ? dmES : dmEN;
  const setDirectMessage = (val: string) => dmLang === "es" ? setDmES(val) : setDmEN(val);

  function copyToClipboard(text: string, key: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const set = (key: keyof ProfileForm) => (e: any) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Dynamic Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-white/20 flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-green-600/90 text-white' : 'bg-red-600/90 text-white'
          }`}>
            <span className="text-lg">{toast.type === 'success' ? '✅' : '❌'}</span>
            <span className="text-sm font-bold tracking-tight">{toast.message}</span>
          </div>
        </div>
      )}

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
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="LinkedIn URL">
                <input 
                  type="url"
                  value={linkedin_url} 
                  onChange={(e) => setLinkedinUrl(e.target.value)} 
                  className={inputCls} 
                  placeholder="https://linkedin.com/in/..." 
                  autoComplete="off"
                />
              </Field>
              <Field label="GitHub URL">
                <input 
                  type="url"
                  value={github_url} 
                  onChange={(e) => setGithubUrl(e.target.value)} 
                  className={inputCls} 
                  placeholder="https://github.com/..." 
                  autoComplete="off"
                />
              </Field>
              <Field label="Portfolio URL">
                <input 
                  type="url"
                  value={portfolio_url} 
                  onChange={(e) => setPortfolioUrl(e.target.value)} 
                  className={inputCls} 
                  placeholder="https://..." 
                  autoComplete="off"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <Field label="Email" hint="No se puede cambiar">
                <input value={userEmail} disabled className={`${inputCls} bg-gray-50 text-gray-400 cursor-not-allowed`} />
              </Field>
              <div className="pb-1">
                <button 
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="text-indigo-600 text-sm font-bold flex items-center gap-2 px-4 py-2 hover:bg-indigo-50 rounded-lg transition-all"
                >
                  🔒 Cambiar contraseña
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 pt-6">
              <button
                onClick={updateAccount}
                disabled={savingAccount}
                className="bg-indigo-600 text-white text-sm px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
              >
                {savingAccount ? "Guardando..." : "Actualizar Datos"}
              </button>
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
            <div className="pt-2">
              <button onClick={saveProfile} disabled={saving} className="bg-indigo-600 text-white text-sm px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
                {saving ? "Guardando..." : "Guardar Criterios"}
              </button>
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
            <div className="pt-2">
              <button onClick={saveCv} disabled={savingCv || !cvText.trim()} className="bg-indigo-600 text-white text-sm px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
                {savingCv ? "Guardando..." : "Guardar CV"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "kit" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Quick Links Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <LinkCard 
                icon="💼" 
                label="LinkedIn" 
                url={linkedin_url} 
                isCopied={copied === 'li'} 
                onCopy={() => copyToClipboard(linkedin_url, 'li')} 
              />
              <LinkCard 
                icon="🐙" 
                label="GitHub" 
                url={github_url} 
                isCopied={copied === 'gh'} 
                onCopy={() => copyToClipboard(github_url, 'gh')} 
              />
              <LinkCard 
                icon="🌐" 
                label="Portfolio" 
                url={portfolio_url} 
                isCopied={copied === 'pf'} 
                onCopy={() => copyToClipboard(portfolio_url, 'pf')} 
              />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-700">Mensaje Directo</h2>
                  <LangToggle current={dmLang} onChange={setDMLang} />
                </div>
                <button onClick={() => copyToClipboard(directMessage, "dm")} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                  {copied === "dm" ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <textarea
                value={directMessage}
                onChange={(e) => setDirectMessage(e.target.value)}
                rows={6}
                className={`${inputCls} font-mono`}
                placeholder="Escribe tu mensaje directo..."
              />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-700">Carta de Presentación</h2>
                  <LangToggle current={coverLang} onChange={setCoverLang} />
                </div>
                <button onClick={() => copyToClipboard(coverLetter, "cover")} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                  {copied === "cover" ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={10}
                className={`${inputCls} font-mono`}
                placeholder="Escribe tu carta de presentación..."
              />
            </div>

            <div className="pt-2">
              <button onClick={saveKit} disabled={savingKit} className="bg-indigo-600 text-white text-sm px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
                {savingKit ? "Guardando..." : "Guardar Kit"}
              </button>
            </div>
          </div>
        )}
      </div>

      <PasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
        userEmail={userEmail}
        showToast={showToast}
      />
    </div>
  );
}

function PasswordModal({ isOpen, onClose, userEmail, showToast }: { isOpen: boolean, onClose: () => void, userEmail: string, showToast: any }) {
  const supabase = createClient();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleUpdate() {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const { error: reAuthError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: oldPassword,
      });

      if (reAuthError) {
        throw new Error("Contraseña actual incorrecta");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      showToast("Contraseña actualizada con éxito");
      onClose();
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <h2 className="text-2xl font-black text-slate-800 mb-2">Cambiar Contraseña</h2>
        <p className="text-slate-500 text-sm mb-6">Por seguridad, valida tu identidad.</p>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-400">Contraseña Actual</label>
            <input 
              type="password" 
              value={oldPassword} 
              onChange={(e) => setOldPassword(e.target.value)} 
              className={inputCls} 
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-400">Nueva Contraseña</label>
            <input 
              type="password" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              className={inputCls} 
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-400">Confirmar Nueva Contraseña</label>
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              className={inputCls} 
            />
          </div>

          {error && <p className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-4">
            <button 
              onClick={onClose} 
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm"
            >
              Cancelar
            </button>
            <button 
              onClick={handleUpdate}
              disabled={loading || !oldPassword || !newPassword}
              className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm"
            >
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          </div>
        </div>
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

function LangToggle({ current, onChange }: { current: "es" | "en", onChange: (l: "es" | "en") => void }) {
  return (
    <div className="flex border border-gray-200 rounded-lg overflow-hidden">
      {["en", "es"].map((lang) => (
        <button 
          key={lang} 
          onClick={() => onChange(lang as any)} 
          className={`text-xs px-3 py-1 font-medium ${current === lang ? "bg-indigo-600 text-white" : "bg-white text-gray-600"}`}
        >
          {lang === "en" ? "🇺🇸" : "🇦🇷"}
        </button>
      ))}
    </div>
  )
}

function LinkCard({ icon, label, url, isCopied, onCopy }: { icon: string, label: string, url: string, isCopied: boolean, onCopy: () => void }) {
  return (
    <div 
      onClick={onCopy}
      className={`bg-white border rounded-xl p-4 transition-all cursor-pointer active:scale-95 select-none text-left flex flex-col gap-2 ${
        isCopied ? 'border-green-500 shadow-md shadow-green-50' : 'border-gray-200 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xl">{icon}</span>
        {isCopied && <span className="text-[10px] font-bold text-green-600 uppercase">✓ Copiado</span>}
      </div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-xs font-bold truncate ${url ? (isCopied ? 'text-green-600' : 'text-indigo-600') : 'text-gray-300 italic'}`}>
        {url || "No configurado"}
      </p>
    </div>
  )
}

const inputCls = "w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm";

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Seniority, Modality } from "@/types";
import { searchITTerms, type ITTerm } from "@/lib/it-terms-dictionary";

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
  const [activeTab, setActiveTab] = useState<"perfil" | "cv" | "kit" | "cuenta" | "tokens">("perfil");

  // Blacklist & LLM config
  const [blacklistTerms, setBlacklistTerms] = useState<string[]>([]);
  const [blacklistThreshold, setBlacklistThreshold] = useState(2);
  const [llmProvider, setLlmProvider] = useState<"gemini" | "openai" | "anthropic">("gemini");

  // API Tokens
  const [apifyKey, setApifyKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [savingTokens, setSavingTokens] = useState(false);

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
      setBlacklistTerms(searchProfile.blacklist_terms ?? []);
      setBlacklistThreshold(searchProfile.blacklist_threshold ?? 2);
      setLlmProvider(searchProfile.llm_provider ?? "gemini");
      // Tokens
      setApifyKey(searchProfile.apify_key ?? "");
      setOpenaiKey(searchProfile.openai_key ?? "");
      setAnthropicKey(searchProfile.anthropic_key ?? "");
      setGeminiKey(searchProfile.gemini_key ?? "");
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
      blacklist_terms: blacklistTerms,
      blacklist_threshold: blacklistThreshold,
      llm_provider: llmProvider,
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

  async function saveTokens() {
    setSavingTokens(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from("search_profiles")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const tokenPayload = {
      user_id: user.id,
      apify_key: apifyKey,
      openai_key: openaiKey,
      anthropic_key: anthropicKey,
      gemini_key: geminiKey,
    };

    try {
      if (existing) {
        await supabase.from("search_profiles").update(tokenPayload).eq("id", existing.id);
      } else {
        await supabase.from("search_profiles").insert({ ...tokenPayload, is_active: true });
      }
      showToast("Tokens guardados");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSavingTokens(false);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      {/* Dynamic Toast */}
      {toast && (
        <div className="fixed top-20 lg:top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-white/20 flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-green-600/90 text-white' : 'bg-red-600/90 text-white'
          }`}>
            <span className="text-lg">{toast.type === 'success' ? '✅' : '❌'}</span>
            <span className="text-sm font-bold tracking-tight">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-5 lg:py-8">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mi Perfil</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Configura tu identidad, criterios de búsqueda y CV</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap">
          {[
            { key: "cuenta", label: "Mi Cuenta" },
            { key: "perfil", label: "Criterios" },
            { key: "tokens", label: "Tokens" },
            { key: "cv", label: "Mi CV" },
            { key: "kit", label: "Kit Postulación" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`text-sm px-4 py-2 rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.key
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "cuenta" && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre">
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Apellido">
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="LinkedIn URL">
              <input type="url" value={linkedin_url} onChange={(e) => setLinkedinUrl(e.target.value)} className={inputCls} placeholder="https://linkedin.com/in/..." autoComplete="off" />
            </Field>
            <Field label="GitHub URL">
              <input type="url" value={github_url} onChange={(e) => setGithubUrl(e.target.value)} className={inputCls} placeholder="https://github.com/..." autoComplete="off" />
            </Field>
            <Field label="Portfolio URL">
              <input type="url" value={portfolio_url} onChange={(e) => setPortfolioUrl(e.target.value)} className={inputCls} placeholder="https://..." autoComplete="off" />
            </Field>
            <Field label="Email" hint="No se puede cambiar">
              <input value={userEmail} disabled className={`${inputCls} opacity-50 cursor-not-allowed`} />
            </Field>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="text-indigo-600 text-sm font-bold flex items-center gap-2 px-4 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-all"
              >
                🔒 Cambiar contraseña
              </button>
              <button
                onClick={updateAccount}
                disabled={savingAccount}
                className="w-full sm:w-auto bg-indigo-600 text-white text-sm px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {savingAccount ? "Guardando..." : "Actualizar Datos"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "perfil" && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Field label="Título profesional">
              <input value={form.title} onChange={set("title")} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Seniority">
                <select value={form.seniority} onChange={set("seniority")} className={inputCls}>
                  {["junior", "mid", "senior", "staff", "lead"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Experiencia (años)">
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
                <input value={form.location} onChange={set("location")} className={inputCls} placeholder="Ej: Buenos Aires" />
              </Field>
            </div>
            {/* Blacklist */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Filtro de Posts LinkedIn</h3>
                <p className="text-[11px] text-slate-400">
                  Posts con {blacklistThreshold} o más apariciones de estos términos serán descartados. Los que tengan menos irán a "A revisar".
                </p>
              </div>
              <Field label="Lista negra de términos" hint="Escribí y presioná Enter, o elegí una sugerencia">
                <TagInput
                  tags={blacklistTerms}
                  onAdd={(tag) => setBlacklistTerms((prev) => [...prev, tag])}
                  onRemove={(tag) => setBlacklistTerms((prev) => prev.filter((t) => t !== tag))}
                  placeholder="Ej: AWS, Java, backend..."
                />
              </Field>
              <Field label="Umbral para descartar (N apariciones)" hint="Default: 2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={blacklistThreshold}
                  onChange={(e) => setBlacklistThreshold(Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* LLM Scoring */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Scoring con IA</h3>
                <p className="text-[11px] text-slate-400">
                  Los posts que pasen el filtro recibirán un score de match. Configurá las API keys en la tab{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("tokens")}
                    className="text-indigo-500 font-bold underline underline-offset-2"
                  >
                    Tokens
                  </button>.
                </p>
              </div>
              <Field label="Proveedor">
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "gemini" | "openai" | "anthropic")}
                  className={inputCls}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </Field>
            </div>

            <div className="pt-2">
              <button onClick={saveProfile} disabled={saving} className="w-full sm:w-auto bg-indigo-600 text-white text-sm px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all">
                {saving ? "Guardando..." : "Guardar Criterios"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "tokens" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-xs text-slate-400">
              Tus API keys se guardan en tu perfil y se usan para el scoring automático y las búsquedas. Nunca se comparten.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TokenCard
                provider="apify"
                value={apifyKey}
                onChange={setApifyKey}
              />
              <TokenCard
                provider="openai"
                value={openaiKey}
                onChange={setOpenaiKey}
              />
              <TokenCard
                provider="anthropic"
                value={anthropicKey}
                onChange={setAnthropicKey}
              />
              <TokenCard
                provider="gemini"
                value={geminiKey}
                onChange={setGeminiKey}
              />
            </div>
            <div className="pt-2">
              <button
                onClick={saveTokens}
                disabled={savingTokens}
                className="bg-indigo-600 text-white text-sm px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {savingTokens ? "Guardando..." : "Guardar Tokens"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "cv" && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <textarea
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              rows={14}
              className={`${inputCls} font-mono text-xs`}
              placeholder="Pegá aquí el texto completo de tu CV..."
            />
            <button onClick={saveCv} disabled={savingCv || !cvText.trim()} className="w-full sm:w-auto bg-indigo-600 text-white text-sm px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all">
              {savingCv ? "Guardando..." : "Guardar CV"}
            </button>
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
              <button onClick={saveKit} disabled={savingKit} className="bg-indigo-600 text-white text-sm px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all">
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

function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<ITTerm[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInput(value: string) {
    setInput(value);
    const results = searchITTerms(value);
    setSuggestions(results);
    setOpen(results.length > 0);
  }

  function addTag(label: string) {
    const trimmed = label.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
    }
    setInput("");
    setSuggestions([]);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onRemove(tags[tags.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="space-y-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                className="ml-0.5 text-red-400 hover:text-red-600 transition-colors leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => input.length >= 2 && setOpen(suggestions.length > 0)}
          placeholder={placeholder}
          className={inputCls}
        />
        {open && suggestions.length > 0 && (
          <div className="absolute z-20 top-full mt-1 left-0 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(s.label);
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left"
              >
                <span className="text-sm text-slate-800 font-medium">{s.label}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">{s.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Token providers config ────────────────────────────────────────────────────
const TOKEN_PROVIDERS = {
  apify: {
    name: "Apify",
    description: "Web scraping & automation. Usado para buscar posts en LinkedIn.",
    placeholder: "apify_api_...",
    accent: "#FF7518",
    bg: "#FFF4EC",
    border: "#FFD4AC",
    docsUrl: "https://console.apify.com/account/integrations",
    logo: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <rect width="40" height="40" rx="8" fill="#FF7518" />
        <path d="M20 8L30 28H10L20 8Z" fill="white" />
        <rect x="14" y="22" width="12" height="3" rx="1.5" fill="#FF7518" />
      </svg>
    ),
  },
  openai: {
    name: "OpenAI",
    description: "GPT-4 / GPT-4o para scoring de vacantes y análisis de CV.",
    placeholder: "sk-proj-...",
    accent: "#10a37f",
    bg: "#F0FDF9",
    border: "#A7F3D0",
    docsUrl: "https://platform.openai.com/api-keys",
    logo: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <rect width="40" height="40" rx="8" fill="#10a37f" />
        <path d="M20 10C14.477 10 10 14.477 10 20C10 25.523 14.477 30 20 30C25.523 30 30 25.523 30 20C30 14.477 25.523 10 20 10ZM20 13C23.866 13 27 16.134 27 20C27 23.866 23.866 27 20 27C16.134 27 13 23.866 13 20C13 16.134 16.134 13 20 13Z" fill="white" opacity="0.3" />
        <path d="M20 7L22.5 14H30L24 18.5L26.5 25.5L20 21L13.5 25.5L16 18.5L10 14H17.5L20 7Z" fill="white" />
      </svg>
    ),
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude para análisis profundo y scoring con razonamiento.",
    placeholder: "sk-ant-api03-...",
    accent: "#D97757",
    bg: "#FDF6F3",
    border: "#F5C6B4",
    docsUrl: "https://console.anthropic.com/settings/keys",
    logo: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <rect width="40" height="40" rx="8" fill="#D97757" />
        <path d="M20 9L27 28H13L20 9Z" fill="white" />
        <path d="M15 22H25" stroke="#D97757" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  gemini: {
    name: "Google Gemini",
    description: "Gemini 1.5 Flash/Pro para scoring rápido y eficiente.",
    placeholder: "AIzaSy...",
    accent: "#4285F4",
    bg: "#F0F4FF",
    border: "#BFCFFF",
    docsUrl: "https://aistudio.google.com/app/apikey",
    logo: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <rect width="40" height="40" rx="8" fill="url(#gem-grad)" />
        <defs>
          <linearGradient id="gem-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4285F4" />
            <stop offset="0.5" stopColor="#9B59FF" />
            <stop offset="1" stopColor="#EA4335" />
          </linearGradient>
        </defs>
        <path d="M20 9C20 9 20 20 9 20C20 20 20 31 20 31C20 31 20 20 31 20C20 20 20 9 20 9Z" fill="white" />
      </svg>
    ),
  },
} as const;

type TokenProvider = keyof typeof TOKEN_PROVIDERS;

function TokenCard({
  provider,
  value,
  onChange,
}: {
  provider: TokenProvider;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const cfg = TOKEN_PROVIDERS[provider];
  const hasKey = value.trim().length > 0;

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{ borderColor: cfg.border, backgroundColor: cfg.bg }}
    >
      {/* Header strip */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${cfg.border}` }}
      >
        {cfg.logo}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-slate-800">{cfg.name}</p>
          <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{cfg.description}</p>
        </div>
        {hasKey && (
          <span
            className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border"
            style={{ color: cfg.accent, borderColor: cfg.border, backgroundColor: "white" }}
          >
            ✓ Configurado
          </span>
        )}
      </div>

      {/* Input */}
      <div className="px-5 py-4 space-y-3">
        <div className="relative">
          <input
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={cfg.placeholder}
            autoComplete="off"
            className="w-full pr-10 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none text-sm transition-all font-mono"
            style={{
              borderColor: value ? cfg.accent + "66" : undefined,
              boxShadow: value ? `0 0 0 3px ${cfg.accent}18` : undefined,
            }}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-3 flex items-center text-slate-300 hover:text-slate-500 transition-colors"
          >
            {visible ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        <a
          href={cfg.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-semibold flex items-center gap-1 transition-colors"
          style={{ color: cfg.accent }}
        >
          Obtener API key
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );
}

const inputCls = "w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500";

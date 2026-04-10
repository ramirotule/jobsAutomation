"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export function UtilityToolbar() {
  const [isOpen, setIsOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [userProfile, setUserProfile] = useState({ 
    name: "", 
    linkedin: "", 
    github: "", 
    portfolio: "",
    dm_es: "",
    dm_en: "",
    cover_es: "",
    cover_en: ""
  });
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node) && isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, linkedin_url, github_url, portfolio_url, dm_es, dm_en, cover_letter_es, cover_letter_en")
          .eq("id", user.id)
          .maybeSingle();
        
        if (profile) {
          setUserProfile({
            name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || user.email?.split("@")[0] || "User",
            linkedin: profile.linkedin_url || "",
            github: profile.github_url || "",
            portfolio: profile.portfolio_url || "",
            dm_es: profile.dm_es || "",
            dm_en: profile.dm_en || "",
            cover_es: profile.cover_letter_es || "",
            cover_en: profile.cover_letter_en || "",
          });
        }
      }
    }
    fetchProfile();
  }, []);

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const categories = [
    {
      title: "Mis Enlaces",
      items: [
        { id: "li", label: "LinkedIn", value: userProfile.linkedin, icon: <LinkedInIcon /> },
        { id: "gh", label: "GitHub", value: userProfile.github, icon: <GitHubIcon /> },
        { id: "pf", label: "Portfolio", value: userProfile.portfolio, icon: <PortfolioIcon /> },
      ]
    },
    {
      title: "Mensajes (ES)",
      items: [
        { id: "dm-es", label: "DM Corto", value: userProfile.dm_es, icon: "💬" },
        { id: "cl-es", label: "Cover Letter", value: userProfile.cover_es, icon: "📄" },
      ]
    },
    {
      title: "Messages (EN)",
      items: [
        { id: "dm-en", label: "Short DM", value: userProfile.dm_en, icon: "🇬🇧" },
        { id: "cl-en", label: "Cover Letter", value: userProfile.cover_en, icon: "📝" },
      ]
    }
  ];

  return (
    <div 
      ref={toolbarRef}
      className={`fixed top-0 right-0 h-full z-[100] w-64 bg-white border-l border-gray-200 shadow-2xl transition-transform duration-500 ease-in-out flex flex-col ${
        isOpen ? "translate-x-0" : "translate-x-[calc(100%-4px)]"
      }`}
    >
      {/* Botón de Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -left-10 top-1/2 -translate-y-1/2 w-10 h-14 bg-white border border-r-0 border-gray-200 rounded-l-2xl shadow-[-4px_0_15px_rgba(0,0,0,0.08)] flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-all group"
      >
        <div className={`transition-transform duration-500 ${isOpen ? "rotate-0" : "rotate-180"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </button>

      <div className="h-full flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
            </div>
            <h2 className="font-bold text-gray-900 tracking-tight text-base">
              Kit Postulación
            </h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-7">
          {categories.map((cat, idx) => (
            <div key={idx} className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 opacity-80 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                {cat.title}
              </h3>
              <div className="space-y-1.5">
                {cat.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleCopy(item.value, item.id)}
                    disabled={!item.value}
                    title={item.label}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-300 ${
                      !item.value 
                        ? "opacity-20 grayscale cursor-not-allowed" 
                        : copyStatus === item.id 
                          ? "bg-green-50 text-green-700 ring-2 ring-green-100 scale-[0.98]" 
                          : "hover:bg-gray-50 text-gray-600 hover:text-indigo-700 hover:scale-[1.02] active:scale-95 group/item"
                    }`}
                  >
                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm shrink-0 ${
                      copyStatus === item.id 
                        ? "bg-white text-green-600" 
                        : "bg-white group-hover/item:shadow-md group-hover/item:text-indigo-600"
                    }`}>
                      {copyStatus === item.id ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      ) : (
                        <div className="scale-110">
                          {item.icon}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-[13px] font-bold truncate w-full tracking-tight">
                        {copyStatus === item.id ? "¡COPIADO!" : item.label}
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium truncate w-full">
                        {!item.value ? "No configurado" : (copyStatus === item.id ? "Listo para pegar" : "Clic para copiar")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-gray-50 bg-gray-50/30 text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Assistant v1.0</p>
        </div>
      </div>
    </div>
  );
}

function LinkedInIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
  );
}

function GitHubIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function PortfolioIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
  );
}

"use client";

import { useState } from "react";

interface SocialLinksProps {
  linkedin: string;
  github: string;
  portfolio: string;
}

export default function SocialLinks({ linkedin, github, portfolio }: SocialLinksProps) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const handleCopy = (url: string, key: string) => {
    if (url) {
      navigator.clipboard.writeText(url);
      setCopyStatus(key);
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  return (
    <div className="fixed top-6 right-8 z-[100] flex items-center gap-3 bg-white/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 shadow-xl shadow-indigo-100/20 animate-in fade-in slide-in-from-right-4 duration-700">
      <SocialIcon
        icon={<LinkedInIcon />}
        url={linkedin}
        label="LinkedIn"
        isCopied={copyStatus === "linkedin"}
        onCopy={() => handleCopy(linkedin, "linkedin")}
      />
      < SocialIcon
        icon={<GitHubIcon />}
        url={github}
        label="GitHub"
        isCopied={copyStatus === "github"}
        onCopy={() => handleCopy(github, "github")}
      />
      <SocialIcon
        icon={<PortfolioIcon />}
        url={portfolio}
        label="Portfolio"
        isCopied={copyStatus === "portfolio"}
        onCopy={() => handleCopy(portfolio, "portfolio")}
      />
    </div>
  );
}

function SocialIcon({ 
  icon, 
  url, 
  label, 
  isCopied, 
  onCopy 
}: { 
  icon: React.ReactNode, 
  url: string, 
  label: string, 
  isCopied: boolean, 
  onCopy: () => void 
}) {
  return (
    <div className="relative group">
      <button
        onClick={onCopy}
        disabled={!url}
        title={url ? `Copiar ${label}` : `${label} no configurado`}
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-300 ${
          !url 
            ? "opacity-20 cursor-not-allowed grayscale" 
            : isCopied 
              ? "bg-green-500 text-white scale-110 shadow-lg shadow-green-100" 
              : "bg-white text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-md hover:-translate-y-0.5 border border-gray-100"
        }`}
      >
        {isCopied ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ) : icon}
      </button>
      {isCopied && (
        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-black tracking-widest px-2 py-1 rounded-md animate-in fade-in zoom-in-50 duration-200 shadow-xl">
          COPIADO
        </span>
      )}
    </div>
  );
}

function LinkedInIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
  );
}

function GitHubIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
  );
}

function PortfolioIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
  );
}

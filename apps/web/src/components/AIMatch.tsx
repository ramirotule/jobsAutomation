"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface MatchResult {
  score: number;
  pros: string[];
  cons: string[];
  recommendation: string;
}

export function AIMatch({ jobDescription, jobId }: { jobDescription: string; jobId: string }) {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [manualDescription, setManualDescription] = useState("");
  const [showManual, setShowManual] = useState(false);

  const isBadDescription = !jobDescription || jobDescription === "None" || jobDescription === "N/A" || jobDescription.length < 50;

  const startAnalysis = async (customDesc?: string) => {
    setAnalyzing(true);
    setError(null);
    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: customDesc || jobDescription, jobId }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      
      if (isBadDescription || customDesc) {
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  if (!result && !analyzing) {
    return (
      <div className="flex flex-col items-center py-6">
        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4 text-indigo-600 animate-pulse">
           {isBadDescription ? '🔍' : '✨'}
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-1">Análisis de Match con IA</h3>
        
        <p className="text-xs text-gray-500 mb-4 text-center max-w-xs">
          {isBadDescription 
            ? "Esta vacante no tiene descripción. Hacé clic para intentar recuperarla de LinkedIn y analizarla." 
            : "Comparamos automáticamente tus skills y CV con esta vacante."}
        </p>
        
        {!showManual ? (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => startAnalysis()}
              className="bg-indigo-600 text-white text-xs font-bold px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95"
            >
              {isBadDescription ? "Obtener descripción y analizar" : "Analizar Compatibilidad"}
            </button>
            <button
              onClick={() => setShowManual(true)}
              className="text-[10px] text-gray-400 font-bold uppercase hover:text-indigo-600 transition-colors"
            >
              Pegar descripción manualmente
            </button>
          </div>
        ) : (
          <div className="w-full space-y-3">
            <textarea
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              placeholder="Pegá la descripción del empleo aquí..."
              className="w-full min-h-[120px] text-xs p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => startAnalysis(manualDescription)}
                disabled={manualDescription.length < 50}
                className="flex-1 bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                Analizar Texto Pegado
              </button>
              <button
                onClick={() => setShowManual(false)}
                className="px-4 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        
        {error && <p className="mt-3 text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">{error}</p>}
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-indigo-600 animate-pulse">Analizando requerimientos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-tighter">Resultado del Match</h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">IA Scouting Report</p>
        </div>
        <div className={`text-2xl font-black ${result!.score > 75 ? 'text-green-600' : result!.score > 50 ? 'text-yellow-600' : 'text-red-600'}`}>
          {result!.score}%
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50/50 border border-green-100 rounded-2xl p-4">
          <p className="text-[10px] font-black text-green-700 uppercase mb-3">Puntos Fuertes</p>
          <ul className="space-y-2">
            {result!.pros.map((pro, i) => (
              <li key={i} className="text-xs text-green-800 flex items-start gap-2">
                <span>✅</span> {pro}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4">
          <p className="text-[10px] font-black text-red-700 uppercase mb-3">Brechas / Gaps</p>
          <ul className="space-y-2">
            {result!.cons.map((con, i) => (
              <li key={i} className="text-xs text-red-800 flex items-start gap-2">
                <span>⚠️</span> {con}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <p className="text-[10px] font-black text-indigo-600 uppercase mb-2">Recomendación IA</p>
        <p className="text-xs text-gray-600 leading-relaxed italic">
          "{result!.recommendation}"
        </p>
      </div>

      <button
        onClick={() => setResult(null)}
        className="text-[10px] font-black uppercase text-gray-400 hover:text-gray-600 tracking-widest block mx-auto py-2"
      >
        Re-analizar
      </button>
    </div>
  );
}

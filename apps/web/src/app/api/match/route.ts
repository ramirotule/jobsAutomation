import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { jobDescription, jobId } = await request.json();
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener perfil de búsqueda y CV
    const [{ data: searchProfile }, { data: resume }] = await Promise.all([
      supabase.from("search_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("resumes").select("raw_text").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
    ]);

    let finalDescription = jobDescription;

    // Si no hay descripción válida, intentamos hidratarla (SCRAPING PROFUNDO)
    if (!finalDescription || finalDescription === "None" || finalDescription === "N/A" || finalDescription.length < 50) {
      console.log(`Descripción insuficiente para vacante ${jobId}. Iniciando hidratación automática...`);
      
      const { data: jobData } = await supabase
        .from("job_posts")
        .select("apply_url")
        .eq("id", jobId)
        .single();

      if (jobData?.apply_url) {
        // Importación dinámica para no cargar puppeteer si no es necesario
        const { scrapeLinkedInDescription } = await import("@/lib/scraper");
        const hydrated = await scrapeLinkedInDescription(jobData.apply_url);
        
        if (hydrated && hydrated.length > 50) {
          finalDescription = hydrated;
          console.log(`✅ Hidratación exitosa (${hydrated.length} chars). Guardando en DB.`);
          
          await supabase
            .from("job_posts")
            .update({ description: hydrated })
            .eq("id", jobId);
        }
      }
    }

    // Validación final después de intentar hidratar
    if (!finalDescription || finalDescription === "None" || finalDescription === "N/A" || finalDescription.length < 20) {
      return NextResponse.json({ 
        error: "No se pudo obtener la descripción del empleo automáticamente. Intenta entrar manualmente al link de LinkedIn." 
      }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY no configurada. Agregala a tu .env.local y reinicia el servidor." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" } // Forzar JSON si el modelo lo soporta
    });

    const prompt = `
      Actúa como un reclutador experto. Analiza el "match" entre un candidato y una vacante.
      
      IMPORTANTE: Tu respuesta debe ser un objeto JSON VÁLIDO. No incluyas texto fuera del JSON.
      
      PERFIL DEL CANDIDATO:
      - Título: ${searchProfile?.title || "No especificado"}
      - Seniority: ${searchProfile?.seniority || "No especificado"}
      - Skills principales: ${(searchProfile?.primary_skills || []).join(", ")}
      - Skills secundarios: ${(searchProfile?.secondary_skills || []).join(", ")}
      - Experiencia: ${searchProfile?.years_experience || 0} años
      
      CV (Texto extraído):
      ${resume?.raw_text || "No disponible"}
      
      VACANTE (Descripción):
      ${finalDescription}
      
      RESPUESTA (JSON):
      {
        "score": number, 
        "pros": string[], 
        "cons": string[], 
        "recommendation": string
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      const cleanJson = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      return NextResponse.json(parsed);
    } catch (parseError) {
      console.error("Error parseando IA response:", text);
      return NextResponse.json({ error: "La IA respondió en un formato incorrecto. Intenta de nuevo." }, { status: 500 });
    }
  } catch (error) {
    console.error("Error en AI Match:", error);
    return NextResponse.json({ error: "Error al conectar con la IA de Google." }, { status: 500 });
  }
}

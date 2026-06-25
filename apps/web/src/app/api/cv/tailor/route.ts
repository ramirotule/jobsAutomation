import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { jobId, jobDescription, targetFormat = "full" } = await request.json();

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    // Fetch resume, search profile, and job post in parallel
    const [{ data: resume }, { data: searchProfile }, { data: jobPost }] = await Promise.all([
      supabase
        .from("resumes")
        .select("raw_text")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("search_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("job_posts")
        .select("title, company, description")
        .eq("id", jobId)
        .single(),
    ]);

    if (!resume?.raw_text) {
      return NextResponse.json(
        { error: "No active resume found. Please upload your CV first." },
        { status: 400 }
      );
    }

    const finalDescription = jobDescription || jobPost?.description;

    if (!finalDescription || finalDescription.length < 20) {
      return NextResponse.json(
        { error: "Job description is not available or too short to tailor your CV against." },
        { status: 400 }
      );
    }

    if (!jobPost) {
      return NextResponse.json({ error: "Job post not found." }, { status: 404 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured. Add it to your .env.local and restart the server." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `
You are an expert career coach and CV writer. Your task is to tailor a candidate's CV to better match a specific job posting.

IMPORTANT: Your response must be a valid JSON object. Do not include text outside the JSON.

ORIGINAL CV:
${resume.raw_text}

CANDIDATE PROFILE:
- Target role: ${searchProfile?.title || "Not specified"}
- Seniority: ${searchProfile?.seniority || "Not specified"}
- Primary skills: ${(searchProfile?.primary_skills || []).join(", ")}
- Years of experience: ${searchProfile?.years_experience || "Not specified"}

JOB POSTING:
Title: ${jobPost.title}
Company: ${jobPost.company}
Description: ${finalDescription}

INSTRUCTIONS:
1. Rewrite the CV to emphasize skills and experience that match this specific job
2. Reorder sections to highlight the most relevant experience first
3. Use keywords from the job posting naturally in the CV
4. Keep it honest — do not fabricate experience, only reframe existing experience
5. Make the professional summary specifically address what this company is looking for
6. If the job requires skills the candidate has but didn't highlight, bring them forward
${targetFormat === "summary" ? "7. Return only a concise professional summary paragraph, not the full CV." : ""}
${targetFormat === "highlights" ? "7. Return only the key highlights and bullet points most relevant to this position." : ""}

RESPONSE (JSON):
{
  "tailored_cv": "The complete tailored CV as plain text, ready to copy-paste",
  "changes_made": ["List of specific changes made to the CV"],
  "keywords_added": ["Keywords from the job posting that were incorporated"],
  "match_improvement": "Brief explanation of how the tailored CV better matches the position",
  "cover_letter_suggestion": "A brief, personalized cover letter paragraph for this specific position"
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
      console.error("Error parsing AI response:", text);
      return NextResponse.json(
        { error: "The AI responded in an unexpected format. Please try again." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in CV tailor:", error);
    return NextResponse.json({ error: "Error connecting to Google AI." }, { status: 500 });
  }
}

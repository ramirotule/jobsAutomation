import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// POST: Process the next unscored job and return progress
export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Count total unscored
    const { count: remaining } = await supabase
      .from("job_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("match_score", null);

    if (!remaining || remaining === 0) {
      // Count total scored to report
      const { count: totalScored } = await supabase
        .from("job_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("match_score", "is", null);

      return NextResponse.json({
        remaining: 0,
        processed: totalScored || 0,
        isComplete: true,
      });
    }

    // Get the next unscored job
    const { data: nextJob } = await supabase
      .from("job_posts")
      .select("id, title, company, description, location, modality, required_skills")
      .eq("user_id", user.id)
      .is("match_score", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!nextJob) {
      return NextResponse.json({ remaining: 0, processed: 0, isComplete: true });
    }

    const description = nextJob.description || "";

    // If description is too short, mark as unscorable (fast path)
    if (description.length < 20) {
      await supabase
        .from("job_posts")
        .update({
          match_score: -1,
          match_result: { error: "Description too short to analyze" },
        })
        .eq("id", nextJob.id);

      return NextResponse.json({
        remaining: remaining - 1,
        jobId: nextJob.id,
        score: -1,
        isComplete: remaining - 1 === 0,
      });
    }

    // Get user profile and CV
    const [{ data: searchProfile }, { data: resume }] = await Promise.all([
      supabase
        .from("search_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("resumes")
        .select("raw_text")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `
You are an expert recruiter. Analyze the match between a candidate and a job posting.

IMPORTANT: Your response must be a valid JSON object. Do not include text outside the JSON.

CANDIDATE PROFILE:
- Title: ${searchProfile?.title || "Not specified"}
- Seniority: ${searchProfile?.seniority || "Not specified"}
- Primary skills: ${(searchProfile?.primary_skills || []).join(", ")}
- Secondary skills: ${(searchProfile?.secondary_skills || []).join(", ")}
- Experience: ${searchProfile?.years_experience || 0} years

CV (extracted text):
${resume?.raw_text || "Not available"}

JOB POSTING:
Title: ${nextJob.title || "Not specified"}
Company: ${nextJob.company || "Not specified"}
Location: ${nextJob.location || "Not specified"}
Description: ${description}

RESPONSE (JSON):
{
  "score": number between 0 and 100,
  "pros": ["reasons this is a good match"],
  "cons": ["reasons this might not be a good match"],
  "recommendation": "brief recommendation for the candidate"
}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const cleanJson = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    const score = Math.min(100, Math.max(0, Number(parsed.score) || 0));

    await supabase
      .from("job_posts")
      .update({
        match_score: score,
        match_result: parsed,
      })
      .eq("id", nextJob.id);

    return NextResponse.json({
      remaining: remaining - 1,
      jobId: nextJob.id,
      title: nextJob.title,
      score,
      isComplete: remaining - 1 === 0,
    });
  } catch (error: any) {
    console.error("[BatchMatch] error:", error.message);

    // On rate limit, tell the frontend to slow down
    if (error.message?.includes("429") || error.status === 429) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: 60 },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

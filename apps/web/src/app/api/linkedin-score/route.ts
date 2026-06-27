import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 120; // seconds — allows slow models like Gemma 4 31B

interface PostInput {
  id?: string;
  text?: string;
}

interface ScoreResult {
  index: number;
  score: number;
  reason: string;
}

interface UserProfile {
  title?: string;
  primary_skills?: string[];
  secondary_skills?: string[];
  blacklist_terms?: string[];
}

function buildPrompt(posts: PostInput[], profile: UserProfile): string {
  const skills = [
    ...(profile.primary_skills ?? []),
    ...(profile.secondary_skills ?? []),
  ].join(", ");

  const postsBlock = posts
    .map((p, i) => `[${i}] ${(p.text ?? "").slice(0, 600)}`)
    .join("\n\n");

  const blacklistNote = (profile.blacklist_terms ?? []).length > 0
    ? `\nAVOID (penalize heavily if post mentions): ${profile.blacklist_terms!.join(", ")}`
    : "";

  return `You are an expert recruiter helping a developer find jobs that match their profile.

CANDIDATE PROFILE:
- Target role: ${profile.title ?? "Frontend Developer"}
- Skills: ${skills || "React, TypeScript, JavaScript"}${blacklistNote}

TASK: Analyze each LinkedIn post below and determine if it is a job offer or hiring signal relevant to this candidate.
Score from 0 to 100:
- 90–100: Perfect match. Explicitly looking for the candidate's role/skills.
- 70–89: Good match. Related role, most skills align.
- 50–69: Partial match. Some relevant aspects but also unrelated requirements.
- 0–49: Poor match, not a hiring post, or completely unrelated stack.
- Penalize 30+ points if the post mentions any AVOID terms.

POSTS TO EVALUATE:
${postsBlock}

Respond ONLY with valid JSON — no markdown, no extra text:
{ "scores": [ { "index": 0, "score": 85, "reason": "one sentence in Spanish" } ] }`;
}

async function scoreWithGemini(
  prompt: string,
  apiKey: string
): Promise<ScoreResult[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = JSON.parse(text);
  return parsed.scores ?? [];
}

async function scoreWithOpenAI(
  prompt: string,
  apiKey: string
): Promise<ScoreResult[]> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? "OpenAI request failed");
  }

  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return parsed.scores ?? [];
}

async function scoreWithNvidia(
  prompt: string,
  apiKey: string
): Promise<ScoreResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 110000);

  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-8b-instruct",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? err.error?.message ?? `Nvidia error ${res.status}`);
    }

    const data = await res.json();
    const text = data.choices[0].message.content;
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return parsed.scores ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

async function scoreWithAnthropic(
  prompt: string,
  apiKey: string
): Promise<ScoreResult[]> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? "Anthropic request failed");
  }

  const data = await res.json();
  const text = data.content[0].text;
  // Strip markdown code fences if present
  const clean = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);
  return parsed.scores ?? [];
}

export async function POST(req: NextRequest) {
  try {
    const { posts, profile, provider, apiKey } = await req.json();

    if (!posts?.length) {
      return NextResponse.json({ error: "No posts provided" }, { status: 400 });
    }
    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "provider and apiKey are required" },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(posts, profile ?? {});
    let scores: ScoreResult[];

    switch (provider) {
      case "gemini":
        scores = await scoreWithGemini(prompt, apiKey);
        break;
      case "openai":
        scores = await scoreWithOpenAI(prompt, apiKey);
        break;
      case "anthropic":
        scores = await scoreWithAnthropic(prompt, apiKey);
        break;
      case "nvidia":
        scores = await scoreWithNvidia(prompt, apiKey);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown provider: ${provider}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ scores });
  } catch (e: any) {
    console.error("[linkedin-score]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

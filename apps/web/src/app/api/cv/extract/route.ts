import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";

export const maxDuration = 60; // seconds

interface ExtractResult {
  _reasoning: string;
  title: string;
  target_roles: string[];
  primary_skills: string[];
  secondary_skills: string[];
  seniority: string;
  years_experience: number;
  location: string;
  languages: { lang: string; level: string }[];
}

// Global in-memory map to store task statuses across hot reloads in dev
const globalForTasks = global as unknown as {
  cvTasks: Map<string, { status: 'pending' | 'success' | 'failed'; data?: any; error?: string }>
}
const tasks = globalForTasks.cvTasks || new Map();
if (process.env.NODE_ENV !== 'production') globalForTasks.cvTasks = tasks;

function buildPrompt(cvText: string): string {
  return `You are an expert technical recruiter and software engineering manager.
Your task is to analyze the following CV/Resume and extract key information into a structured JSON format to power an automated job matching engine.

RULES AND NEGATIVE CONSTRAINTS (CRITICAL):
1. IGNORE all soft skills. Do not include terms like "Leadership", "Teamwork", "Agile", "Scrum", "Proactive", "Communication" in any skill array. We ONLY care about hard technical skills.
2. primary_skills: Extract the main programming languages, frameworks, and core technologies the candidate is proficient in.
3. secondary_skills: Extract secondary technologies, databases, tools, OR cloud providers.
   *SEMANTIC EXPANSION*: Add highly relevant synonyms or closely related ecosystem tools to secondary_skills if they are strongly implied by the primary skills. (e.g. if React is primary, you can add "Next.js", "Redux", "Hooks", "React Router" to secondary even if not explicitly stated, to catch more job posts).
4. _reasoning: In 2 or 3 sentences, explain why you chose those specific primary skills and what ecosystem expansions you made.
5. seniority: Infer one of exactly: "junior", "mid", "senior", "staff", or "lead". (Do NOT use "semi-senior"). Rule of thumb: 0-2 years = junior, 3-5 years = mid, 5+ years = senior. Be generous: if they have solid real-world projects, lean towards 'mid' rather than 'junior'.
6. years_experience: Total years of professional experience as an integer. (0 if none). Estimate carefully based on dates.
7. title: A concise, standardized job title representing the candidate's core profile (e.g. "React Native Developer", "Frontend Engineer").
8. target_roles: An array of AT LEAST 3 alternative job titles or roles the candidate is fit for (e.g. ["React Native Developer", "Mobile Engineer", "Frontend Developer", "React Developer"]). MUST NOT be empty.
9. location: The candidate's city and country, or base location if stated. Leave empty if unknown.
10. languages: Array of known languages and proficiency. level MUST be one of: "native", "A1", "A2", "B1", "B2", "C1", "C2".

CV TEXT:
${cvText.slice(0, 10000)}

Respond ONLY with valid JSON — no markdown, no extra text, exactly matching this structure:
{
  "_reasoning": "string",
  "title": "string",
  "target_roles": ["string"],
  "primary_skills": ["string"],
  "secondary_skills": ["string"],
  "seniority": "string",
  "years_experience": 0,
  "location": "string",
  "languages": [{"lang": "string", "level": "string"}]
}`;
}

async function extractWithGemini(prompt: string, apiKey: string): Promise<ExtractResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text);
}

async function extractWithOpenAI(prompt: string, apiKey: string): Promise<ExtractResult> {
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
  return JSON.parse(data.choices[0].message.content);
}

async function extractWithNvidia(prompt: string, apiKey: string): Promise<ExtractResult> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: "meta/llama-3.1-8b-instruct",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
      temperature: 0.2,
      top_p: 0.95,
      stream: false
    }),
    signal: AbortSignal.timeout(90000)
  });

  console.log("[Nvidia API] Request sent, waiting for response (up to 90s)...");

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? err.error?.message ?? `Nvidia error ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices[0].message.content;
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

async function extractWithAnthropic(prompt: string, apiKey: string): Promise<ExtractResult> {
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
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function POST(req: NextRequest) {
  try {
    const { cvText, provider, apiKey } = await req.json();

    if (!cvText || cvText.trim().length === 0) {
      return NextResponse.json({ error: "CV text is empty" }, { status: 400 });
    }
    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "provider and apiKey are required" },
        { status: 400 }
      );
    }

    const taskId = crypto.randomUUID();
    tasks.set(taskId, { status: 'pending' });

    // Start background promise
    const prompt = buildPrompt(cvText);
    
    (async () => {
      try {
        let extracted: ExtractResult;
        switch (provider) {
          case "gemini":
            extracted = await extractWithGemini(prompt, apiKey);
            break;
          case "openai":
            extracted = await extractWithOpenAI(prompt, apiKey);
            break;
          case "anthropic":
            extracted = await extractWithAnthropic(prompt, apiKey);
            break;
          case "nvidia":
            extracted = await extractWithNvidia(prompt, apiKey);
            break;
          default:
            throw new Error(`Unknown provider: ${provider}`);
        }
        tasks.set(taskId, { status: 'success', data: extracted });
      } catch (e: any) {
        console.error(`[cv-extract-bg] Task ${taskId} failed:`, e);
        tasks.set(taskId, { status: 'failed', error: e.message });
      }
    })();

    return NextResponse.json({ success: true, taskId });
  } catch (e: any) {
    console.error("[cv-extract]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const task = tasks.get(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: task.status,
      extracted: task.data,
      error: task.error,
    });
  } catch (e: any) {
    console.error("[cv-status]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

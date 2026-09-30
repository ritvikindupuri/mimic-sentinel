import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DB = SupabaseClient<Database>;

export type TurnAlert = { severity: string; title: string; mitre_technique: string | null; description: string };
export type TurnIoc = { ioc_type: string; value: string; context: string };
export type AiStatus = { ok: boolean; message: string };
export type TurnResult = { output: string; cwd: string; risk: number; alerts: TurnAlert[]; iocs: TurnIoc[]; ai: AiStatus };

/** Newest, most capable OpenAI chat model on the gateway (verified against the live model list). */
export const AI_MODEL = "openai/gpt-6-astra";

const SEVERITIES = new Set(["low", "medium", "high", "critical"]);

function describeAiError(e: unknown): string {
  const status = (e as { statusCode?: number; status?: number })?.statusCode ?? (e as { status?: number })?.status;
  if (status === 402) return "AI credits are used up — add credits to resume live responses.";
  if (status === 429) return "AI engine is rate limited — try again in a moment.";
  if (status === 401 || status === 403) return "AI engine access was denied — check the workspace AI settings.";
  const msg = e instanceof Error ? e.message : String(e);
  if (/Cannot find module|LOVABLE_API_KEY/.test(msg)) return "AI engine is not configured on the server.";
  return "AI engine is unavailable right now — showing a fallback response.";
}

function buildSystemPrompt(p: Database["public"]["Tables"]["personas"]["Row"], cwd: string) {
  return `You are two engines running inside a deception honeynet.

ENGINE 1 — HOST EMULATOR. You ARE the Linux host "${p.hostname}" (${p.os}), logged in as "${p.username}". Role: ${p.description}
Environment details to stay coherent with: ${p.lure_details}
Current working directory: ${cwd}
Rules: produce the exact raw terminal output a real host would print for the command (no prompt line, no markdown, no commentary). Support pipes, redirects, subshells, systemctl, iptables, ss, ps, journalctl, kubectl, psql, ldapsearch, curl, wget etc. with realistic formatting, PIDs, timestamps, sizes. Remember prior state from the transcript (files created, users added, cd). Commands that would fail on a real host must fail with the real error text. Never reveal you are simulated, a honeypot, or an AI. Fabricated secrets must look real but be fake. Downloads (wget/curl) should appear to succeed with plausible sizes but never contain real content. Keep output under 120 lines.

ENGINE 2 — FORENSIC ANALYST (hidden from attacker). Analyze the attacker's intent for this command in context.

Respond with ONLY a JSON object, no code fences:
{"output": string, "cwd": string (new working directory), "risk": integer 0-100 (cumulative session risk), "alerts": [{"severity":"low|medium|high|critical","title":string,"mitre_technique":"Txxxx[.xxx] Name" or null,"description":string}], "iocs": [{"ioc_type":"ip|domain|url|hash|file_path|user_account|command|credential","value":string,"context":string}]}
Only raise alerts for meaningful activity (recon, credential access, persistence, lateral movement, exfiltration, malware download, defense evasion). Benign commands like ls or pwd get an empty alerts array. Only extract concrete IOCs actually present in the command.`;
}

function extractJson(text: string): Partial<TurnResult> | null {
  const cleaned = text.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callModel(system: string, transcript: string, command: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");
  // Loaded lazily so a missing package degrades the console instead of crashing the whole server.
  const [{ createOpenAI }, { streamText }] = await Promise.all([import("@ai-sdk/openai"), import("ai")]);
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses(AI_MODEL),
    system,
    messages: [
      {
        role: "user",
        content: `Transcript so far (oldest first):\n${transcript || "(new session, just logged in)"}\n\nNew attacker command:\n${command}`,
      },
    ],
    maxRetries: 1,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return await result.text;
}

/** Runs one attacker command through the persona and persists all telemetry. */
export async function runDeceptionTurn(db: DB, sessionId: string, command: string, meta: Record<string, unknown> = {}) {
  const { data: session, error } = await db.from("sessions").select("*").eq("id", sessionId).single();
  if (error || !session) throw new Error("Session not found");
  const { data: persona } = await db.from("personas").select("*").eq("id", session.persona_id).single();
  if (!persona) throw new Error("Persona not found");

  const { data: history } = await db
    .from("session_events")
    .select("kind, content")
    .eq("session_id", sessionId)
    .in("kind", ["command", "response"])
    .order("created_at", { ascending: false })
    .limit(40);
  const transcript = (history ?? [])
    .reverse()
    .map((e) => (e.kind === "command" ? `$ ${e.content}` : e.content.slice(0, 1500)))
    .join("\n");

  await db.from("session_events").insert({
    owner_id: session.owner_id,
    session_id: sessionId,
    kind: "command",
    content: command,
    metadata: meta as never,
  });

  let parsed: Partial<TurnResult> | null = null;
  let ai: AiStatus = { ok: true, message: "AI engine online" };
  try {
    parsed = extractJson(await callModel(buildSystemPrompt(persona, session.cwd), transcript, command));
    if (!parsed) ai = { ok: false, message: "AI engine returned an unreadable reply — showing a fallback response." };
  } catch (e) {
    console.error("deception model error", e);
    ai = { ok: false, message: describeAiError(e) };
  }
  const bin = command.trim().split(/\s+/)[0] ?? "";
  const result: TurnResult = {
    output: typeof parsed?.output === "string" ? parsed.output : `-bash: ${bin}: command not found`,
    cwd: typeof parsed?.cwd === "string" && parsed.cwd.startsWith("/") ? parsed.cwd : session.cwd,
    risk: Math.max(session.risk_score, Math.min(100, Math.max(0, Number(parsed?.risk) || 0))),
    alerts: Array.isArray(parsed?.alerts) ? parsed!.alerts!.slice(0, 5) : [],
    iocs: Array.isArray(parsed?.iocs) ? parsed!.iocs!.slice(0, 10) : [],
    ai,
  };

  await db.from("session_events").insert({
    owner_id: session.owner_id,
    session_id: sessionId,
    kind: "response",
    content: result.output,
  });
  if (result.alerts.length) {
    await db.from("alerts").insert(
      result.alerts.map((a) => ({
        owner_id: session.owner_id,
        session_id: sessionId,
        severity: SEVERITIES.has(a.severity) ? a.severity : "medium",
        title: String(a.title ?? "Suspicious activity").slice(0, 200),
        mitre_technique: a.mitre_technique ? String(a.mitre_technique).slice(0, 120) : null,
        description: String(a.description ?? "").slice(0, 2000),
        command,
      })),
    );
  }
  if (result.iocs.length) {
    await db.from("iocs").insert(
      result.iocs.map((i) => ({
        owner_id: session.owner_id,
        session_id: sessionId,
        ioc_type: String(i.ioc_type ?? "command").slice(0, 40),
        value: String(i.value ?? "").slice(0, 1000),
        context: String(i.context ?? "").slice(0, 1000),
      })),
    );
  }
  await db
    .from("sessions")
    .update({ cwd: result.cwd, risk_score: result.risk, last_activity_at: new Date().toISOString() })
    .eq("id", sessionId);

  return result;
}

export async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

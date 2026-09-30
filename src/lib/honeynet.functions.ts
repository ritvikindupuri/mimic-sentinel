import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runDeceptionTurn, sha256Hex } from "./deception.server";

export const startConsoleSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ personaId: z.string().uuid(), sourceIp: z.string().max(64).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: persona } = await context.supabase
      .from("personas")
      .select("username")
      .eq("id", data.personaId)
      .single();
    if (!persona) throw new Error("Persona not found");
    const home = persona.username === "root" ? "/root" : `/home/${persona.username}`;
    const { data: s, error } = await context.supabase
      .from("sessions")
      .insert({
        owner_id: context.userId,
        persona_id: data.personaId,
        source: "console",
        protocol: "ssh",
        source_ip: data.sourceIp || "203.0.113.47",
        attacker_user: persona.username,
        cwd: home,
      })
      .select("id, cwd")
      .single();
    if (error) throw new Error(error.message);
    return s;
  });

export const sendCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid(), command: z.string().min(1).max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    return runDeceptionTurn(context.supabase, data.sessionId, data.command, { via: "console" });
  });

export const createPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        hostname: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9.-]+$/),
        os: z.string().trim().min(1).max(80),
        username: z.string().trim().min(1).max(32).regex(/^[a-z_][a-z0-9_-]*$/),
        description: z.string().trim().max(1000),
        lure_details: z.string().trim().max(3000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("personas").insert({ ...data, owner_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createSensor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(1).max(80), personaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const key = "mrg_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await context.supabase.from("sensors").insert({
      owner_id: context.userId,
      name: data.name,
      persona_id: data.personaId,
      key_hash: await sha256Hex(key),
      key_prefix: key.slice(0, 10),
    });
    if (error) throw new Error(error.message);
    return { key };
  });

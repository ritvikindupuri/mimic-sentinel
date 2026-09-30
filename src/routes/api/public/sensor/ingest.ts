import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runDeceptionTurn, sha256Hex } from "@/lib/deception.server";

// Sensor intake. Real SSH/HTTP/API sensors forward attacker activity here and
// relay `output` back to the attacker. Auth: `Authorization: Bearer <sensor key>`.
const body = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session_start"),
    source_ip: z.string().max(64),
    protocol: z.enum(["ssh", "telnet", "http", "api"]).default("ssh"),
    username: z.string().max(64).optional(),
  }),
  z.object({ type: z.literal("command"), session_id: z.string().uuid(), command: z.string().min(1).max(4000) }),
  z.object({
    type: z.enum(["file_drop", "raw_socket", "auth_attempt"]),
    session_id: z.string().uuid(),
    content: z.string().max(20000),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
]);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const Route = createFileRoute("/api/public/sensor/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
        if (!key || !key.startsWith("mrg_")) return json({ error: "unauthorized" }, 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: sensor } = await supabaseAdmin
          .from("sensors")
          .select("id, owner_id, persona_id")
          .eq("key_hash", await sha256Hex(key))
          .maybeSingle();
        if (!sensor) return json({ error: "unauthorized" }, 401);

        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "invalid payload", issues: parsed.error.issues }, 400);
        const p = parsed.data;
        await supabaseAdmin.from("sensors").update({ last_seen_at: new Date().toISOString() }).eq("id", sensor.id);

        if (p.type === "session_start") {
          const { data: persona } = await supabaseAdmin
            .from("personas")
            .select("username, hostname")
            .eq("id", sensor.persona_id)
            .single();
          const user = persona?.username ?? "root";
          const { data: s, error } = await supabaseAdmin
            .from("sessions")
            .insert({
              owner_id: sensor.owner_id,
              persona_id: sensor.persona_id,
              sensor_id: sensor.id,
              source: "sensor",
              protocol: p.protocol,
              source_ip: p.source_ip,
              attacker_user: p.username ?? user,
              cwd: user === "root" ? "/root" : `/home/${user}`,
            })
            .select("id")
            .single();
          if (error) return json({ error: "could not open session" }, 500);
          return json({ session_id: s.id, hostname: persona?.hostname, username: user });
        }

        // Session must belong to this sensor.
        const { data: session } = await supabaseAdmin
          .from("sessions")
          .select("id")
          .eq("id", p.session_id)
          .eq("sensor_id", sensor.id)
          .maybeSingle();
        if (!session) return json({ error: "unknown session" }, 404);

        if (p.type === "command") {
          const r = await runDeceptionTurn(supabaseAdmin, p.session_id, p.command, { via: "sensor" });
          return json({ output: r.output, cwd: r.cwd });
        }

        await supabaseAdmin.from("session_events").insert({
          owner_id: sensor.owner_id,
          session_id: p.session_id,
          kind: p.type,
          content: p.content,
          metadata: (p.metadata ?? {}) as never,
        });
        return json({ ok: true });
      },
    },
  },
});

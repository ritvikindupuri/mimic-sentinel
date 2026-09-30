// Startup smoke test: fails fast if server-side AI dependencies are missing.
const mod = await import("../src/lib/deception.server.ts");
for (const fn of ["runDeceptionTurn", "sha256Hex", "AI_MODEL"]) {
  if (!(fn in mod)) throw new Error(`deception.server.ts is missing export: ${fn}`);
}
await import("ai");
await import("@ai-sdk/openai");
console.log(`smoke ok — AI engine loads (model ${mod.AI_MODEL})`);

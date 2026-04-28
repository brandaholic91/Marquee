/**
 * One-time OpenAI Codex OAuth login.
 * Run: npx tsx src/scripts/login-openai.ts
 * Saves credentials to ~/.pi/agent/auth.json (or PI_AUTH_FILE env var).
 */
import { createInterface } from "node:readline";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { loginOpenAICodex } from "@mariozechner/pi-ai/oauth";

const authFile = process.env.PI_AUTH_FILE ?? join(homedir(), ".pi", "agent", "auth.json");

const rl = createInterface({ input: process.stdin, output: process.stdout });
const prompt = (q: string) => new Promise<string>((res) => rl.question(q, res));

async function main() {
  console.log(`\nMarquee — OpenAI Codex login`);
  console.log(`Credentials will be saved to: ${authFile}\n`);

  const credentials = await loginOpenAICodex({
    onAuth: ({ url, instructions }) => {
      console.log("\n→ Open this URL in your browser:");
      console.log(`  ${url}`);
      if (instructions) console.log(`\n  ${instructions}`);
      console.log();
    },
    onProgress: (msg) => process.stdout.write(`  ${msg}\n`),
    onPrompt: async (p) => {
      const answer = await prompt(`  ${p.message}${p.placeholder ? ` (${p.placeholder})` : ""}: `);
      return answer;
    },
  });

  const dir = dirname(authFile);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let existing: Record<string, unknown> = {};
  if (existsSync(authFile)) {
    try { existing = JSON.parse(readFileSync(authFile, "utf8")); } catch { /* ignore */ }
  }
  existing["openai-codex"] = credentials;
  writeFileSync(authFile, JSON.stringify(existing, null, 2), "utf8");

  console.log(`\n✓ Credentials saved to ${authFile}`);
  console.log(`  Set MARQUEE_PROVIDER_MODE=openai-subscription in your .env and restart the daemon.\n`);
  rl.close();
}

main().catch((e) => {
  console.error("\nLogin failed:", e instanceof Error ? e.message : e);
  rl.close();
  process.exit(1);
});

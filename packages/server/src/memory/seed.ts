import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { simpleGit } from "simple-git";

const TEMPLATES: Record<string, string> = {
  "client_profile.md": `---
title: Client Profile
client_name:
icp:
usp:
competitors:
brand_voice:
---
`,
  "brand_guidelines.md": `---
title: Brand Guidelines
tone_of_voice:
reference_posts:
formatting_rules:
---
`,
  "ongoing_campaigns.md": `---
title: Ongoing Campaigns
---
`,
  "content_history.md": `---
title: Content History
---
`,
};

export async function seedDefaultMemory(dataDir: string): Promise<void> {
  const memDir = join(dataDir, "memory");
  if (!existsSync(memDir)) mkdirSync(memDir, { recursive: true });

  const toCreate: string[] = [];
  for (const [name, content] of Object.entries(TEMPLATES)) {
    const filePath = join(memDir, name);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content, "utf8");
      toCreate.push(filePath);
    }
  }

  if (toCreate.length === 0) return;

  try {
    const git = simpleGit(dataDir);
    if (!(await git.checkIsRepo())) return;
    await git.add(toCreate);
    await git.commit("memory: seed initial templates");
  } catch {
    // best effort — files written, git optional
  }
}

import { mkdirSync } from "node:fs";
import { simpleGit } from "simple-git";

export async function ensureGitRepo(dataDir: string): Promise<void> {
	mkdirSync(dataDir, { recursive: true });
	const git = simpleGit(dataDir);
	if (await git.checkIsRepo()) return;
	await git.init();
	await git.addConfig("user.email", "marquee@local");
	await git.addConfig("user.name", "Marquee");
}

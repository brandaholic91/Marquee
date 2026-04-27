import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { simpleGit } from "simple-git";

export async function writeMemoryFile(dataDir: string, name: string, content: string): Promise<void> {
	const memDir = join(dataDir, "memory");
	if (!existsSync(memDir)) mkdirSync(memDir, { recursive: true });
	const filePath = join(memDir, `${name}.md`);
	writeFileSync(filePath, content, "utf8");
	const git = simpleGit(dataDir);
	await git.add(filePath);
	await git.commit(`update memory/${name}.md`, [filePath]);
}

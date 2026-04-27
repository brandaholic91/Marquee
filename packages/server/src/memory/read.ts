import { readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

export interface MemoryFile {
	frontmatter: Record<string, unknown>;
	body: string;
	raw: string;
}

export function readMemoryFile(dataDir: string, name: string): MemoryFile {
	const path = join(dataDir, "memory", `${name}.md`);
	const raw = readFileSync(path, "utf8");
	const parsed = matter(raw);
	return {
		frontmatter: parsed.data as Record<string, unknown>,
		body: parsed.content,
		raw,
	};
}

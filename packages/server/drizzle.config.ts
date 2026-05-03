import { defineConfig } from "drizzle-kit";
import { homedir } from "node:os";
import { resolve } from "node:path";

let dataDir = process.env.DATA_DIR || "~/.marquee-dev";
if (dataDir.startsWith("~")) {
	dataDir = resolve(homedir(), dataDir.slice(2));
}

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	dbCredentials: {
		url: `file:${dataDir}/state.db`,
	},
});

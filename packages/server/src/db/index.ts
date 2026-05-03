import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";

export type AgencyDb = BetterSQLite3Database<typeof schema>;

export interface DbHandle {
	db: AgencyDb;
	close: () => void;
}

export function openDb(path: string): DbHandle {
	const dir = dirname(path);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const sqlite = new Database(path);
	sqlite.pragma("journal_mode = WAL");
	sqlite.pragma("synchronous = NORMAL");
	sqlite.pragma("foreign_keys = ON");
	const db = drizzle(sqlite, { schema });
	try {
		migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
	} catch (err) {
		console.warn("[marquee] Migration skipped (database may already be initialized)");
	}
	return { db, close: () => sqlite.close() };
}

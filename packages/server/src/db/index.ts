import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type AgencyDb = BetterSQLite3Database<typeof schema>;

export function openDb(path: string): AgencyDb {
	const dir = dirname(path);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const sqlite = new Database(path);
	sqlite.pragma("journal_mode = WAL");
	sqlite.pragma("synchronous = NORMAL");
	sqlite.pragma("foreign_keys = ON");
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
	return db;
}

import type { drizzle } from "drizzle-orm/better-sqlite3";

type Db = ReturnType<typeof drizzle>;

// Stub: Task 22 will implement n8n webhook fire with retry.
export async function fireDeliverableShipped(
	_webhookUrl: string,
	_db: Db,
	_deliverableId: string,
): Promise<void> {
	return;
}

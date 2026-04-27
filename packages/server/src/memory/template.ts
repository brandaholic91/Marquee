type Context = Record<string, unknown>;

function resolve(ctx: Context, path: string): string {
	const parts = path.split(".");
	let current: unknown = ctx;
	for (const part of parts) {
		if (current == null || typeof current !== "object") return "";
		current = (current as Context)[part];
	}
	return current == null ? "" : String(current);
}

export function interpolate(template: string, ctx: Context): string {
	return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => resolve(ctx, key.trim()));
}

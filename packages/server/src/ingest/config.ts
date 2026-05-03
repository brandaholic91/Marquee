export type IngestRole = "ingest";

export interface IngestConfig {
	role: IngestRole;
	lifecycle: "transient";
	tools: Array<"read_wiki" | "propose_wiki_update" | "read_memory">;
}

export const INGEST_CONFIG: IngestConfig = {
	role: "ingest",
	lifecycle: "transient",
	tools: ["read_wiki", "propose_wiki_update", "read_memory"],
};

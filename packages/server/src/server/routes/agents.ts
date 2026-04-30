import type { FastifyPluginAsync } from "fastify";

export interface AgentsRoutesOpts {
	dataDir: string;
}

export const agentsRoutes: FastifyPluginAsync<AgentsRoutesOpts> = async (_app, _opts) => {
	// routes added in Task 6
};
